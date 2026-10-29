import { describe, expect, it } from "vitest";
import { computeQuote, isQuoteExpired } from "./quote";

describe("totais do orçamento", () => {
  it("item com valor global por local (exemplo Cobertura R$ 7.600,00)", () => {
    const q = computeQuote([{ pricingMode: "global", subtotalCents: 760000 }]);
    expect(q).toEqual({ items: [{ subtotalCents: 760000 }], totalCents: 760000, totalInWords: "sete mil e seiscentos reais", errors: [] });
  });

  it("soma itens globais e detalhados (quantidade × preço unitário)", () => {
    const q = computeQuote([
      { pricingMode: "global", subtotalCents: 760000 },
      { pricingMode: "detalhado", quantityMilli: 667000, unitPriceCents: 1139 },
      { pricingMode: "detalhado", quantityMilli: 1500, unitPriceCents: 333 },
    ]);
    expect(q.items.map((i) => i.subtotalCents)).toEqual([760000, 759713, 500]);
    expect(q.totalCents).toBe(1520213);
    expect(q.errors).toEqual([]);
  });

  it("aponta itens incompletos ou inválidos", () => {
    const q = computeQuote([
      { pricingMode: "detalhado", quantityMilli: null, unitPriceCents: 100 },
      { pricingMode: "global", subtotalCents: -1 },
      { pricingMode: "global", subtotalCents: 0 },
    ]);
    expect(q.errors).toEqual([
      { index: 0, message: "Item 1: informe quantidade e preço unitário." },
      { index: 1, message: "Item 2: informe um valor maior que zero." },
      { index: 2, message: "Item 3: informe um valor maior que zero." },
    ]);
  });

  it("proposta enviada vence após a validade", () => {
    expect(isQuoteExpired("enviado", "2026-10-24", "2026-10-25")).toBe(true);
    expect(isQuoteExpired("enviado", "2026-10-25", "2026-10-25")).toBe(false);
    expect(isQuoteExpired("aprovado", "2026-10-01", "2026-10-25")).toBe(false);
  });
});
