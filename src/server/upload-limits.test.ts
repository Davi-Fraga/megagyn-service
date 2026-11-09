import { describe, expect, it, vi } from "vitest";
import { checkFileCount, loadFileLimits } from "./upload-limits";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);

function form(fields: Record<string, string[]>) {
  const fd = new FormData();
  for (const [k, values] of Object.entries(fields)) for (const v of values) fd.append(k, v);
  return fd;
}

/** Banco de mentira: só a leitura das Configurações importa aqui. */
function fakeDb(settings: { max_image_mb: number; max_pdf_mb: number; max_files_per_upload: number } | null) {
  const maybeSingle = vi.fn(async () => ({ data: settings, error: null }));
  const from = vi.fn(() => ({ select: () => ({ maybeSingle }) }));
  return { db: { from } as unknown as Parameters<typeof checkFileCount>[0], from };
}

describe("B-31 — limites das Configurações", () => {
  it("lê os limites; sem a linha, usa os padrões do banco", async () => {
    expect(await loadFileLimits(fakeDb({ max_image_mb: 10, max_pdf_mb: 12, max_files_per_upload: 5 }).db)).toEqual({ maxImageMb: 10, maxPdfMb: 12, maxFiles: 5 });
    expect(await loadFileLimits(fakeDb(null).db)).toEqual({ maxImageMb: 15, maxPdfMb: 20, maxFiles: 20 });
  });
});

describe("B-31 — quantidade de arquivos no servidor", () => {
  const five = { max_image_mb: 15, max_pdf_mb: 20, max_files_per_upload: 5 };

  it("com limite 5, a sexta foto é recusada no campo dela", async () => {
    const { db } = fakeDb(five);
    expect(await checkFileCount(db, form({ photo_ids: ids(6) }), ["photo_ids"])).toEqual({
      ok: false,
      message: "Envie no máximo 5 arquivos por vez.",
      fieldErrors: { photo_ids: "Envie no máximo 5 arquivos por vez." },
    });
  });

  it("até o limite, segue; cada campo de fotos conta separado", async () => {
    const { db } = fakeDb(five);
    expect(await checkFileCount(db, form({ photo_ids: ids(5), result_photo_ids: ids(5) }), ["photo_ids", "result_photo_ids"])).toBeNull();
    const over = await checkFileCount(db, form({ photo_ids: ids(2), result_photo_ids: ids(6) }), ["photo_ids", "result_photo_ids"]);
    expect(over?.fieldErrors).toEqual({ result_photo_ids: "Envie no máximo 5 arquivos por vez." });
  });

  it("com 0 ou 1 arquivo, nem consulta as Configurações (o limite mínimo é 1)", async () => {
    const { db, from } = fakeDb(five);
    expect(await checkFileCount(db, form({ photo_ids: ids(1) }), ["photo_ids"])).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});
