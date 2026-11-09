import { beforeAll, describe, expect, it } from "vitest";
import { loadProfiles } from "@/server/data";
import { addMembership, createClientWithSite, createUser, serviceClient, sql, type TestUser } from "./helpers";

/**
 * B-16 (M-10, etapa 1): a equipe lê de colegas só nome, papel e situação; e-mail e telefone só para a
 * administração e a própria pessoa. Notas internas e dados de cobrança de clientes e locais ficam fora
 * do alcance da equipe. A administração lê essas colunas pelas views profile_contacts, client_internal
 * e site_internal.
 */

let admin: TestUser;
let worker: TestUser;
let colleague: TestUser;
let clientId: string;
let siteId: string;

beforeAll(async () => {
  [admin, worker, colleague] = await Promise.all([
    createUser("admin", "Admin Privacidade"),
    createUser("worker", "Funcionário Privacidade"),
    createUser("foreman", "Colega Privacidade"),
  ]);
  const { client, site } = await createClientWithSite("Privacidade");
  clientId = client.id;
  siteId = site.id;
  await addMembership(worker.id, siteId);
  const svc = serviceClient();
  await svc.from("profiles").update({ phone: "(00) 90000-0001" }).eq("id", colleague.id);
  await svc.from("clients").update({ notes_internal: "Nota interna fictícia", billing_info: "Cobrança fictícia" }).eq("id", clientId);
  await svc.from("sites").update({ notes_internal: "Nota interna do local (fictícia)" }).eq("id", siteId);
});

describe("B-16 — privacidade de colaboradores e campos internos", () => {
  it("funcionário lê nome e papel do colega, mas não e-mail nem telefone", async () => {
    const names = await worker.db.from("profiles").select("id, full_name, role, is_active").eq("id", colleague.id).single();
    expect(names.error).toBeNull();
    expect(names.data).toMatchObject({ full_name: "Colega Privacidade", role: "foreman" });
    for (const column of ["email", "phone"]) {
      const { error } = await worker.db.from("profiles").select(column).eq("id", colleague.id);
      expect(error?.code, column).toBe("42501");
    }
  });

  it("cada pessoa lê o próprio contato pela view; a administração lê o de todos", async () => {
    const own = await worker.db.from("profile_contacts").select("id, email").eq("id", worker.id);
    expect(own.data).toEqual([{ id: worker.id, email: worker.email }]);
    const other = await worker.db.from("profile_contacts").select("id").eq("id", colleague.id);
    expect(other.data).toEqual([]);
    const byAdmin = await admin.db.from("profile_contacts").select("id, email, phone").eq("id", colleague.id).single();
    expect(byAdmin.data).toEqual({ id: colleague.id, email: colleague.email, phone: "(00) 90000-0001" });
  });

  it("funcionário com acesso ao local não lê notas internas nem dados de cobrança", async () => {
    const site = await worker.db.from("sites").select("id, name").eq("id", siteId).single();
    expect(site.error).toBeNull();
    const client = await worker.db.from("clients").select("id, display_name").eq("id", clientId).single();
    expect(client.error).toBeNull();
    expect((await worker.db.from("sites").select("notes_internal").eq("id", siteId)).error?.code).toBe("42501");
    for (const column of ["notes_internal", "billing_info"]) {
      expect((await worker.db.from("clients").select(column).eq("id", clientId)).error?.code, column).toBe("42501");
    }
    expect((await worker.db.from("client_internal").select("id").eq("id", clientId)).data).toEqual([]);
    expect((await worker.db.from("site_internal").select("id").eq("id", siteId)).data).toEqual([]);
  });

  it("a administração lê os campos internos pelas views", async () => {
    const client = await admin.db.from("client_internal").select("notes_internal, billing_info").eq("id", clientId).single();
    expect(client.data).toEqual({ notes_internal: "Nota interna fictícia", billing_info: "Cobrança fictícia" });
    const site = await admin.db.from("site_internal").select("notes_internal").eq("id", siteId).single();
    expect(site.data).toEqual({ notes_internal: "Nota interna do local (fictícia)" });
  });

  it("os seletores de pessoas trazem a equipe toda, mesmo acima de 1000 pessoas", async () => {
    // A API devolve no máximo 1000 linhas por consulta (max_rows). Completa a base local até passar disso.
    // Tokens, senha e datas vão preenchidos como o Auth grava: com nulos, o Auth falha ao listar usuários
    // ("Database error finding users") e o seed do E2E para.
    const missing = Math.max(0, 1001 - Number(sql("select count(*) from public.profiles")));
    if (missing > 0) {
      sql(
        `with u as (insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change_token_current, email_change, phone_change, phone_change_token, reauthentication_token) select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'volume-' || g || '-${Date.now()}@teste.local', '', '{}', '{}', now(), now(), '', '', '', '', '', '', '', '' from generate_series(1, ${missing}) g returning id, email) insert into public.profiles (id, full_name, email, role) select id, 'Pessoa de volume (fictícia)', email, 'worker' from u`,
      );
    }
    const total = Number(sql("select count(*) from public.profiles"));
    expect(total).toBeGreaterThan(1000);
    const { list, name } = await loadProfiles(admin.db);
    expect(list.length).toBe(total);
    expect(name(colleague.id)).toBe("Colega Privacidade");
  }, 60_000);

  it("toda coluna de perfis, clientes e locais está classificada como pública ou privada", () => {
    // Coluna nova nessas tabelas precisa entrar numa das listas e, se pública, ser liberada na migração dela
    // (grant select (coluna) ... to authenticated). Sem isso, ninguém a lê pela API.
    const PRIVATE: Record<string, string[]> = { profiles: ["email", "phone"], clients: ["billing_info", "notes_internal"], sites: ["notes_internal"] };
    for (const table of ["profiles", "clients", "sites"]) {
      const columns = sql(`select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_schema = 'public' and table_name = '${table}'`).split(",");
      const granted = sql(
        `select coalesce(string_agg(column_name, ',' order by column_name), '') from information_schema.column_privileges where table_schema = 'public' and table_name = '${table}' and grantee = 'authenticated' and privilege_type = 'SELECT'`,
      ).split(",");
      const expectedPublic = columns.filter((c) => !PRIVATE[table]!.includes(c));
      expect(granted, table).toEqual(expectedPublic);
    }
  });
});
