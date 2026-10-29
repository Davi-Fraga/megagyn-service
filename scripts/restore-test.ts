/**
 * Teste de restauração em AMBIENTE DE TESTE (nunca na base em uso).  Uso: npm run restore:test [-- <pasta do backup>]
 *
 * 1. Cria um banco descartável "restore_test" no Postgres local e restaura db.dump nele (pg_restore).
 * 2. Compara a contagem de registros das tabelas principais com o manifesto.
 * 3. Envia cada arquivo do backup para um bucket descartável "restore-test", baixa de volta
 *    e confere o hash SHA-256 com o manifesto; confirma que cada anexo do banco restaurado tem arquivo.
 * 4. Remove o bucket e o banco descartáveis (use --keep para inspecionar).
 * Em produção, o mesmo procedimento deve rodar contra um projeto Supabase de homologação.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!;
  }
}

const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_megagyn-service";
const TEST_DB = "restore_test";
const TEST_BUCKET = "restore-test";
const keep = process.argv.includes("--keep");

type Manifest = {
  database: { sha256: string };
  counts: Record<string, number>;
  files: Array<{ bucket: string; key: string; bytes: number; sha256: string }>;
};

function psql(db: string, sql: string): string {
  return execFileSync("docker", ["exec", CONTAINER, "psql", "-U", "postgres", "-d", db, "-At", "-c", sql], { encoding: "utf8" }).trim();
}

async function main() {
  const root = path.resolve(process.env.BACKUP_DIR ?? "backups");
  const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const dir = arg ? path.resolve(arg) : path.join(root, readdirSync(root).sort().at(-1) ?? "");
  const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")) as Manifest;
  const dump = readFileSync(path.join(dir, "db.dump"));
  const dumpHash = createHash("sha256").update(dump).digest("hex");
  if (dumpHash !== manifest.database.sha256) throw new Error("O arquivo do banco não confere com o manifesto (hash diferente).");
  console.log(`Backup: ${dir}`);

  // 1. Banco descartável.
  psql("postgres", `drop database if exists ${TEST_DB}`);
  psql("postgres", `create database ${TEST_DB}`);
  execFileSync("docker", ["exec", "-i", CONTAINER, "pg_restore", "-U", "postgres", "-d", TEST_DB, "--no-owner", "--no-privileges", "--exit-on-error"], {
    input: dump,
    stdio: ["pipe", "inherit", "inherit"],
    maxBuffer: 1024 * 1024 * 1024,
  });
  console.log("Banco restaurado em banco descartável.");

  // 2. Contagens.
  let ok = true;
  for (const [table, expected] of Object.entries(manifest.counts)) {
    const got = Number(psql(TEST_DB, `select count(*) from public.${table}`));
    const match = got === expected;
    ok &&= match;
    console.log(`${match ? "OK " : "ERRO"} ${table}: backup ${expected}, restaurado ${got}`);
  }

  // 3. Arquivos.
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  await db.storage.createBucket(TEST_BUCKET, { public: false }).catch(() => undefined);
  let filesOk = 0;
  for (const f of manifest.files) {
    const local = readFileSync(path.join(dir, "storage", f.bucket, ...f.key.split("/")));
    const key = `${f.bucket}/${f.key}`;
    const up = await db.storage.from(TEST_BUCKET).upload(key, local, { upsert: true, contentType: "application/octet-stream" });
    if (up.error) throw new Error(`Falha ao restaurar ${key}: ${up.error.message}`);
    const { data } = await db.storage.from(TEST_BUCKET).download(key);
    const back = Buffer.from(await data!.arrayBuffer());
    const hash = createHash("sha256").update(back).digest("hex");
    if (hash === f.sha256) filesOk += 1;
    else {
      ok = false;
      console.log(`ERRO hash ${key}`);
    }
  }
  console.log(`${filesOk}/${manifest.files.length} arquivo(s) restaurado(s) com hash idêntico.`);

  // Cada anexo registrado no banco restaurado precisa ter o arquivo no backup.
  const keys = new Set(manifest.files.map((f) => `${f.bucket}/${f.key}`));
  const rows = psql(TEST_DB, "select bucket::text || '/' || storage_key from public.attachments").split("\n").filter(Boolean);
  const missing = rows.filter((k) => !keys.has(k));
  console.log(`${rows.length - missing.length}/${rows.length} anexo(s) do banco com arquivo no backup.`);
  if (missing.length) {
    ok = false;
    console.log("Sem arquivo:", missing.slice(0, 10).join(", "));
  }

  // 4. Limpeza.
  if (!keep) {
    const all = manifest.files.map((f) => `${f.bucket}/${f.key}`);
    for (let i = 0; i < all.length; i += 500) await db.storage.from(TEST_BUCKET).remove(all.slice(i, i + 500));
    await db.storage.deleteBucket(TEST_BUCKET).catch(() => undefined);
    psql("postgres", `drop database if exists ${TEST_DB}`);
  }
  console.log(ok ? "RESTAURAÇÃO VERIFICADA." : "RESTAURAÇÃO COM DIVERGÊNCIAS.");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
