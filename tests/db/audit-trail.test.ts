import { beforeAll, describe, expect, it } from "vitest";
import { addMembership, createClientWithSite, createUser, fakePhoto, serviceClient, today, uid, type TestUser } from "./helpers";

/** A-09 (B-10): ações administrativas e do Auth ficam em audit_events com o ator real. */

let admin: TestUser;
let worker: TestUser;
let foreman: TestUser;
let clientId: string;
let siteId: string;

beforeAll(async () => {
  [admin, worker, foreman] = await Promise.all([
    createUser("admin", "Admin Trilha"),
    createUser("worker", "Funcionário Trilha"),
    createUser("foreman", "Encarregado Trilha"),
  ]);
  const created = await createClientWithSite("Trilha");
  clientId = created.client.id;
  siteId = created.site.id;
  await addMembership(foreman.id, siteId);
});

const tag = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function eventsOf(entityType: string, entityId: string) {
  const { data, error } = await serviceClient()
    .from("audit_events")
    .select("actor_id, actor_role, entity_type, entity_id, action, before, after")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("id");
  if (error) throw error;
  return data;
}

/** Perfil criado como createUserAction faz: conta no Auth e linha em profiles pela chave de serviço. */
async function profileByService() {
  const svc = serviceClient();
  const email = `novo-${tag()}@teste.local`;
  const { data, error } = await svc.auth.admin.createUser({ email, password: `Senha-${tag()}!`, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser");
  const { error: pErr } = await svc.from("profiles").insert({ id: data.user.id, full_name: "Pessoa Nova (fictícia)", email, role: "worker" });
  if (pErr) throw pErr;
  return data.user.id;
}

async function newContact() {
  const { data, error } = await admin.db
    .from("client_contacts")
    .insert({ client_id: clientId, name: "Síndica (fictícia)" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

describe("ações do Auth com o ator real", () => {
  it("criar usuário grava o ator real", async () => {
    const userId = await profileByService();
    const { data: eventId, error } = await admin.db.rpc("audit_admin_action", {
      p_entity: "profiles",
      p_entity_id: userId,
      p_action: "auth_criar",
    });
    expect(error).toBeNull();
    const { data: event } = await serviceClient().from("audit_events").select("*").eq("id", eventId!).single();
    expect(event).toMatchObject({
      actor_id: admin.id,
      actor_role: "admin",
      entity_type: "profiles",
      entity_id: userId,
      action: "auth_criar",
    });
    expect((event!.after as { email?: string }).email).toMatch(/@teste\.local$/);
  });

  it("só a administração registra ação do Auth, e só ações da lista", async () => {
    const userId = await profileByService();
    const byWorker = await worker.db.rpc("audit_admin_action", { p_entity: "profiles", p_entity_id: userId, p_action: "auth_bloquear" });
    expect(byWorker.error?.code).toBe("42501");

    const badAction = await admin.db.rpc("audit_admin_action", { p_entity: "profiles", p_entity_id: userId, p_action: "apagar_tudo" });
    expect(badAction.error?.hint).toBe("action");

    const badEntity = await admin.db.rpc("audit_admin_action", { p_entity: "sites", p_entity_id: userId, p_action: "auth_bloquear" });
    expect(badEntity.error?.hint).toBe("entity");

    const unknown = await admin.db.rpc("audit_admin_action", { p_entity: "profiles", p_entity_id: uid(), p_action: "auth_bloquear" });
    expect(unknown.error?.code).toBe("P0002");

    expect((await eventsOf("profiles", userId)).filter((e) => e.action.startsWith("auth_"))).toEqual([]);
  });
});

describe("vínculo responsável do cliente × local", () => {
  it("encerrar vínculo do responsável do cliente fica na trilha", async () => {
    const contactId = await newContact();
    const add = await admin.db.from("client_contact_sites").insert({ client_contact_id: contactId, site_id: siteId });
    expect(add.error).toBeNull();
    const end = await admin.db
      .from("client_contact_sites")
      .update({ ended_at: new Date().toISOString() })
      .eq("client_contact_id", contactId)
      .eq("site_id", siteId);
    expect(end.error).toBeNull();

    const events = await eventsOf("client_contact_sites", `${contactId}:${siteId}`);
    expect(events.map((e) => [e.action, e.actor_id, e.actor_role])).toEqual([
      ["insert", admin.id, "admin"],
      ["update", admin.id, "admin"],
    ]);
    expect((events[1]!.before as { ended_at: string | null }).ended_at).toBeNull();
    expect((events[1]!.after as { ended_at: string | null }).ended_at).not.toBeNull();
    // O vínculo continua no banco, só encerrado.
    const { data: row } = await admin.db.from("client_contact_sites").select("ended_at").eq("client_contact_id", contactId).single();
    expect(row?.ended_at).not.toBeNull();
  });

  it("reabrir vínculo encerrado (upsert do app) fica na trilha com o período anterior", async () => {
    const contactId = await newContact();
    await admin.db.from("client_contact_sites").insert({ client_contact_id: contactId, site_id: siteId });
    await admin.db.from("client_contact_sites").update({ ended_at: new Date().toISOString() }).eq("client_contact_id", contactId);
    const reopen = await admin.db
      .from("client_contact_sites")
      .upsert([{ client_contact_id: contactId, site_id: siteId, ended_at: null }], { onConflict: "client_contact_id,site_id" });
    expect(reopen.error).toBeNull();

    const { data: rows } = await admin.db.from("client_contact_sites").select("ended_at").eq("client_contact_id", contactId);
    expect(rows).toEqual([{ ended_at: null }]);
    const events = await eventsOf("client_contact_sites", `${contactId}:${siteId}`);
    expect(events.map((e) => e.action)).toEqual(["insert", "update", "update"]);
    expect((events[2]!.before as { ended_at: string | null }).ended_at).not.toBeNull();
    expect((events[2]!.after as { ended_at: string | null }).ended_at).toBeNull();
  });

  it("apagar vínculo também fica na trilha", async () => {
    const contactId = await newContact();
    await admin.db.from("client_contact_sites").insert({ client_contact_id: contactId, site_id: siteId });
    const del = await admin.db.from("client_contact_sites").delete().eq("client_contact_id", contactId).eq("site_id", siteId);
    expect(del.error).toBeNull();

    const events = await eventsOf("client_contact_sites", `${contactId}:${siteId}`);
    const removed = events.find((e) => e.action === "delete");
    expect(removed).toMatchObject({ actor_id: admin.id, after: null });
    expect(removed!.before).toMatchObject({ client_contact_id: contactId, site_id: siteId });
  });
});

describe("tabelas sem trilha até a M-05", () => {
  it("atribuição de tarefa fica na trilha com chave composta", async () => {
    const { data: task, error } = await admin.db.rpc("task_create", {
      p_client_request_id: uid(),
      p_title: "Vistoria trilha (fictícia)",
      p_scheduled_date: today(),
      p_assignee_ids: [foreman.id],
      p_occurrences: [{ site_id: siteId }],
    });
    expect(error).toBeNull();
    const events = await eventsOf("task_assignments", `${task!.id}:${foreman.id}`);
    expect(events.map((e) => [e.action, e.actor_id])).toEqual([["insert", admin.id]]);
  });

  it("catálogo, setor, item de orçamento e vínculo de foto ficam na trilha", async () => {
    const t = tag();
    const { data: category, error: catErr } = await admin.db
      .from("service_categories")
      .insert({ name: `Categoria trilha ${t}` })
      .select("id")
      .single();
    expect(catErr).toBeNull();
    // Desativada logo em seguida para não aparecer nas listas de escolha.
    await admin.db.from("service_categories").update({ is_active: false }).eq("id", category!.id);
    expect((await eventsOf("service_categories", category!.id)).map((e) => [e.action, e.actor_id])).toEqual([
      ["insert", admin.id],
      ["update", admin.id],
    ]);

    const { data: area, error: areaErr } = await admin.db
      .from("site_areas")
      .insert({ site_id: siteId, name: `Hall trilha ${t}` })
      .select("id")
      .single();
    expect(areaErr).toBeNull();
    expect((await eventsOf("site_areas", area!.id)).map((e) => [e.action, e.actor_id])).toEqual([["insert", admin.id]]);

    const { data: quote, error: qErr } = await admin.db
      .from("quotes")
      .insert({ number: "", client_id: clientId, site_id: siteId, title: "Reforma trilha (teste)", created_by: admin.id })
      .select("id")
      .single();
    expect(qErr).toBeNull();
    const { data: item, error: itemErr } = await admin.db
      .from("quote_items")
      .insert({ quote_id: quote!.id, location_label: "Cobertura", pricing_mode: "global", subtotal_cents: 120000, lines: ["Reparo de calha"] })
      .select("id")
      .single();
    expect(itemErr).toBeNull();
    expect((await eventsOf("quote_items", item!.id)).map((e) => [e.action, e.actor_id])).toEqual([["insert", admin.id]]);

    const photo = await fakePhoto(admin, null, "quotes");
    const link = await admin.db.rpc("quote_link_photos", { p_quote_id: quote!.id, p_photo_ids: [photo.id], p_role: "local" });
    expect(link.error).toBeNull();
    const { data: linkRow } = await admin.db.from("attachment_links").select("id").eq("attachment_id", photo.id).single();
    const unlink = await admin.db.rpc("quote_unlink_photo", { p_quote_id: quote!.id, p_attachment_id: photo.id });
    expect(unlink.error).toBeNull();
    const linkEvents = await eventsOf("attachment_links", linkRow!.id);
    expect(linkEvents.map((e) => [e.action, e.actor_id])).toEqual([
      ["insert", admin.id],
      ["delete", admin.id],
    ]);
    expect(linkEvents[1]!.before).toMatchObject({ attachment_id: photo.id, entity_id: quote!.id });
  });
});
