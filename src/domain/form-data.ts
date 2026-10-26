import { isValidIsoDate } from "./dates";
import { UUID_RE } from "./ids";
import { parseBRL } from "./money";

/** Leitura tipada e defensiva de FormData (toda entrada é validada de novo no banco). */

export function fdStr(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function fdUuid(fd: FormData, key: string): string | null {
  const v = fdStr(fd, key);
  return v && UUID_RE.test(v) ? v : null;
}

export function fdUuids(fd: FormData, key: string): string[] {
  return [...new Set(fd.getAll(key).map(String).filter((v) => UUID_RE.test(v)))];
}

export function fdDate(fd: FormData, key: string): string | null {
  const v = fdStr(fd, key);
  return v && isValidIsoDate(v) ? v : null;
}

export function fdNumber(fd: FormData, key: string): number | null {
  const v = fdStr(fd, key);
  if (!v) return null;
  // "1.000,5" → 1000.5 (pt-BR); sem vírgula, o ponto é decimal ("0.5" do teclado numérico).
  const normalized = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function fdMoney(fd: FormData, key: string): number | null {
  const v = fdStr(fd, key);
  return v ? parseBRL(v) : null;
}

export function fdBool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

/** Legendas digitadas no envio de fotos: campos "caption:<id-do-anexo>". */
export function fdCaptions(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith("caption:") || typeof value !== "string") continue;
    const id = key.slice("caption:".length);
    const caption = value.trim();
    if (UUID_RE.test(id) && caption) out[id] = caption.slice(0, 200);
  }
  return out;
}
