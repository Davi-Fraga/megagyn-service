import { describe, expect, it } from "vitest";
import { fdCaptions, fdDate, fdMoney, fdNumber, fdStr, fdUuid, fdUuids } from "./form-data";

const U1 = "0b8f6a3e-2c1d-4e5f-8a9b-1c2d3e4f5a6b";
const U2 = "1c9a7b4f-3d2e-4f6a-9b8c-2d3e4f5a6b7c";

function fd(entries: Array<[string, string]>) {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

describe("leitura de FormData", () => {
  it("textos aparados e vazios como null", () => {
    const f = fd([["a", "  texto "], ["b", "   "]]);
    expect(fdStr(f, "a")).toBe("texto");
    expect(fdStr(f, "b")).toBeNull();
    expect(fdStr(f, "c")).toBeNull();
  });

  it("uuid único e lista, ignorando valores inválidos", () => {
    const f = fd([["id", U1], ["ids", U1], ["ids", "xx"], ["ids", U2]]);
    expect(fdUuid(f, "id")).toBe(U1);
    expect(fdUuid(f, "nada")).toBeNull();
    expect(fdUuids(f, "ids")).toEqual([U1, U2]);
  });

  it("datas ISO válidas", () => {
    expect(fdDate(fd([["d", "2026-10-25"]]), "d")).toBe("2026-10-25");
    expect(fdDate(fd([["d", "2026-02-31"]]), "d")).toBeNull();
  });

  it("números com vírgula e dinheiro em centavos", () => {
    expect(fdNumber(fd([["h", "9,5"]]), "h")).toBe(9.5);
    expect(fdNumber(fd([["h", "abc"]]), "h")).toBeNull();
    // Ponto também é separador decimal quando não há vírgula (teclado numérico do celular).
    expect(fdNumber(fd([["h", "0.5"]]), "h")).toBe(0.5);
    expect(fdNumber(fd([["h", "1.5"]]), "h")).toBe(1.5);
    expect(fdNumber(fd([["h", "1.000,5"]]), "h")).toBe(1000.5);
    expect(fdMoney(fd([["v", "1.000,00"]]), "v")).toBe(100000);
  });

  it("legendas das fotos enviadas", () => {
    const f = fd([[`caption:${U1}`, " Antes "], [`caption:${U2}`, ""], ["caption:xx", "ignorar"]]);
    expect(fdCaptions(f)).toEqual({ [U1]: "Antes" });
  });
});
