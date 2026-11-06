import { beforeAll, describe, expect, it } from "vitest";
import { computeClosing } from "@/server/closings";
import { addMembership, createClientWithSite, createUser, fakePhoto, serviceClient, uid, type TestUser } from "./helpers";

/** R-20: foto removida sai das telas e dos relatórios novos, mas fica no histórico. */

let admin: TestUser;
let worker: TestUser;
let clientId: string;
let siteId: string;

beforeAll(async () => {
  [admin, worker] = await Promise.all([createUser("admin", "Admin Remoção"), createUser("worker", "Funcionário Remoção")]);
  const created = await createClientWithSite("Remocao");
  clientId = created.client.id;
  siteId = created.site.id;
  await addMembership(worker.id, siteId);
});

async function requestWithPhoto() {
  const photo = await fakePhoto(admin, siteId);
  const { data, error } = await admin.db.rpc("request_open", {
    p_client_request_id: uid(),
    p_site_id: siteId,
    p_title: "Infiltração (fictícia)",
    p_description: "Mancha no teto",
    p_origin: "cliente_externo",
    p_channel: "whatsapp",
    p_requester_name: "Síndica (fictícia)",
    p_photo_ids: [photo.id],
  });
  if (error) throw error;
  return { request: data, photo };
}

describe("alcance da foto removida (A-02)", () => {
  it("funcionário deixa de ler a foto removida e o vínculo dela; a administração continua lendo", async () => {
    const { photo } = await requestWithPhoto();
    const before = await worker.db.from("attachments").select("id").eq("id", photo.id);
    expect(before.data).toHaveLength(1);

    const { error } = await admin.db.rpc("attachment_revoke", { p_attachment_id: photo.id, p_reason: "Foto de outra obra" });
    expect(error).toBeNull();

    const after = await worker.db.from("attachments").select("id").eq("id", photo.id);
    expect(after.data).toEqual([]);
    const links = await worker.db.from("attachment_links").select("attachment_id").eq("attachment_id", photo.id);
    expect(links.data).toEqual([]);
    const adminView = await admin.db.from("attachments").select("revoked_at").eq("id", photo.id).single();
    expect(adminView.data?.revoked_at).not.toBeNull();
  });
});

describe("remover foto", () => {
  it("admin remove foto com motivo: grava evento anexo_revogado e mantém o arquivo", async () => {
    const { request, photo } = await requestWithPhoto();
    const { error } = await admin.db.rpc("attachment_revoke", { p_attachment_id: photo.id, p_reason: "Foto de outra obra" });
    expect(error).toBeNull();
    const svc = serviceClient();
    const { data: att } = await svc.from("attachments").select("revoked_at, revoke_reason, storage_key").eq("id", photo.id).single();
    expect(att?.revoked_at).not.toBeNull();
    expect(att?.revoke_reason).toBe("Foto de outra obra");
    const { data: events } = await svc.from("request_events").select("event_type, reason").eq("service_request_id", request.id).eq("event_type", "anexo_revogado");
    expect(events).toEqual([{ event_type: "anexo_revogado", reason: "Foto de outra obra" }]);
    const file = await svc.storage.from("evidence").download(att!.storage_key);
    expect(file.error).toBeNull();
  });

  it("funcionário não remove foto", async () => {
    const { photo } = await requestWithPhoto();
    const { error } = await worker.db.rpc("attachment_revoke", { p_attachment_id: photo.id, p_reason: "Engano" });
    expect(error?.code).toBe("42501");
  });

  it("motivo vazio é recusado", async () => {
    const { photo } = await requestWithPhoto();
    const { error } = await admin.db.rpc("attachment_revoke", { p_attachment_id: photo.id, p_reason: "  " });
    expect(error?.hint).toBe("reason");
  });

  it("segunda remoção avisa que já foi removido", async () => {
    const { photo } = await requestWithPhoto();
    await admin.db.rpc("attachment_revoke", { p_attachment_id: photo.id, p_reason: "Engano" });
    const { error } = await admin.db.rpc("attachment_revoke", { p_attachment_id: photo.id, p_reason: "Engano de novo" });
    expect(error?.message).toBe("Anexo não encontrado ou já removido.");
  });

  it("prévia do fechamento deixa de trazer a foto removida e a versão emitida não muda", async () => {
    const photo = await fakePhoto(admin, siteId);
    const { error: entryError } = await admin.db.rpc("work_entry_create", {
      p_client_request_id: uid(),
      p_site_id: siteId,
      p_activity_date: "2026-08-10",
      p_description: "Pintura da fachada",
      p_photo_ids: [photo.id],
    });
    if (entryError) throw entryError;
    const params = { clientId, siteId, year: 2026, month: 8, includeBilling: false };
    const photoIds = (payload: unknown) => (JSON.stringify(payload).includes(photo.id) ? [photo.id] : []);

    const first = await computeClosing(admin.db, params);
    expect(photoIds(first.payload)).toEqual([photo.id]);
    const { data: closing } = await admin.db
      .from("monthly_closings")
      .insert({ client_id: clientId, site_id: siteId, period_year: 2026, period_month: 8, created_by: admin.id })
      .select("id")
      .single();
    const version = await admin.db.rpc("closing_version_create", {
      p_closing_id: closing!.id,
      p_cutoff_at: first.payload.period.cutoffUtc,
      p_period_start: first.payload.period.startUtc,
      p_criteria: { includeBilling: false },
      p_header: first.header as never,
      p_payload: first.payload as never,
      p_summary: first.payload.summary as never,
    });
    expect(version.error).toBeNull();

    await admin.db.rpc("attachment_revoke", { p_attachment_id: photo.id, p_reason: "Foto errada" });

    const after = await computeClosing(admin.db, params);
    expect(photoIds(after.payload)).toEqual([]);
    const { data: frozen } = await admin.db.from("closing_versions").select("payload").eq("id", version.data!.id).single();
    expect(photoIds(frozen?.payload)).toEqual([photo.id]);
  });
});
