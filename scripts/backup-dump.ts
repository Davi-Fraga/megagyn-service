/**
 * Como o backup copia o banco. Regra: o banco e os arquivos vêm sempre do mesmo projeto.
 * - DATABASE_URL definida: copia esse banco, com o pg_dump da máquina ou, se ele não estiver
 *   instalado, com o pg_dump do contêiner local do Supabase (mesma versão do Postgres).
 * - Sem DATABASE_URL: só vale para o Supabase local; com projeto remoto, para com erro.
 */

export const DUMP_ARGS = ["--format=custom", "--no-owner", "--no-privileges", "--exclude-table-data=vault.secrets"];

export type DumpPlan = { command: string; args: string[]; method: string };

const isLocal = (supabaseUrl: string) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(supabaseUrl);

/** O teste de restauração cria um bucket e sobe arquivos: só pode rodar contra o Supabase local. */
export function assertLocalSupabase(supabaseUrl: string | undefined) {
  if (!supabaseUrl || !isLocal(supabaseUrl)) {
    throw new Error("O teste de restauração só roda no Supabase local. Abra um terminal sem as variáveis de produção e rode de novo.");
  }
}

export function dumpPlan(opts: { supabaseUrl: string; databaseUrl: string | undefined; hostPgDump: boolean; container: string }): DumpPlan {
  const { supabaseUrl, databaseUrl, hostPgDump, container } = opts;
  if (databaseUrl) {
    if (hostPgDump) return { command: "pg_dump", args: [...DUMP_ARGS, databaseUrl], method: "pg_dump DATABASE_URL" };
    return { command: "docker", args: ["exec", container, "pg_dump", ...DUMP_ARGS, databaseUrl], method: `docker exec ${container} pg_dump DATABASE_URL` };
  }
  if (!isLocal(supabaseUrl)) {
    throw new Error("Backup de projeto remoto exige DATABASE_URL: sem ela, o banco copiado seria o local, e os arquivos, do projeto remoto.");
  }
  return { command: "docker", args: ["exec", container, "pg_dump", "-U", "postgres", ...DUMP_ARGS, "postgres"], method: `docker exec ${container} pg_dump` };
}
