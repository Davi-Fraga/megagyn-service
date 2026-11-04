import { describe, expect, it } from "vitest";
import { expenseFiltersToQuery, parseExpenseFilters } from "./expense-filters";

const SITE = "11111111-1111-4111-8111-111111111111";
const CLIENT = "22222222-2222-4222-8222-222222222222";

describe("filtros de despesas (tela, CSV e PDF usam os mesmos)", () => {
  it("lê os parâmetros da URL e descarta valores inválidos", () => {
    const f = parseExpenseFilters({
      de: "2026-09-01",
      ate: "2026-09-31",
      obra: SITE,
      fornecedor: "x",
      situacao: "aprovado",
      q: "cimento; drop",
    });
    expect(f).toEqual({
      from: "2026-09-01",
      to: null,
      siteId: SITE,
      clientId: null,
      supplierId: null,
      purchaserId: null,
      categoryId: null,
      status: "aprovado",
      q: "cimento drop",
    });
  });

  it("situação desconhecida vira 'todas'", () => {
    expect(parseExpenseFilters({ situacao: "pago" }).status).toBeNull();
  });

  it("ida e volta pela query string preserva os filtros", () => {
    const f = parseExpenseFilters({ de: "2026-09-01", ate: "2026-09-30", obra: SITE, cliente: CLIENT, situacao: "enviado_para_conferencia" });
    expect(f.clientId).toBe(CLIENT);
    expect(parseExpenseFilters(Object.fromEntries(new URLSearchParams(expenseFiltersToQuery(f))))).toEqual(f);
    expect(expenseFiltersToQuery(parseExpenseFilters({}))).toBe("");
  });

  it("cliente inválido é descartado", () => {
    expect(parseExpenseFilters({ cliente: "x" }).clientId).toBeNull();
  });

  it("aceita parâmetros repetidos usando o primeiro", () => {
    expect(parseExpenseFilters({ obra: [SITE, "outro"] }).siteId).toBe(SITE);
  });
});
