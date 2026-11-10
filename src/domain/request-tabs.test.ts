import { describe, expect, it } from "vitest";
import { parseRequestTab, photoGroups } from "./request-tabs";

describe("aba da O.S. pelo endereço", () => {
  it("abre a aba pedida quando ela existe", () => {
    expect(parseRequestTab("atendimentos")).toBe("atendimentos");
    expect(parseRequestTab("fotos")).toBe("fotos");
    expect(parseRequestTab("historico")).toBe("historico");
  });

  it("sem aba ou com aba desconhecida, abre a Solicitação", () => {
    expect(parseRequestTab(undefined)).toBe("solicitacao");
    expect(parseRequestTab("")).toBe("solicitacao");
    expect(parseRequestTab("FOTOS")).toBe("solicitacao");
    expect(parseRequestTab("toString")).toBe("solicitacao");
  });
});

describe("fotos da O.S. agrupadas", () => {
  const names = (id: string) => ({ p1: "João", p2: "Carlos" })[id] ?? "?";
  const entries = [
    { id: "e1", activity_date: "2026-11-03", author_id: "p1" },
    { id: "e2", activity_date: "2026-11-04", author_id: "p2" },
    { id: "e3", activity_date: "2026-11-05", author_id: "p1" },
  ];

  it("abertura primeiro, depois cada atendimento na ordem dos registros; grupo sem foto não aparece", () => {
    const groups = photoGroups(["a1"], entries, new Map([["e3", ["f3a", "f3b"]], ["e1", ["f1"]]]), names);
    expect(groups).toEqual([
      { key: "abertura", title: "Abertura do chamado", photos: ["a1"] },
      { key: "e1", title: "Atendimento de 03/11/2026 · João", photos: ["f1"] },
      { key: "e3", title: "Atendimento de 05/11/2026 · João", photos: ["f3a", "f3b"] },
    ]);
  });

  it("sem foto na abertura, começa pelos atendimentos", () => {
    expect(photoGroups([], entries, new Map([["e2", ["f2"]]]), names)).toEqual([{ key: "e2", title: "Atendimento de 04/11/2026 · Carlos", photos: ["f2"] }]);
  });

  it("sem nenhuma foto, nenhum grupo", () => {
    expect(photoGroups([], entries, new Map(), names)).toEqual([]);
  });
});
