import { describe, expect, it, vi } from "vitest";
import { CAPTION_FAILED, saveCaptions } from "./captions";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function form(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
}

/** Banco de mentira: só a chamada de legendas importa aqui. */
function fakeDb(result: { data: number | null; error: { message: string; code?: string } | null }) {
  const rpc = vi.fn(async () => result);
  return { db: { rpc } as unknown as Parameters<typeof saveCaptions>[0], rpc };
}

vi.spyOn(console, "error").mockImplementation(() => {});

describe("B-32 — legendas das fotos", () => {
  it("sem legenda, não chama o banco e segue", async () => {
    const { db, rpc } = fakeDb({ data: 0, error: null });
    expect(await saveCaptions(db, form({ title: "x" }))).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("legendas gravadas: segue", async () => {
    const { db, rpc } = fakeDb({ data: 2, error: null });
    expect(await saveCaptions(db, form({ [`caption:${A}`]: "Antes", [`caption:${B}`]: "Depois" }))).toBeNull();
    expect(rpc).toHaveBeenCalledWith("attachment_set_captions", { p_captions: { [A]: "Antes", [B]: "Depois" } });
  });

  it("erro do banco devolve o aviso, não 'salvo'", async () => {
    const { db } = fakeDb({ data: null, error: { message: "connection reset", code: "08006" } });
    expect(await saveCaptions(db, form({ [`caption:${A}`]: "Antes" }))).toEqual({ ok: false, message: CAPTION_FAILED });
  });

  it("legenda que o banco não gravou (foto de outra pessoa) também devolve o aviso", async () => {
    const { db } = fakeDb({ data: 1, error: null });
    expect(await saveCaptions(db, form({ [`caption:${A}`]: "Antes", [`caption:${B}`]: "Depois" }))).toEqual({ ok: false, message: CAPTION_FAILED });
  });
});
