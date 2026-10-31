import { describe, expect, it } from "vitest";
import { parseActivityFilters } from "./activity-filters";

const TODAY = "2026-10-30";
const SITE = "11111111-1111-4111-8111-111111111111";

describe("parseActivityFilters", () => {
  it("sem parâmetros, usa os últimos 30 dias até hoje", () => {
    expect(parseActivityFilters({}, TODAY)).toEqual({ siteId: null, from: "2026-09-30", to: TODAY });
  });
  it("aceita local e período válidos", () => {
    expect(parseActivityFilters({ local: SITE, de: "2026-08-01", ate: "2026-08-31" }, TODAY)).toEqual({
      siteId: SITE,
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });
  it("data inicial depois da final troca as duas", () => {
    expect(parseActivityFilters({ de: "2026-08-31", ate: "2026-08-01" }, TODAY)).toMatchObject({ from: "2026-08-01", to: "2026-08-31" });
  });
  it("data inválida volta para o padrão", () => {
    expect(parseActivityFilters({ de: "2026-99-99", ate: "ontem" }, TODAY)).toMatchObject({ from: "2026-09-30", to: TODAY });
  });
  it("local que não é UUID é ignorado", () => {
    expect(parseActivityFilters({ local: "1 or 1=1" }, TODAY).siteId).toBeNull();
  });
});
