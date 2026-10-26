import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { addMembership, createClientWithSite, createUser, serviceClient, today, uid, type TestUser } from "./helpers";

/** Achados da revisão independente (C1, I2, I3, I5 e menores) — cada teste falhou antes da correção. */

let admin: TestUser;
let worker: TestUser;
let foreman: TestUser;
let siteA: { id: string };

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(64).fill(0)]);

/** Anexo com arquivo real no Storage, como a rota de upload faz (chave de serviço). */
async function storedAttachment(user: TestUser, bucket: "evidence" | "receipts", siteId: string | null) {
  const svc = serviceClient();
  const id = randomUUID();
  const key = `${bucket === "evidence" ? siteId : user.id}/2026/10/${id}.jpg`;
  const up = await svc.storage.from(bucket).upload(key, JPEG, { contentType: "image/jpeg" });
  if (up.error) throw up.error;
  const { error } = await svc.from("attachments").insert({
    id,
    bucket,
    storage_key: key,
    site_id: bucket === "evidence" ? siteId : null,
    mime_type: "image/jpeg",
    size_bytes: JPEG.length,
    uploaded_by: user.id,
    client_upload_id: randomUUID(),
    visibility: bucket === "evidence" ? "client" : "internal",
  });
  if (error) throw error;
  return id;
}

beforeAll(async () => {
  [admin, worker, foreman] = await Promise.all([
    createUser("admin", "Admin Revisão"),
    createUser("worker", "Funcionário Revisão"),
    createUser("foreman", "Encarregado Revisão"),
  ]);
  siteA = (await createClientWithSite("Revisao")).site;
  await addMembership(worker.id, siteA.id);
  await addMembership(foreman.id, siteA.id);
});

describe("C1 — anexos só entram pela rota de upload", () => {
  it("usuário autenticado não insere linha em attachments pela API", async () => {
    const id = randomUUID();
    const { error } = await worker.db.from("attachments").insert({
      id,
      bucket: "evidence",
      site_id: siteA.id,
      storage_key: `${siteA.id}/2026/10/${id}.jpg`,
      mime_type: "text/html",
      size_bytes: 10,
      uploaded_by: worker.id,
      client_upload_id: randomUUID(),
    });
    expect(error).not.toBeNull();
  });

  it("anexo sem arquivo no Storage não serve de evidência", async () => {
    const svc = serviceClient();
    const id = randomUUID();
    await svc.from("attachments").insert({
      id,
      bucket: "evidence",
      site_id: siteA.id,
      storage_key: `${siteA.id}/2026/10/${id}.jpg`,
      mime_type: "image/jpeg",
      size_bytes: 10,
      uploaded_by: worker.id,
      client_upload_id: randomUUID(),
    });
    const { error } = await worker.db.rpc("work_entry_create", {
      p_client_request_id: uid(),
      p_site_id: siteA.id,
      p_activity_date: today(),
      p_description: "Foto fantasma",
      p_photo_ids: [id],
    });
    // A linha sem arquivo só existe para este teste: não pode sobrar na base (o teste de restauração a apontaria).
    await svc.from("attachments").delete().eq("id", id);
    expect(error?.hint).toBe("photos");
  });

  it("o banco recusa tipo de arquivo fora da lista, mesmo pela chave de serviço", async () => {
    const id = randomUUID();
    const { error } = await serviceClient().from("attachments").insert({
      id,
      bucket: "evidence",
      site_id: siteA.id,
      storage_key: `${siteA.id}/2026/10/${id}.html`,
      mime_type: "text/html",
      size_bytes: 10,
      uploaded_by: worker.id,
      client_upload_id: randomUUID(),
    });
    expect(error).not.toBeNull();
  });
});

describe("I3 — comprovante interno não vira foto de serviço", () => {
  it("encarregado não usa comprovante como foto de atividade", async () => {
    const receipt = await storedAttachment(foreman, "receipts", null);
    const { error } = await foreman.db.rpc("work_entry_create", {
      p_client_request_id: uid(),
      p_site_id: siteA.id,
      p_activity_date: today(),
      p_description: "Tentativa com comprovante",
      p_photo_ids: [receipt],
    });
    expect(error?.hint).toBe("photos");
  });
});

describe("I2 — foto repetida em 'fotos' e 'resultado' conta como resultado", () => {
  it("a execução fica com vínculo de resultado real", async () => {
    const { data: req } = await admin.db.rpc("request_open", {
      p_client_request_id: uid(),
      p_site_id: siteA.id,
      p_title: "Foto repetida",
      p_description: "x",
      p_requester_name: "Fictício",
    });
    await admin.db.rpc("request_schedule", { p_request_id: req!.id, p_assignee_ids: [worker.id], p_scheduled_date: today() });
    const photo = await storedAttachment(worker, "evidence", siteA.id);
    const done = await worker.db.rpc("request_mark_executed", {
      p_request_id: req!.id,
      p_client_request_id: uid(),
      p_solution: "Feito",
      p_result_photo_ids: [photo],
      p_photo_ids: [photo],
    });
    expect(done.error).toBeNull();
    const { data: entry } = await admin.db.from("work_entries").select("id").eq("service_request_id", req!.id).single();
    const { data: links } = await admin.db.from("attachment_links").select("evidence_role").eq("entity_type", "work_entry").eq("entity_id", entry!.id);
    expect(links).toEqual([{ evidence_role: "resultado" }]);
  });
});

describe("I5 — compra aprovada", () => {
  async function approvedExpense() {
    const receipt = await storedAttachment(foreman, "receipts", null);
    const { data, error } = await foreman.db.rpc("expense_save", {
      p_client_request_id: uid(),
      p_expense_date: today(),
      p_description: "Cimento",
      p_supplier_name_free: "Loja A (fictícia)",
      p_total_cents: 10000,
      p_allocations: [{ site_id: siteA.id, amount_cents: 10000, purpose: "Reboco" }],
      p_receipt_ids: [receipt],
    });
    if (error) throw error;
    await admin.db.rpc("expense_approve", { p_expense_id: data!.id });
    return data!.id;
  }

  it("qualquer edição do encarregado em compra aprovada volta para conferência", async () => {
    const id = await approvedExpense();
    const { data } = await foreman.db.rpc("expense_save", {
      p_expense_id: id,
      p_client_request_id: uid(),
      p_expense_date: today(),
      p_description: "Cimento e areia",
      p_supplier_name_free: "Loja A (fictícia)",
      p_total_cents: 10000,
      p_allocations: [{ site_id: siteA.id, amount_cents: 10000, purpose: "Reboco" }],
    });
    expect(data?.review_status).toBe("enviado_para_conferencia");
  });

  it("troca de fornecedor invalida a aprovação", async () => {
    const id = await approvedExpense();
    const { data } = await admin.db.rpc("expense_save", {
      p_expense_id: id,
      p_client_request_id: uid(),
      p_expense_date: today(),
      p_description: "Cimento",
      p_supplier_name_free: "Loja B (fictícia)",
      p_total_cents: 10000,
      p_allocations: [{ site_id: siteA.id, amount_cents: 10000, purpose: "Reboco" }],
      p_purchased_by: foreman.id,
    });
    expect(data?.review_status).toBe("enviado_para_conferencia");
  });

  it("encarregado não direciona reembolso para outra pessoa", async () => {
    const receipt = await storedAttachment(foreman, "receipts", null);
    const { error } = await foreman.db.rpc("expense_save", {
      p_client_request_id: uid(),
      p_expense_date: today(),
      p_description: "Desvio",
      p_supplier_name_free: "Loja (fictícia)",
      p_total_cents: 5000,
      p_allocations: [{ site_id: siteA.id, amount_cents: 5000, purpose: "x" }],
      p_receipt_ids: [receipt],
      p_paid_by_kind: "colaborador",
      p_paid_by_profile_id: worker.id,
    });
    expect(error?.hint).toBe("paidByProfileId");
  });
});

describe("menores", () => {
  it("cancelar tarefa ou ajustar lançamento inexistente avisa 'não encontrado'", async () => {
    const t = await admin.db.rpc("task_cancel", { p_task_id: uid(), p_reason: "x" });
    expect(t.error?.code).toBe("P0002");
    const w = await admin.db.rpc("work_entry_adjust", {
      p_work_entry_id: uid(),
      p_reason: "x",
      p_description: "x",
      p_solution: "",
      p_materials: "",
      p_hours_worked: null as never,
      p_activity_date: today(),
      p_client_visible: true,
    });
    expect(w.error?.code).toBe("P0002");
  });

  it("usuário inativo não lê nem as próprias jornadas e notificações", async () => {
    const temp = await createUser("worker", "Inativo Revisão");
    await addMembership(temp.id, siteA.id);
    await temp.db.rpc("time_entry_upsert", { p_site_id: siteA.id, p_work_date: today(), p_hours: 8 });
    await serviceClient().from("notifications").insert({ profile_id: temp.id, kind: "teste", title: "Aviso" });
    await serviceClient().from("profiles").update({ is_active: false }).eq("id", temp.id);
    expect((await temp.db.from("time_entries").select("id")).data).toEqual([]);
    expect((await temp.db.from("notifications").select("id")).data).toEqual([]);
  });
});
