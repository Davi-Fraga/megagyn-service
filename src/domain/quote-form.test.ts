import { describe, expect, it } from "vitest";
import {
  blankItemDraft,
  formatQuantityBR,
  itemRowToDraft,
  linesFromText,
  readItemDrafts,
  validateQuoteItems,
  type QuoteItemDraft,
} from "./quote-form";

const globalItem = (over: Partial<QuoteItemDraft> = {}): QuoteItemDraft => ({
  ...blankItemDraft(),
  locationLabel: "Cobertura",
  pricingMode: "global",
  linesText: "Reparo de rufos e calhas\nAplicação de manta líquida",
  notes: "Garantia de 01 ano",
  value: "7.600,00",
  ...over,
});

const detailedItem = (over: Partial<QuoteItemDraft> = {}): QuoteItemDraft => ({
  ...blankItemDraft(),
  locationLabel: "Fachada",
  title: "Pintura",
  pricingMode: "detalhado",
  quantity: "10",
  unit: "m²",
  unitPrice: "50,00",
  ...over,
});

describe("subitens (uma linha por subitem)", () => {
  it("remove linhas vazias, espaços e marcadores digitados", () => {
    expect(linesFromText("  - Reparo de rufos \n\n• Manta líquida\r\n* Limpeza  \n   ")).toEqual([
      "Reparo de rufos",
      "Manta líquida",
      "Limpeza",
    ]);
    expect(linesFromText("")).toEqual([]);
  });
});

describe("quantidade em pt-BR", () => {
  it("formata milésimos sem zeros à direita", () => {
    expect(formatQuantityBR(667000)).toBe("667");
    expect(formatQuantityBR(1500)).toBe("1,5");
    expect(formatQuantityBR(1234567)).toBe("1.234,567");
    expect(formatQuantityBR(250)).toBe("0,25");
  });
});

describe("validação dos itens com computeQuote", () => {
  it("item global Cobertura R$ 7.600,00 → total e extenso corretos", () => {
    const r = validateQuoteItems([globalItem()]);
    expect(r.ok).toBe(true);
    expect(r.totalCents).toBe(760000);
    expect(r.totalInWords).toBe("sete mil e seiscentos reais");
    expect(r.rows).toEqual([
      {
        location_label: "Cobertura",
        title: null,
        pricing_mode: "global",
        quantity: null,
        unit: null,
        unit_price_cents: null,
        subtotal_cents: 760000,
        lines: ["Reparo de rufos e calhas", "Aplicação de manta líquida"],
        notes: "Garantia de 01 ano",
        sort_order: 0,
      },
    ]);
  });

  it("soma global + detalhado (quantidade decimal × preço, half-up)", () => {
    const r = validateQuoteItems([globalItem(), detailedItem({ quantity: "1,5", unitPrice: "3,33" })]);
    expect(r.ok).toBe(true);
    expect(r.subtotals).toEqual([760000, 500]);
    expect(r.totalCents).toBe(760500);
    expect(r.totalInWords).toBe("sete mil seiscentos e cinco reais");
    expect(r.rows[1]).toMatchObject({ pricing_mode: "detalhado", quantity: 1.5, unit: "m²", unit_price_cents: 333, subtotal_cents: 500, sort_order: 1 });
  });

  it("ignora linhas totalmente em branco sem deslocar os erros dos demais itens", () => {
    const r = validateQuoteItems([blankItemDraft(), detailedItem({ quantity: "" })]);
    expect(r.ok).toBe(false);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.sort_order).toBe(0);
    expect(r.fieldErrors["items.1.quantity"]).toBe("Informe a quantidade (ex.: 667 ou 1,5).");
    expect(r.fieldErrors["items.0.quantity"]).toBeUndefined();
  });

  it("aponta erro por campo: local, valor, quantidade e preço", () => {
    const r = validateQuoteItems([
      globalItem({ locationLabel: "  ", value: "abc" }),
      detailedItem({ quantity: "-1", unitPrice: "0" }),
      globalItem({ value: "0,00" }),
    ]);
    expect(r.ok).toBe(false);
    expect(r.fieldErrors).toMatchObject({
      "items.0.locationLabel": "Informe o local (ex.: Cobertura).",
      "items.0.value": "Informe o valor (ex.: 7.600,00).",
      "items.1.quantity": "Informe a quantidade (ex.: 667 ou 1,5).",
      "items.1.unitPrice": "Informe o preço unitário (ex.: 45,90).",
      "items.2.value": "Informe o valor (ex.: 7.600,00).",
    });
    expect(r.subtotals).toEqual([null, null, null]);
    expect(r.totalCents).toBe(0);
  });

  it("recusa quantidade acima do limite do banco e valores que estouram a precisão", () => {
    const big = validateQuoteItems([detailedItem({ quantity: "1.000.000.000", unitPrice: "1,00" })]);
    expect(big.fieldErrors["items.0.quantity"]).toBe("Quantidade grande demais.");
    const huge = validateQuoteItems([detailedItem({ quantity: "999.999.999", unitPrice: "90.000.000.000,00" })]);
    expect(huge.ok).toBe(false);
    expect(huge.fieldErrors["items.0.unitPrice"]).toBe("Valor grande demais.");
  });

  it("modo de preço desconhecido é rejeitado", () => {
    const r = validateQuoteItems([globalItem({ pricingMode: "outro" as never })]);
    expect(r.fieldErrors["items.0.pricingMode"]).toBe("Escolha como o item é cobrado.");
  });

  it("lista vazia é válida (rascunho sem itens) com total zero", () => {
    const r = validateQuoteItems([]);
    expect(r).toMatchObject({ ok: true, rows: [], totalCents: 0 });
  });
});

describe("leitura do formulário", () => {
  it("lê os campos indexados items.N.campo", () => {
    const fd = new FormData();
    fd.set("items_count", "2");
    fd.set("items.0.locationLabel", "Cobertura");
    fd.set("items.0.pricingMode", "global");
    fd.set("items.0.value", "7.600,00");
    fd.set("items.0.linesText", "a\nb");
    fd.set("items.1.locationLabel", "Fachada");
    fd.set("items.1.pricingMode", "detalhado");
    fd.set("items.1.quantity", "2");
    fd.set("items.1.unit", "m²");
    fd.set("items.1.unitPrice", "10,00");
    const drafts = readItemDrafts(fd);
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({ locationLabel: "Cobertura", pricingMode: "global", value: "7.600,00", linesText: "a\nb", title: "" });
    expect(drafts[1]).toMatchObject({ pricingMode: "detalhado", quantity: "2", unit: "m²", unitPrice: "10,00" });
  });

  it("limita a quantidade de itens lidos", () => {
    const fd = new FormData();
    fd.set("items_count", "100000");
    expect(readItemDrafts(fd)).toHaveLength(200);
    fd.set("items_count", "x");
    expect(readItemDrafts(fd)).toHaveLength(0);
  });
});

describe("item salvo → rascunho do editor", () => {
  it("converte valores do banco para texto pt-BR", () => {
    expect(
      itemRowToDraft({
        location_label: "Fachada",
        title: "Pintura",
        pricing_mode: "detalhado",
        quantity: 1.5,
        unit: "m²",
        unit_price_cents: 4590,
        subtotal_cents: 6885,
        lines: ["Lixar", "Pintar"],
        notes: null,
      }),
    ).toEqual({
      locationLabel: "Fachada",
      title: "Pintura",
      pricingMode: "detalhado",
      linesText: "Lixar\nPintar",
      notes: "",
      value: "",
      quantity: "1,5",
      unit: "m²",
      unitPrice: "45,90",
    });
    expect(
      itemRowToDraft({
        location_label: "Cobertura",
        title: null,
        pricing_mode: "global",
        quantity: null,
        unit: null,
        unit_price_cents: null,
        subtotal_cents: 760000,
        lines: [],
        notes: "Garantia de 01 ano",
      }),
    ).toMatchObject({ pricingMode: "global", value: "7.600,00", quantity: "", unitPrice: "", notes: "Garantia de 01 ano" });
  });
});
