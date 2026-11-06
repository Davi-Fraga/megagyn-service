import { describe, expect, it } from "vitest";
import { QUOTE_STATUS_LABEL, type QuoteStatus } from "./quote";
import { quoteRuler } from "./quote-ruler";

const states = (s: QuoteStatus) => quoteRuler(s).steps.map((x) => x.state);

describe("régua do orçamento", () => {
  it("tem as etapas Rascunho, Enviado e Aprovado e diz o nome da situação", () => {
    expect(quoteRuler("rascunho").steps.map((s) => s.label)).toEqual([QUOTE_STATUS_LABEL.rascunho, QUOTE_STATUS_LABEL.enviado, QUOTE_STATUS_LABEL.aprovado]);
    expect(quoteRuler("enviado").label).toBe(QUOTE_STATUS_LABEL.enviado);
  });

  it("rascunho é a etapa atual; enviado cumpre o rascunho", () => {
    expect(states("rascunho")).toEqual(["atual", "futura", "futura"]);
    expect(states("enviado")).toEqual(["feita", "atual", "futura"]);
  });

  it("aprovado cumpre a régua inteira", () => {
    expect(states("aprovado")).toEqual(["feita", "feita", "feita"]);
  });

  it("expirado pausa em Enviado", () => {
    const r = quoteRuler("expirado");
    expect(r.steps.map((x) => x.state)).toEqual(["feita", "pausada", "futura"]);
    expect(r.paused).toBe(true);
    expect(r.label).toBe(QUOTE_STATUS_LABEL.expirado);
  });

  it("recusado e cancelado riscam a régua, como a O.S. cancelada", () => {
    for (const s of ["rejeitado", "cancelado"] as const) {
      const r = quoteRuler(s);
      expect(r.cancelled).toBe(true);
      expect(r.steps.map((x) => x.state)).toEqual(["futura", "futura", "futura"]);
    }
  });
});
