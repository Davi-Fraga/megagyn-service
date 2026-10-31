import { createHash } from "node:crypto";
import { createWriteStream, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BackupFile = { bucket: string; key: string; bytes: number | null; sha256: string | null };

/** Saída de `rclone lsf -R --files-only` da cópia cifrada: uma linha `<bucket>/<chave>` por arquivo. */
export function readSkipList(file: string | undefined): Set<string> {
  if (!file) return new Set();
  return new Set(readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean));
}

async function listAll(db: SupabaseClient, bucket: string, prefix = ""): Promise<string[]> {
  const keys: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`Falha ao listar ${bucket}/${prefix}: ${error.message}`);
    for (const item of data ?? []) {
      const key = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) keys.push(...(await listAll(db, bucket, key)));
      else keys.push(key);
    }
    if (!data || data.length < 1000) break;
  }
  return keys;
}

/**
 * Baixa os objetos do bucket para `<outDir>/storage/<bucket>/<chave>`. O que está em `skip` entra
 * no manifesto sem hash e não é baixado: arquivo gravado não muda, e baixar o Storage inteiro
 * todo dia esgotaria a cota de saída do plano gratuito.
 */
export async function backupBucket(db: SupabaseClient, bucket: string, outDir: string, skip: Set<string>): Promise<BackupFile[]> {
  const files: BackupFile[] = [];
  for (const k of await listAll(db, bucket)) {
    if (skip.has(`${bucket}/${k}`)) {
      files.push({ bucket, key: k, bytes: null, sha256: null });
      continue;
    }
    const { data, error } = await db.storage.from(bucket).download(k);
    if (error || !data) throw new Error(`Falha ao baixar ${bucket}/${k}: ${error?.message}`);
    const buf = Buffer.from(await data.arrayBuffer());
    const target = path.join(outDir, "storage", bucket, ...k.split("/"));
    mkdirSync(path.dirname(target), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(target);
      ws.on("error", reject);
      ws.end(buf, () => resolve());
    });
    files.push({ bucket, key: k, bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") });
  }
  return files;
}
