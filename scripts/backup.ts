/**
 * Cópia de segurança do BANCO e dos ARQUIVOS (Storage privado).  Uso: npm run backup
 *
 * Banco: pg_dump formato custom (todas as tabelas, inclusive auth e metadados do storage).
 *   Exceto os DADOS de vault.secrets: a aplicação não usa o cofre do Supabase, os segredos são
 *   cifrados com chave da própria instância (inúteis em outra base) e não devem ir para o backup.
 *   - Se DATABASE_URL estiver definida e houver pg_dump no PATH, usa-o (produção/homologação).
 *   - Senão, usa o container local do Supabase (docker exec … pg_dump).
 * Arquivos: baixa todos os objetos dos buckets privados com a chave service_role. Com
 *   BACKUP_SKIP_LIST (arquivo com uma linha `<bucket>/<chave>` por objeto), baixa só o que não
 *   está na lista; os demais ficam no manifesto sem hash.
 * Saída: backups/<data-hora>/{db.dump, storage/<bucket>/<chave>, manifest.json (hash SHA-256 de cada arquivo baixado)}.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { backupBucket, readSkipList, type BackupFile } from "./backup-files";

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

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  const db = createClient(url, key, { auth: { persistSession: false } });

  console.log(`Backup em ${outDir}`);
  const database = await dumpDatabase();
  console.log(`Banco: ${database.bytes} bytes (${database.method}).`);

  const skip = readSkipList(process.env.BACKUP_SKIP_LIST);
  const files: BackupFile[] = [];
  for (const bucket of BUCKETS) {
    const { data: exists } = await db.storage.getBucket(bucket);
    if (!exists) continue;
    const found = await backupBucket(db, bucket, outDir, skip);
    files.push(...found);
    console.log(`Bucket ${bucket}: ${found.length} arquivo(s), ${found.filter((f) => f.sha256).length} baixado(s).`);
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
  console.log(`Concluído: ${files.length} arquivo(s) no manifesto, ${files.filter((f) => f.sha256).length} baixado(s).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
