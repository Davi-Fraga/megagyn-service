/**
 * Regras de situação do orçamento usadas na tela. As mesmas transições são impostas
 * no banco por public.quote_transition (migração 20261025001300).
 */
import { formatDateBR, monthName } from "./dates";
import { isQuoteExpired, type QuoteStatus } from "./quote";

export type QuoteAction =
  | "editar"
  | "fotos"
  | "enviar"
  | "aprovar"
  | "recusar"
  | "revisar"
  | "renovar"
  | "cancelar"
  | "criar_obra"
  | "duplicar";

/** "Expirado" é calculado na leitura: enviado com validade anterior a hoje. */
export function effectiveQuoteStatus(status: QuoteStatus, validUntil: string | null, todayIso: string): QuoteStatus {
  return isQuoteExpired(status, validUntil, todayIso) ? "expirado" : status;
}

export function quoteActions(status: QuoteStatus, validUntil: string | null, todayIso: string): QuoteAction[] {
  switch (effectiveQuoteStatus(status, validUntil, todayIso)) {
    case "rascunho":
      return ["editar", "fotos", "enviar", "cancelar", "duplicar"];
    case "enviado":
      return ["aprovar", "recusar", "revisar", "cancelar", "duplicar"];
    case "expirado":
      return ["renovar", "recusar", "revisar", "cancelar", "duplicar"];
    case "aprovado":
      return ["criar_obra", "duplicar"];
    default:
      return ["duplicar"];
  }
}

function isoToUtcMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

/** "30 dias (até 24/11/2026)". */
export function validityText(issuedIso: string, validUntilIso: string | null): string {
  if (!validUntilIso) return "—";
  const days = Math.round((isoToUtcMs(validUntilIso) - isoToUtcMs(issuedIso)) / 86_400_000);
  const until = `até ${formatDateBR(validUntilIso)}`;
  if (days <= 0) return until;
  return `${days} ${days === 1 ? "dia" : "dias"} (${until})`;
}

/** "2026-10-25" → "25 de outubro de 2026" (dia 1 como "1º"). */
export function longDateBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Data inválida: ${iso}`);
  const day = Number(m[3]);
  return `${day === 1 ? "1º" : day} de ${monthName(Number(m[2]))} de ${m[1]}`;
}

/** Local e data da assinatura: "Goiânia, 25 de outubro de 2026". */
export function placeAndDate(city: string | null | undefined, iso: string): string {
  const c = city?.trim();
  return c ? `${c}, ${longDateBR(iso)}` : longDateBR(iso);
}
