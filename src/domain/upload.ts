/**
 * Validação de anexos pelo conteúdo real (assinatura binária), não pela extensão
 * nem pelo MIME declarado pelo navegador.
 */

export type DetectedMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
export type UploadPurpose = "photo" | "receipt" | "logo" | "quote";
export type UploadLimits = { maxImageMb: number; maxPdfMb: number };

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
};

const DENIED_MESSAGE: Record<UploadPurpose, string> = {
  photo: "Tipo de arquivo não permitido. Envie foto JPG, PNG ou WEBP.",
  receipt: "Tipo de arquivo não permitido. Envie foto (JPG, PNG, WEBP) ou PDF do comprovante.",
  logo: "Tipo de arquivo não permitido. Envie imagem JPG, PNG ou WEBP.",
  quote: "Tipo de arquivo não permitido. Envie foto JPG, PNG ou WEBP.",
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
