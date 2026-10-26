import { describe, expect, it } from "vitest";
import { orThrow, rowOrNotFound } from "./query";

const failure = { data: null, error: { message: "Could not embed because more than one relationship was found", code: "PGRST201" } };

describe("orThrow", () => {
  it("erro de consulta é lançado com o código, nunca vira 'sem dados'", () => {
    expect(() => orThrow(failure)).toThrow(/PGRST201/);
  });
  it("devolve os dados, ou null quando não há linha", () => {
    expect(orThrow({ data: { id: "a" }, error: null })).toEqual({ id: "a" });
    expect(orThrow({ data: null, error: null })).toBeNull();
  });
});

describe("rowOrNotFound", () => {
  it("linha ausente vira 404 do Next", () => {
    let thrown: unknown;
    try {
      rowOrNotFound({ data: null, error: null });
    } catch (e) {
      thrown = e;
    }
    expect((thrown as { digest?: string })?.digest).toMatch(/404/);
  });
  it("erro de consulta não vira 404", () => {
    let thrown: unknown;
    try {
      rowOrNotFound(failure);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as { digest?: string }).digest ?? "").not.toMatch(/404/);
  });
  it("devolve a linha encontrada", () => {
    expect(rowOrNotFound({ data: { id: "b" }, error: null })).toEqual({ id: "b" });
  });
});
