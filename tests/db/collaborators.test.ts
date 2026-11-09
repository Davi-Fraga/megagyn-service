import { beforeAll, describe, expect, it } from "vitest";
import { addMembership, createClientWithSite, createUser, serviceClient, type TestUser } from "./helpers";

/**
 * B-16 (M-10, etapa 1): a equipe lê de colegas só nome, papel e situação; e-mail e telefone só para a
 * administração e a própria pessoa. Notas internas e dados de cobrança de clientes e locais ficam fora
 * do alcance da equipe. A administração lê essas colunas pelas views profile_contacts, client_internal
 * e site_internal (parte 1); a parte 2 tira da equipe a leitura dessas colunas nas tabelas.
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

describe("B-16 — views das colunas sensíveis", () => {
  it("cada pessoa lê o próprio contato pela view; a administração lê o de todos", async () => {
    const own = await worker.db.from("profile_contacts").select("id, email").eq("id", worker.id);
    expect(own.data).toEqual([{ id: worker.id, email: worker.email }]);
    const other = await worker.db.from("profile_contacts").select("id").eq("id", colleague.id);
    expect(other.data).toEqual([]);
    const byAdmin = await admin.db.from("profile_contacts").select("id, email, phone").eq("id", colleague.id).single();
    expect(byAdmin.data).toEqual({ id: colleague.id, email: colleague.email, phone: "(00) 90000-0001" });
  });

  it("a administração lê os campos internos pelas views; a equipe não", async () => {
    const client = await admin.db.from("client_internal").select("notes_internal, billing_info").eq("id", clientId).single();
    expect(client.data).toEqual({ notes_internal: "Nota interna fictícia", billing_info: "Cobrança fictícia" });
    const site = await admin.db.from("site_internal").select("notes_internal").eq("id", siteId).single();
    expect(site.data).toEqual({ notes_internal: "Nota interna do local (fictícia)" });
    expect((await worker.db.from("client_internal").select("id").eq("id", clientId)).data).toEqual([]);
    expect((await worker.db.from("site_internal").select("id").eq("id", siteId)).data).toEqual([]);
  });
});
