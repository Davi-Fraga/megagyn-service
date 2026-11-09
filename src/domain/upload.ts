/**
 * Validação de anexos pelo conteúdo real (assinatura binária), não pela extensão
 * nem pelo MIME declarado pelo navegador.
 */

export type DetectedMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
export type UploadPurpose = "photo" | "receipt" | "logo" | "quote" | "registry";
export type UploadLimits = { maxImageMb: number; maxPdfMb: number };
/** Limites das Configurações; os padrões são os mesmos do banco (company_settings). */
export type FileLimits = UploadLimits & { maxFiles: number };
export const DEFAULT_FILE_LIMITS: FileLimits = { maxImageMb: 15, maxPdfMb: 20, maxFiles: 20 };

const EXTENSION: Record<DetectedMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const ALLOWED: Record<UploadPurpose, DetectedMime[]> = {
  photo: ["image/jpeg", "image/png", "image/webp"],
  receipt: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  logo: ["image/jpeg", "image/png", "image/webp"],
  quote: ["image/jpeg", "image/png", "image/webp"],
  registry: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
};

const DENIED_MESSAGE: Record<UploadPurpose, string> = {
  photo: "Tipo de arquivo não permitido. Envie foto JPG, PNG ou WEBP.",
  receipt: "Tipo de arquivo não permitido. Envie foto (JPG, PNG, WEBP) ou PDF do comprovante.",
  logo: "Tipo de arquivo não permitido. Envie imagem JPG, PNG ou WEBP.",
  quote: "Tipo de arquivo não permitido. Envie foto JPG, PNG ou WEBP.",
  registry: "Tipo de arquivo não permitido. Envie foto (JPG, PNG, WEBP) ou PDF do documento.",
};

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

export function detectFileType(bytes: Uint8Array): DetectedMime | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}

export type UploadValidation = { ok: true; mime: DetectedMime; extension: string } | { ok: false; error: string };

export function validateUpload(input: {
  bytes: Uint8Array;
  size: number;
  declaredMime: string;
  purpose: UploadPurpose;
  limits: UploadLimits;
}): UploadValidation {
  if (input.size <= 0 || input.bytes.length === 0) return { ok: false, error: "Arquivo vazio." };
  const mime = detectFileType(input.bytes);
  if (!mime || !ALLOWED[input.purpose].includes(mime)) return { ok: false, error: DENIED_MESSAGE[input.purpose] };

  const mb = 1024 * 1024;
  if (mime === "application/pdf") {
    if (input.size > input.limits.maxPdfMb * mb) return { ok: false, error: `Arquivo maior que ${input.limits.maxPdfMb} MB.` };
  } else if (input.size > input.limits.maxImageMb * mb) {
    return { ok: false, error: `Arquivo maior que ${input.limits.maxImageMb} MB. Reduza a foto e tente de novo.` };
  }
  return { ok: true, mime, extension: EXTENSION[mime] };
}

/** Folga para os campos e delimitadores do multipart além do próprio arquivo. */
const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

/**
 * Recusa o envio pelo cabeçalho Content-Length antes de ler o corpo na memória.
 * Sem tamanho declarado (ou inválido) também recusa: o navegador sempre informa ao enviar FormData.
 */
export function requestTooLarge(contentLength: string | null, limits: UploadLimits): boolean {
  if (contentLength === null || !/^\d+$/.test(contentLength)) return true;
  const max = Math.max(limits.maxImageMb, limits.maxPdfMb) * 1024 * 1024 + MULTIPART_OVERHEAD_BYTES;
  return Number(contentLength) > max;
}

/** Mensagem para quem envia. A hospedagem pode responder 413 antes do app, sem JSON. */
export function uploadErrorMessage(status: number, serverError?: string): string {
  if (status === 413) return "Arquivo grande demais. Reduza o PDF ou envie uma foto do comprovante.";
  return serverError ?? "Falha no envio. Toque em tentar de novo.";
}

/** Maior lado guardado por tipo de envio. Comprovante fica maior para a nota continuar legível. */
export const MAX_IMAGE_SIDE: Record<UploadPurpose, number> = { photo: 1600, quote: 1600, receipt: 2000, logo: 1600, registry: 2000 };

// ---------------------------------------------------------------------------
// B-31: limites mostrados antes do envio e quantidade por envio
// ---------------------------------------------------------------------------

/** Quantos arquivos o campo aceita: o menor entre o do campo (logotipo: 1) e o das Configurações. */
export function effectiveMaxFiles(limits: FileLimits, max?: number): number {
  return Math.min(limits.maxFiles, max ?? limits.maxFiles);
}

const filesPerUpload = (n: number) => (n === 1 ? "1 arquivo por envio" : `Até ${n} arquivos por envio`);

/** Texto mostrado antes de escolher os arquivos: tipo, tamanho e quantidade. */
export function uploadLimitsText(limits: FileLimits, { takesPdf, max }: { takesPdf: boolean; max?: number }): string {
  const types = takesPdf
    ? `Foto JPG, PNG ou WEBP até ${limits.maxImageMb} MB, ou PDF até ${limits.maxPdfMb} MB`
    : `Foto JPG, PNG ou WEBP, até ${limits.maxImageMb} MB cada`;
  return `${types}. ${filesPerUpload(effectiveMaxFiles(limits, max))}.`;
}

/** Na tela: os arquivos escolhidos além do limite não entram, e a pessoa é avisada. */
export function droppedFilesMessage(max: number, dropped: number): string {
  return `Até ${max} arquivos por envio: ${dropped} ${dropped === 1 ? "ficou" : "ficaram"} de fora.`;
}

/** No servidor: lista de arquivos acima do limite das Configurações. */
export function tooManyFilesMessage(max: number): string {
  return `Envie no máximo ${max} ${max === 1 ? "arquivo" : "arquivos"} por vez.`;
}
