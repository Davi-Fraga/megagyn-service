/**
 * Gera .env.local a partir do Supabase local (`supabase status`).
 * Só para desenvolvimento: as chaves locais são as padrão do Supabase CLI.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const raw = execSync("supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const json = JSON.parse(raw.slice(raw.indexOf("{"))) as Record<string, string>;

const values: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: json.API_URL ?? "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: json.ANON_KEY ?? "",
  SUPABASE_SERVICE_ROLE_KEY: json.SERVICE_ROLE_KEY ?? "",
  APP_URL: "http://localhost:3000",
  APP_TIMEZONE: "America/Sao_Paulo",
  PDF_RENDERER: "playwright",
  DATABASE_URL: json.DB_URL ?? "",
  MAILPIT_URL: json.MAILPIT_URL ?? json.INBUCKET_URL ?? "",
};

const target = ".env.local";
const previous = existsSync(target) ? readFileSync(target, "utf8") : "";
const kept = previous
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith("#") && !Object.keys(values).includes(line.split("=")[0]!));
const content = [
  "# Gerado por scripts/write-local-env.ts — NÃO versionar.",
  ...Object.entries(values).map(([k, v]) => `${k}=${v}`),
  ...kept,
  "",
].join("\n");
writeFileSync(target, content, "utf8");
console.log(`.env.local atualizado (${Object.keys(values).length} variáveis).`);
