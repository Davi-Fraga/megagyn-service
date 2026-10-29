import { describe, expect, it } from "vitest";
import {
  formatBRL,
  formatCentsPlain,
  lineSubtotalCents,
  parseBRL,
  parseQuantityMilli,
  sumCents,
  validateAllocations,
} from "./money";

describe("parseBRL", () => {
  it("converte valores digitados em pt-BR para centavos inteiros", () => {
    expect(parseBRL("1.000,00")).toBe(100000);
    expect(parseBRL("R$ 7.992,00")).toBe(799200);
    expect(parseBRL("600")).toBe(60000);
    expect(parseBRL("0,01")).toBe(1);
    expect(parseBRL("333,5")).toBe(33350);
  });

  it("rejeita entradas inválidas, negativas ou com mais de 2 casas", () => {
    expect(parseBRL("")).toBeNull();
    expect(parseBRL("abc")).toBeNull();
    expect(parseBRL("-5,00")).toBeNull();
    expect(parseBRL("1,001")).toBeNull();
    expect(parseBRL("1.00.0,00")).toBeNull();
  });
});

describe("formatBRL", () => {
  it("formata centavos no padrão brasileiro", () => {
    expect(formatBRL(799200)).toBe("R$ 7.992,00");
    expect(formatBRL(1)).toBe("R$ 0,01");
    expect(formatBRL(123456789)).toBe("R$ 1.234.567,89");
    expect(formatBRL(0)).toBe("R$ 0,00");
    expect(formatBRL(-5000)).toBe("-R$ 50,00");
  });

  it("formata sem símbolo para planilhas", () => {
    expect(formatCentsPlain(100000)).toBe("1.000,00");
  });
});

describe("sumCents", () => {
  it("soma inteiros e recusa valores não inteiros", () => {
    expect(sumCents([60000, 40000])).toBe(100000);
    expect(() => sumCents([0.1, 0.2])).toThrow();
  });
});

describe("validateAllocations", () => {
  const ok = [
    { siteId: "obra-a", amountCents: 60000, purpose: "Cozinha do salão" },
    { siteId: "obra-b", amountCents: 40000, purpose: "Cobertura" },
  ];

  it("aceita R$ 1.000,00 dividido em R$ 600,00 + R$ 400,00", () => {
    expect(validateAllocations(100000, ok)).toEqual({ ok: true, allocatedCents: 100000, differenceCents: 0, errors: [] });
  });

  it("rejeita diferença de um centavo", () => {
    const result = validateAllocations(100000, [ok[0]!, { ...ok[1]!, amountCents: 39999 }]);
    expect(result.ok).toBe(false);
    expect(result.differenceCents).toBe(1);
    expect(result.errors).toContainEqual({ code: "soma_diferente", message: expect.stringContaining("R$ 0,01") });
  });

  it("rejeita parcela negativa, zerada, sem obra, sem finalidade e obra repetida", () => {
    const codes = (allocs: Parameters<typeof validateAllocations>[1]) =>
      validateAllocations(100000, allocs).errors.map((e) => e.code);
    expect(codes([{ siteId: "obra-a", amountCents: -100, purpose: "x" }])).toContain("valor_invalido");
    expect(codes([{ siteId: "obra-a", amountCents: 0, purpose: "x" }])).toContain("valor_invalido");
    expect(codes([{ siteId: "", amountCents: 100000, purpose: "x" }])).toContain("obra_vazia");
    expect(codes([{ siteId: "obra-a", amountCents: 100000, purpose: "  " }])).toContain("finalidade_vazia");
    expect(codes([
      { siteId: "obra-a", amountCents: 50000, purpose: "x" },
      { siteId: "obra-a", amountCents: 50000, purpose: "y" },
    ])).toContain("obra_duplicada");
    expect(codes([])).toContain("sem_parcelas");
  });

  it("rejeita total da despesa não positivo", () => {
    expect(validateAllocations(0, ok).errors.map((e) => e.code)).toContain("total_invalido");
  });
});

describe("quantidades e subtotais", () => {
  it("interpreta quantidades decimais sem ponto flutuante", () => {
    expect(parseQuantityMilli("667")).toBe(667000);
    expect(parseQuantityMilli("1,5")).toBe(1500);
    expect(parseQuantityMilli("0,125")).toBe(125);
    expect(parseQuantityMilli("1,2345")).toBeNull();
    expect(parseQuantityMilli("-1")).toBeNull();
  });

  it("calcula subtotal com arredondamento half-up em centavos", () => {
    expect(lineSubtotalCents(667000, 1139)).toBe(759713); // 667 m² × R$ 11,39
    expect(lineSubtotalCents(1500, 333)).toBe(500); // 1,5 × 3,33 = 4,995 → 5,00
    expect(lineSubtotalCents(1000, 33300)).toBe(33300);
  });
});
