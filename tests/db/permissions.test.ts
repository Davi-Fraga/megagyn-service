import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/server/db/database.types";
import { addMembership, createClientWithSite, createUser, serviceClient, sql, type TestUser } from "./helpers";

/**
 * B-24 (M-14): matriz de permissões por papel, com exceções individuais. O seed reproduz o
 * comportamento de hoje (docs/megagyn/04-fluxos-e-permissoes.md §4.1), e os pisos do §4.2 ficam
 * travados no banco. Nenhuma RPC consulta a matriz ainda: nada muda nas telas.
 */

// [módulo, ação, encarregado, funcionário, cliente]. A administração pode tudo.
const MATRIX: Array<[string, string, boolean, boolean, boolean]> = [
  ["cadastros", "ver", true, true, false],
  ["cadastros", "criar", false, false, false],
  ["cadastros", "editar", false, false, false],
  ["cadastros", "inativar", false, false, false],
  ["usuarios", "ver", true, true, false],
  ["usuarios", "criar", false, false, false],
  ["usuarios", "editar", false, false, false],
  ["usuarios", "bloquear", false, false, false],
  ["usuarios", "permissoes", false, false, false],
  ["os", "ver", true, true, false],
  ["os", "criar", false, false, false],
  ["os", "editar", false, false, false],
  ["os", "programar", false, false, false],
  ["os", "registrar", true, true, false],
  ["os", "validar", false, false, false],
  ["os", "cancelar", false, false, false],
  ["os", "reabrir", false, false, false],
  ["os", "remover_foto", false, false, false],
  ["os", "exportar", false, false, false],
  ["tarefas", "ver", true, true, false],
  ["tarefas", "criar", false, false, false],
  ["tarefas", "remarcar", false, false, false],
  ["tarefas", "cancelar", false, false, false],
  ["tarefas", "executar", true, true, false],
  ["diario", "ver", true, true, false],
  ["diario", "criar", true, true, false],
  ["diario", "ajustar", false, false, false],
  ["diario", "exportar", false, false, false],
  ["orcamentos", "ver", false, false, false],
  ["orcamentos", "criar", false, false, false],
  ["orcamentos", "editar", false, false, false],
  ["orcamentos", "mudar_situacao", false, false, false],
  ["fechamentos", "ver", false, false, false],
  ["fechamentos", "emitir", false, false, false],
  ["fechamentos", "exportar", false, false, false],
  ["despesas", "ver", true, false, false],
  ["despesas", "criar", true, false, false],
  ["despesas", "editar", true, false, false],
  ["despesas", "aprovar", false, false, false],
  ["despesas", "devolver", false, false, false],
  ["despesas", "exportar", false, false, false],
  ["reembolsos", "ver", true, true, false],
  ["reembolsos", "pagar", false, false, false],
  ["horas", "ver", true, true, false],
  ["horas", "registrar", true, true, false],
  ["horas", "aprovar", false, false, false],
  ["horas", "regras", false, false, false],
  ["configuracoes", "ver", true, true, false],
  ["configuracoes", "editar", false, false, false],
  ["configuracoes", "incluir_fornecedor", true, false, false],
  ["auditoria", "ver", false, false, false],
];

let admin: TestUser;
let foreman: TestUser;
let worker: TestUser;
let client: TestUser;
let siteA: string;
let siteB: string;
const overrideIds: string[] = [];

beforeAll(async () => {
  [admin, foreman, worker, client] = await Promise.all([
    createUser("admin", "Admin Matriz"),
    createUser("foreman", "Encarregado Matriz"),
    createUser("worker", "Funcionário Matriz"),
    createUser("client", "Cliente Matriz"),
  ]);
  siteA = (await createClientWithSite("Matriz A")).site.id;
  siteB = (await createClientWithSite("Matriz B")).site.id;
  await addMembership(worker.id, siteA);
  await addMembership(foreman.id, siteA);
});

afterAll(async () => {
  if (overrideIds.length > 0) await serviceClient().from("permission_overrides").delete().in("id", overrideIds);
});

const can = (user: TestUser, module: string, action: string, site?: string) =>
  user.db.rpc("can", { p_module: module, p_action: action, ...(site ? { p_site: site } : {}) });

async function grant(row: Database["public"]["Tables"]["permission_overrides"]["Insert"]) {
  const res = await admin.db.from("permission_overrides").insert(row).select("id").single();
  if (res.data) overrideIds.push(res.data.id);
  return res;
}

describe("B-24 — matriz de permissões", () => {
  it("o seed reproduz a matriz atual, papel por papel", async () => {
    expect(Number(sql("select count(*) from public.permission_catalog"))).toBe(MATRIX.length);
    expect(Number(sql("select count(*) from public.role_permissions"))).toBe(MATRIX.length * 3);
    const wrong: string[] = [];
    for (const [module, action, forForeman, forWorker, forClient] of MATRIX) {
      for (const [who, user, expected] of [
        ["admin", admin, true],
        ["encarregado", foreman, forForeman],
        ["funcionário", worker, forWorker],
        ["cliente", client, forClient],
      ] as const) {
        const { data, error } = await can(user, module, action);
        if (error || data !== expected) wrong.push(`${module}.${action} (${who}): ${error?.message ?? data}`);
      }
    }
    expect(wrong).toEqual([]);
  }, 120_000);

  it("permissão desconhecida é erro, não um sim nem um não silencioso", async () => {
    const { error } = await can(admin, "os", "voar");
    expect(error?.message).toContain("Permissão desconhecida");
  });

  it("com local, a permissão vale só onde a pessoa tem acesso", async () => {
    expect((await can(worker, "os", "registrar", siteA)).data).toBe(true);
    expect((await can(worker, "os", "registrar", siteB)).data).toBe(false);
    expect((await can(admin, "os", "registrar", siteB)).data).toBe(true);
  });

  it("exceção individual vale com motivo, no local dela, até vencer, e não contorna o piso", async () => {
    // Piso: ação de administração não vai para um papel inteiro.
    const byRole = await admin.db
      .from("role_permissions")
      .update({ allowed: true })
      .eq("role", "worker")
      .eq("module", "os")
      .eq("action", "validar")
      .select("id");
    expect(byRole.error?.message).toContain("exige a administração");
    // Piso: o cliente nunca vê despesas, nem por exceção.
    expect((await grant({ profile_id: client.id, module: "despesas", action: "ver", allowed: true, reason: "Teste" })).error?.message).toContain("cliente");
    // Exceção sem motivo é recusada.
    expect((await grant({ profile_id: worker.id, module: "os", action: "validar", allowed: true, reason: " " })).error).not.toBeNull();

    // Exceção num local sem acesso não abre esse local.
    expect((await grant({ profile_id: worker.id, module: "os", action: "validar", site_id: siteB, allowed: true, reason: "Exceção de teste" })).error).toBeNull();
    expect((await can(worker, "os", "validar", siteB)).data).toBe(false);
    expect((await can(worker, "os", "validar", siteA)).data).toBe(false);

    // Exceção vencida não vale; a vigente vale.
    const past = new Date(Date.now() - 60_000).toISOString();
    expect((await grant({ profile_id: foreman.id, module: "os", action: "validar", allowed: true, reason: "Vencida", expires_at: past })).error).toBeNull();
    expect((await can(foreman, "os", "validar", siteA)).data).toBe(false);
    expect((await grant({ profile_id: foreman.id, module: "os", action: "validar", allowed: true, reason: "Cobertura de férias (teste)" })).error).toBeNull();
    expect((await can(foreman, "os", "validar", siteA)).data).toBe(true);
    expect((await can(foreman, "os", "validar", siteB)).data).toBe(false);
  });

  it("ninguém altera a própria permissão", async () => {
    const own = await grant({ profile_id: admin.id, module: "orcamentos", action: "ver", allowed: true, reason: "Teste" });
    expect(own.error?.message).toContain("própria permissão");
    const adminRow = await admin.db
      .from("role_permissions")
      .insert({ role: "admin", module: "os", action: "ver", allowed: false });
    expect(adminRow.error).not.toBeNull();
    // A pessoa da equipe não mexe em permissão nenhuma.
    const byWorker = await worker.db
      .from("permission_overrides")
      .insert({ profile_id: foreman.id, module: "os", action: "ver", allowed: true, reason: "Teste" });
    expect(byWorker.error).not.toBeNull();
  });

  it("a alteração da matriz fica na trilha, com quem fez", async () => {
    const svc = serviceClient();
    const { data: row } = await svc
      .from("role_permissions")
      .select("id")
      .eq("role", "foreman")
      .eq("module", "orcamentos")
      .eq("action", "ver")
      .single();
    const id = row!.id;
    try {
      const on = await admin.db.from("role_permissions").update({ allowed: true }).eq("id", id).select("id");
      expect(on.error).toBeNull();
      const { data: events } = await svc.from("audit_events").select("action, actor_id").eq("entity_type", "role_permissions").eq("entity_id", id);
      expect(events).toEqual(expect.arrayContaining([{ action: "update", actor_id: admin.id }]));
    } finally {
      await svc.from("role_permissions").update({ allowed: false }).eq("id", id);
    }
  });
});
