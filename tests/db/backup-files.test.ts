import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { backupBucket, readSkipList } from "../../scripts/backup-files";
import { serviceClient } from "./helpers";

/**
 * Backup diário: o que já está na cópia cifrada do Drive não é baixado de novo, senão o
 * download do Storage inteiro todo dia esgota a cota de saída do plano gratuito.
 */

const bucket = `backup-test-${randomUUID().slice(0, 8)}`;
const keys = ["2026/a.txt", "2026/b.txt"];
const outDir = mkdtempSync(path.join(tmpdir(), "backup-files-"));

beforeAll(async () => {
  const db = serviceClient();
  const { error } = await db.storage.createBucket(bucket, { public: false });
  if (error) throw error;
  for (const key of keys) {
    const { error: upErr } = await db.storage.from(bucket).upload(key, `conteúdo de ${key}`);
    if (upErr) throw upErr;
  }
});

afterAll(async () => {
  const db = serviceClient();
  await db.storage.from(bucket).remove(keys);
  await db.storage.deleteBucket(bucket);
  rmSync(outDir, { recursive: true, force: true });
});

describe("backupBucket", () => {
  it("não baixa o que já está guardado, mas mantém o arquivo no manifesto", async () => {
    const files = await backupBucket(serviceClient(), bucket, outDir, new Set([`${bucket}/2026/a.txt`]));

    expect(files.find((f) => f.key === "2026/a.txt")).toEqual({ bucket, key: "2026/a.txt", bytes: null, sha256: null });
    expect(existsSync(path.join(outDir, "storage", bucket, "2026", "a.txt"))).toBe(false);

    const novo = files.find((f) => f.key === "2026/b.txt");
    expect(novo?.sha256).toBe(createHash("sha256").update("conteúdo de 2026/b.txt").digest("hex"));
    expect(existsSync(path.join(outDir, "storage", bucket, "2026", "b.txt"))).toBe(true);
  });

  it("sem lista, baixa tudo com hash", async () => {
    const files = await backupBucket(serviceClient(), bucket, outDir, new Set());
    expect(files.map((f) => f.key).sort()).toEqual(keys);
    expect(files.every((f) => f.sha256 !== null)).toBe(true);
  });
});

describe("readSkipList", () => {
  it("sem arquivo, não pula nada", () => {
    expect(readSkipList(undefined).size).toBe(0);
  });

  it("lê a saída do rclone, ignorando linha vazia e fim de linha do Windows", () => {
    const file = path.join(outDir, "lista.txt");
    writeFileSync(file, "evidence/a.jpg\r\nreceipts/2026/b.jpg\n\n");
    expect([...readSkipList(file)]).toEqual(["evidence/a.jpg", "receipts/2026/b.jpg"]);
  });

  it("lista indicada e ausente é erro, para não baixar tudo em silêncio", () => {
    expect(() => readSkipList(path.join(outDir, "nao-existe.txt"))).toThrow();
  });
});
