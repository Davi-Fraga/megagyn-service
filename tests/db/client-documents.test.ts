import { beforeAll, describe, expect, it } from "vitest";
import { addMembership, createClientWithSite, createUser, serviceClient, uid, type TestUser } from "./helpers";

/**
 * B-18 (M-12): documentos e fotos cadastrais do cliente, no bucket privado de cadastros. Só a
 * administração anexa e lê; a equipe do local não baixa. Inativar o cliente pede motivo e fica na trilha.
 */

let admin: TestUser;
let worker: TestUser;
let clientId: string;
let siteId: string;

beforeAll(async () => {
  [admin, worker] = await Promise.all([createUser("admin", "Admin Documentos"), createUser("worker", "Funcionário Documentos")]);
  const created = await createClientWithSite("Documentos");
  clientId = created.client.id;
  siteId = created.site.id;
  await addMembership(worker.id, siteId);
});

/** Anexo gravado como a rota de upload grava; para o banco, o arquivo em si não importa. */
async function storedFile(mime = "application/pdf", bucket: "registry" | "evidence" = "registry") {
  const { data, error } = await serviceClient()
    .from("attachments")
    .insert({
      bucket,
      storage_key: `${admin.id}/2026/11/${uid()}.${mime === "application/pdf" ? "pdf" : "jpg"}`,
      mime_type: mime,
      size_bytes: 1000,
      uploaded_by: admin.id,
      client_upload_id: uid(),
      visibility: "internal",
      site_id: bucket === "evidence" ? siteId : null,
      original_name: "documento-ficticio.pdf",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id;
}

const attach = (user: TestUser, ids: string[], role: string = "documento", category: string | null = "Contrato", client = clientId) =>
  user.db.rpc("client_attach_documents", {
    p_client_id: client,
    p_attachment_ids: ids,
    p_role: role as "documento",
    ...(category ? { p_category: category } : {}),
  });

describe("B-18 — documentos e fotos do cliente", () => {
  it("a administração anexa documento e foto cadastral ao cliente, com categoria", async () => {
    const doc = await storedFile();
    const photo = await storedFile("image/jpeg");
    expect((await attach(admin, [doc])).error).toBeNull();
    expect((await attach(admin, [photo], "foto_cadastral", null)).error).toBeNull();
    const { data } = await admin.db
      .from("attachment_links")
      .select("attachment_id, evidence_role, category")
      .eq("entity_type", "client")
      .eq("entity_id", clientId);
    expect(data).toEqual(
      expect.arrayContaining([
        { attachment_id: doc, evidence_role: "documento", category: "Contrato" },
        { attachment_id: photo, evidence_role: "foto_cadastral", category: null },
      ]),
    );
  });

  it("funcionário com acesso ao local não baixa documento do cliente", async () => {
    const doc = await storedFile();
    expect((await attach(admin, [doc])).error).toBeNull();
    expect((await worker.db.from("attachments").select("id").eq("id", doc)).data).toEqual([]);
    expect((await worker.db.from("attachment_links").select("id").eq("entity_type", "client").eq("entity_id", clientId)).data).toEqual([]);
    expect((await attach(worker, [await storedFile()])).error?.code).toBe("42501");
  });

  it("só anexo do cadastro, ainda solto, vira documento do cliente", async () => {
    const evidence = await storedFile("image/jpeg", "evidence");
    expect((await attach(admin, [evidence])).error?.hint).toBe("attachmentIds");
    const doc = await storedFile();
    expect((await attach(admin, [doc])).error).toBeNull();
    const other = await createClientWithSite("Documentos B");
    expect((await attach(admin, [doc], "documento", null, other.client.id)).error?.hint).toBe("attachmentIds");
    expect((await attach(admin, [await storedFile()], "inicial")).error?.hint).toBe("role");
  });

  it("inativar pede motivo e fica na trilha com ele", async () => {
    const { client } = await createClientWithSite("Inativação");
    const blank = await admin.db.rpc("client_set_active", { p_client_id: client.id, p_active: false, p_reason: " " });
    expect(blank.error?.hint).toBe("reason");
    const ok = await admin.db.rpc("client_set_active", { p_client_id: client.id, p_active: false, p_reason: "Contrato encerrado (fictício)" });
    expect(ok.error).toBeNull();
    const svc = serviceClient();
    expect((await svc.from("clients").select("is_active").eq("id", client.id).single()).data!.is_active).toBe(false);
    const { data: events } = await svc
      .from("audit_events")
      .select("action, actor_id, reason")
      .eq("entity_type", "clients")
      .eq("entity_id", client.id)
      .eq("action", "update");
    expect(events).toEqual(expect.arrayContaining([{ action: "update", actor_id: admin.id, reason: "Contrato encerrado (fictício)" }]));
    const byWorker = await worker.db.rpc("client_set_active", { p_client_id: client.id, p_active: true, p_reason: "Teste" });
    expect(byWorker.error?.code).toBe("42501");
  });
});
