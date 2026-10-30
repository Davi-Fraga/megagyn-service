import { describe, expect, it } from "vitest";
import { detectFileType, requestTooLarge, uploadErrorMessage, validateUpload } from "./upload";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const ascii = (s: string, pad = 16) => new Uint8Array([...Buffer.from(s, "latin1"), ...new Array(pad).fill(0)]);

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = ascii("RIFF\x00\x00\x00\x00WEBPVP8 ");
const PDF = ascii("%PDF-1.7\n");
const EXE = ascii("MZ\x90\x00");

const limits = { maxImageMb: 15, maxPdfMb: 20 };

describe("detectFileType pela assinatura binária", () => {
  it("reconhece JPEG, PNG, WEBP e PDF", () => {
    expect(detectFileType(JPEG)).toBe("image/jpeg");
    expect(detectFileType(PNG)).toBe("image/png");
    expect(detectFileType(WEBP)).toBe("image/webp");
    expect(detectFileType(PDF)).toBe("application/pdf");
  });

  it("não reconhece executável", () => {
    expect(detectFileType(EXE)).toBeNull();
  });
});

describe("validateUpload", () => {
  it("aceita foto válida e usa o tipo detectado", () => {
    expect(validateUpload({ bytes: JPEG, size: 1000, declaredMime: "image/png", purpose: "photo", limits })).toEqual({
      ok: true,
      mime: "image/jpeg",
      extension: "jpg",
    });
  });

  it("rejeita executável disfarçado de foto (spoofing de MIME)", () => {
    const r = validateUpload({ bytes: EXE, size: 1000, declaredMime: "image/jpeg", purpose: "photo", limits });
    expect(r).toEqual({ ok: false, error: "Tipo de arquivo não permitido. Envie foto JPG, PNG ou WEBP." });
  });

  it("aceita PDF como comprovante, mas não como foto", () => {
    expect(validateUpload({ bytes: PDF, size: 1000, declaredMime: "application/pdf", purpose: "receipt", limits }).ok).toBe(true);
    expect(validateUpload({ bytes: PDF, size: 1000, declaredMime: "application/pdf", purpose: "photo", limits }).ok).toBe(false);
  });

  it("respeita limites configuráveis de tamanho", () => {
    const big = validateUpload({ bytes: JPEG, size: 16 * 1024 * 1024, declaredMime: "image/jpeg", purpose: "photo", limits });
    expect(big).toEqual({ ok: false, error: "Arquivo maior que 15 MB. Reduza a foto e tente de novo." });
    const pdf = validateUpload({ bytes: PDF, size: 21 * 1024 * 1024, declaredMime: "application/pdf", purpose: "receipt", limits });
    expect(pdf).toEqual({ ok: false, error: "Arquivo maior que 20 MB." });
  });

  it("rejeita arquivo vazio", () => {
    expect(validateUpload({ bytes: new Uint8Array(), size: 0, declaredMime: "image/jpeg", purpose: "photo", limits })).toEqual({
      ok: false,
      error: "Arquivo vazio.",
    });
  });
});

describe("requestTooLarge (antes de ler o corpo)", () => {
  const limits = { maxImageMb: 15, maxPdfMb: 20 };
  it("aceita corpo dentro do maior limite mais a folga do multipart", () => {
    expect(requestTooLarge(String(20 * 1024 * 1024), limits)).toBe(false);
  });
  it("recusa corpo acima do limite", () => {
    expect(requestTooLarge(String(22 * 1024 * 1024), limits)).toBe(true);
  });
  it("recusa quando o tamanho não é informado ou é inválido", () => {
    expect(requestTooLarge(null, limits)).toBe(true);
    expect(requestTooLarge("abc", limits)).toBe(true);
    expect(requestTooLarge("-1", limits)).toBe(true);
  });
});

describe("uploadErrorMessage", () => {
  it("413 da hospedagem vira orientação clara", () => {
    expect(uploadErrorMessage(413)).toBe("Arquivo grande demais. Reduza o PDF ou envie uma foto do comprovante.");
  });
  it("mensagem do servidor tem prioridade nos demais erros", () => {
    expect(uploadErrorMessage(400, "Envie uma imagem JPG, PNG ou WEBP.")).toBe("Envie uma imagem JPG, PNG ou WEBP.");
  });
  it("sem mensagem, orienta tentar de novo", () => {
    expect(uploadErrorMessage(500)).toBe("Falha no envio. Toque em tentar de novo.");
  });
});
