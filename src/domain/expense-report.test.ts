import { describe, expect, it } from "vitest";
import { expenseCsvFileName, expensesReportFileName, parseExpenseReportParams } from "./expense-report";

const SITE = "11111111-1111-4111-8111-111111111111";

describe("PDF de despesas internas — parâmetros e nome do arquivo", () => {
  it("nome com o período", () => {
    expect(expensesReportFileName({ from: "2026-09-01", to: "2026-09-30", siteId: null }, null)).toBe(
      "Despesas_internas_01-09-2026_a_30-09-2026.pdf",
    );
  });

  it("nome com a obra filtrada (sem acentos)", () => {
    expect(expensesReportFileName({ from: "2026-09-01", to: "2026-09-30", siteId: SITE }, "Galpão de montagem")).toBe(
      "Despesas_internas_Galpao_de_montagem_01-09-2026_a_30-09-2026.pdf",
    );
  });

  it("aceita período válido e obra opcional", () => {
    expect(parseExpenseReportParams({ from: "2026-09-01", to: "2026-09-30", siteId: null })).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
      siteId: null,
    });
    expect(parseExpenseReportParams({ from: "2026-09-01", to: "2026-09-30", siteId: SITE })?.siteId).toBe(SITE);
  });

  it("recusa período ausente, invertido ou inválido e obra que não é id", () => {
    expect(parseExpenseReportParams(null)).toBeNull();
    expect(parseExpenseReportParams({ from: "2026-09-30", to: "2026-09-01" })).toBeNull();
    expect(parseExpenseReportParams({ from: "2026-02-30", to: "2026-03-01" })).toBeNull();
    expect(parseExpenseReportParams({ from: "2026-09-01", to: "2026-09-30", siteId: "x" })).toBeNull();
  });

  it("nome do CSV com a data de geração", () => {
    expect(expenseCsvFileName("2026-10-25")).toBe("Despesas_internas_25-10-2026.csv");
  });
});
