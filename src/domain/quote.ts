/**
 * Orçamento comercial (COMPLEMENTO M7). Valor comercial: não é despesa
 * nem receita; nunca somado a custos internos.
 */
import { centsToWords } from "./amount-in-words";
import { lineSubtotalCents } from "./money";

export const QUOTE_STATUSES = ["rascunho", "enviado", "aprovado", "rejeitado", "expirado", "cancelado"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  expirado: "Expirado",
  cancelado: "Cancelado",
};

export type QuoteItemInput =
  | { pricingMode: "global"; subtotalCents: number | null }
  | { pricingMode: "detalhado"; quantityMilli: number | null; unitPriceCents: number | null };

export type QuoteComputation = {
  items: Array<{ subtotalCents: number }>;
  totalCents: number;
  totalInWords: string;
  errors: Array<{ index: number; message: string }>;
};

export function computeQuote(items: QuoteItemInput[]): QuoteComputation {
  const errors: QuoteComputation["errors"] = [];
  const computed = items.map((item, index) => {
    if (item.pricingMode === "global") {
      if (item.subtotalCents === null || !Number.isSafeInteger(item.subtotalCents) || item.subtotalCents <= 0) {
        errors.push({ index, message: `Item ${index + 1}: informe um valor maior que zero.` });
        return { subtotalCents: 0 };
      }
      return { subtotalCents: item.subtotalCents };
    }
    if (item.quantityMilli === null || item.unitPriceCents === null || item.quantityMilli <= 0 || item.unitPriceCents <= 0) {
      errors.push({ index, message: `Item ${index + 1}: informe quantidade e preço unitário.` });
      return { subtotalCents: 0 };
    }
    return { subtotalCents: lineSubtotalCents(item.quantityMilli, item.unitPriceCents) };
  });
  const totalCents = computed.reduce((n, i) => n + i.subtotalCents, 0);
  return { items: computed, totalCents, totalInWords: centsToWords(totalCents), errors };
}

/** Proposta enviada e com validade vencida é considerada expirada. */
export function isQuoteExpired(status: QuoteStatus, validUntil: string | null, todayIso: string): boolean {
  return status === "enviado" && !!validUntil && validUntil < todayIso;
}
