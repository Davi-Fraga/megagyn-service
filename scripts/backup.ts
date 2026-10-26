/**
 * Cópia de segurança do BANCO e dos ARQUIVOS (Storage privado).  Uso: npm run backup
 *
 * Banco: pg_dump formato custom (todas as tabelas, inclusive auth e metadados do storage).
 *   Exceto os DADOS de vault.secrets: a aplicação não usa o cofre do Supabase, os segredos são
 *   cifrados com chave da própria instância (inúteis em outra base) e não devem ir para o backup.
 *   - Se DATABASE_URL estiver definida e houver pg_dump no PATH, usa-o (produção/homologação).
 *   - Senão, usa o container local do Supabase (docker exec … pg_dump).
 * Arquivos: baixa todos os objetos dos buckets privados com a chave service_role.
 * Saída: backups/<data-hora>/{db.dump, storage/<bucket>/<chave>, manifest.json (hash SHA-256 de cada arquivo)}.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DUMP_ARGS = ["--format=custom", "--no-owner", "--no-privileges", "--exclude-table-data=vault.secrets"];

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!;
  }
}

const BUCKETS = ["evidence", "receipts", "branding", "reports", "quotes"];
const LOCAL_DB_CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_megagyn-service";

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.resolve(process.env.BACKUP_DIR ?? "backups", stamp);
mkdirSync(path.join(outDir, "storage"), { recursive: true });

function hasPgDump(): boolean {
  return spawnSync("pg_dump", ["--version"], { stdio: "ignore" }).status === 0;
}

async function dumpDatabase(): Promise<{ method: string; bytes: number; sha256: string }> {
  const target = path.join(outDir, "db.dump");
  if (process.env.DATABASE_URL && hasPgDump()) {
    execFileSync("pg_dump", [...DUMP_ARGS, "--file", target, process.env.DATABASE_URL], { stdio: "inherit" });
    const buf = readFileSync(target);
    return { method: "pg_dump DATABASE_URL", bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") };
  }
  const buf = execFileSync("docker", ["exec", LOCAL_DB_CONTAINER, "pg_dump", "-U", "postgres", ...DUMP_ARGS, "postgres"], {
    maxBuffer: 1024 * 1024 * 1024,
  });
  writeFileSync(target, buf);
  return { method: `docker exec ${LOCAL_DB_CONTAINER} pg_dump`, bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") };
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

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  const db = createClient(url, key, { auth: { persistSession: false } });

  console.log(`Backup em ${outDir}`);
  const database = await dumpDatabase();
  console.log(`Banco: ${database.bytes} bytes (${database.method}).`);

  const files: Array<{ bucket: string; key: string; bytes: number; sha256: string }> = [];
  for (const bucket of BUCKETS) {
    const { data: exists } = await db.storage.getBucket(bucket);
    if (!exists) continue;
    const keys = await listAll(db, bucket);
    for (const k of keys) {
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
    console.log(`Bucket ${bucket}: ${keys.length} arquivo(s).`);
  }

  const counts: Record<string, number> = {};
  for (const table of ["service_requests", "request_events", "work_entries", "attachments", "expenses", "expense_allocations", "closing_versions", "quotes", "profiles"]) {
    const { count } = await db.from(table).select("*", { count: "exact", head: true });
    counts[table] = count ?? 0;
  }
  writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify({ createdAt: new Date().toISOString(), database, counts, files }, null, 2),
  );
  console.log(`Concluído: ${files.length} arquivo(s), manifesto com hash SHA-256 gravado.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
