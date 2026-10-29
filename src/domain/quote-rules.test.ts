import { describe, expect, it } from "vitest";
import { effectiveQuoteStatus, longDateBR, placeAndDate, quoteActions, validityText } from "./quote-rules";

const TODAY = "2026-10-25";

describe("situação efetiva", () => {
  it("enviado com validade vencida aparece como Expirado", () => {
    expect(effectiveQuoteStatus("enviado", "2026-10-24", TODAY)).toBe("expirado");
    expect(effectiveQuoteStatus("enviado", "2026-10-25", TODAY)).toBe("enviado");
    expect(effectiveQuoteStatus("aprovado", "2026-10-01", TODAY)).toBe("aprovado");
    expect(effectiveQuoteStatus("expirado", "2026-10-01", TODAY)).toBe("expirado");
  });
});

describe("ações disponíveis (espelham quote_transition no banco)", () => {
  it("rascunho: editar, enviar, cancelar, fotos", () => {
    expect(quoteActions("rascunho", null, TODAY)).toEqual(["editar", "fotos", "enviar", "cancelar", "duplicar"]);
  });
  it("enviado em validade: aprovar, recusar, revisar, cancelar", () => {
    expect(quoteActions("enviado", "2026-11-30", TODAY)).toEqual(["aprovar", "recusar", "revisar", "cancelar", "duplicar"]);
  });
  it("vencido: renovar validade (não aprova sem renovar)", () => {
    expect(quoteActions("enviado", "2026-10-01", TODAY)).toEqual(["renovar", "recusar", "revisar", "cancelar", "duplicar"]);
    expect(quoteActions("expirado", "2026-10-01", TODAY)).toEqual(["renovar", "recusar", "revisar", "cancelar", "duplicar"]);
  });
  it("aprovado: criar obra; encerrados: só duplicar", () => {
    expect(quoteActions("aprovado", "2026-10-01", TODAY)).toEqual(["criar_obra", "duplicar"]);
    expect(quoteActions("rejeitado", null, TODAY)).toEqual(["duplicar"]);
    expect(quoteActions("cancelado", null, TODAY)).toEqual(["duplicar"]);
  });
});

describe("textos do PDF", () => {
  it("validade em dias e data", () => {
    expect(validityText("2026-10-25", "2026-11-24")).toBe("30 dias (até 24/11/2026)");
    expect(validityText("2026-10-25", "2026-10-26")).toBe("1 dia (até 26/10/2026)");
    expect(validityText("2026-10-25", "2026-10-25")).toBe("até 25/10/2026");
    expect(validityText("2026-10-25", null)).toBe("—");
  });

  it("data por extenso sem dia da semana", () => {
    expect(longDateBR("2026-10-05")).toBe("5 de outubro de 2026");
    expect(longDateBR("2026-03-01")).toBe("1º de março de 2026");
  });

  it("local e data da assinatura", () => {
    expect(placeAndDate("Goiânia", "2026-10-25")).toBe("Goiânia, 25 de outubro de 2026");
    expect(placeAndDate(null, "2026-10-25")).toBe("25 de outubro de 2026");
    expect(placeAndDate("  ", "2026-10-25")).toBe("25 de outubro de 2026");
  });
});
