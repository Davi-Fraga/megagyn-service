import { describe, expect, it } from "vitest";
import { dumpPlan } from "../../scripts/backup-dump";

/**
 * B-02: o banco e os arquivos do backup vêm sempre do mesmo lugar. Antes, com DATABASE_URL
 * definida e sem pg_dump na máquina, o script copiava o banco LOCAL e os arquivos de produção.
 */

const REMOTE = "https://abcdefgh.supabase.co";
const LOCAL = "http://127.0.0.1:49121";
const URL = "postgresql://postgres.abcdefgh:segredo@aws-0-sa-east-1.pooler.supabase.com:5432/postgres";
const CONTAINER = "supabase_db_megagyn-service";
const ARGS = ["--format=custom", "--no-owner", "--no-privileges", "--exclude-table-data=vault.secrets"];

describe("plano do pg_dump do backup", () => {
  it("com DATABASE_URL e pg_dump na máquina, usa o pg_dump da máquina", () => {
    expect(dumpPlan({ supabaseUrl: REMOTE, databaseUrl: URL, hostPgDump: true, container: CONTAINER })).toEqual({
      command: "pg_dump",
      args: [...ARGS, URL],
      method: "pg_dump DATABASE_URL",
    });
  });

  it("com DATABASE_URL e sem pg_dump na máquina, usa o pg_dump do contêiner contra a DATABASE_URL, nunca o banco local", () => {
    expect(dumpPlan({ supabaseUrl: REMOTE, databaseUrl: URL, hostPgDump: false, container: CONTAINER })).toEqual({
      command: "docker",
      args: ["exec", CONTAINER, "pg_dump", ...ARGS, URL],
      method: `docker exec ${CONTAINER} pg_dump DATABASE_URL`,
    });
  });

  it("projeto remoto sem DATABASE_URL para com erro, em vez de copiar o banco local", () => {
    expect(() => dumpPlan({ supabaseUrl: REMOTE, databaseUrl: undefined, hostPgDump: true, container: CONTAINER })).toThrow(/DATABASE_URL/);
  });

  it("projeto local sem DATABASE_URL copia o banco do contêiner local", () => {
    for (const supabaseUrl of [LOCAL, "http://localhost:54321"]) {
      expect(dumpPlan({ supabaseUrl, databaseUrl: undefined, hostPgDump: false, container: CONTAINER })).toEqual({
        command: "docker",
        args: ["exec", CONTAINER, "pg_dump", "-U", "postgres", ...ARGS, "postgres"],
        method: `docker exec ${CONTAINER} pg_dump`,
      });
    }
  });
});
