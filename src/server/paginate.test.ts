import { describe, expect, it } from "vitest";
import { chunk, fetchAll } from "./paginate";

function fakeTable(size: number) {
  const calls: Array<[number, number]> = [];
  const rows = Array.from({ length: size }, (_, i) => i);
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  };
  return { calls, page };
}

describe("fetchAll", () => {
  it("junta todas as páginas sem perder a última linha", async () => {
    const t = fakeTable(2501);
    const out = await fetchAll(t.page, 1000);
    expect(out).toHaveLength(2501);
    expect(t.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("para no teto pedido, sem buscar além dele", async () => {
    const t = fakeTable(5000);
    const out = await fetchAll(t.page, 1000, 2500);
    expect(out).toHaveLength(2500);
    expect(t.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2499],
    ]);
  });

  it("propaga erro da consulta", async () => {
    await expect(fetchAll(async () => ({ data: null, error: new Error("x") }))).rejects.toThrow("x");
  });
});

describe("chunk", () => {
  it("divide em blocos do tamanho pedido", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
