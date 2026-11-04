import { beforeAll, describe, expect, it } from "vitest";
import { FIELD_OCCURRENCE_SELECT, fieldRequestsQuery } from "@/server/field-queries";
import { addMembership, createClientWithSite, createUser, serviceClient, today, uid, type TestUser } from "./helpers";

let admin: TestUser;
let foreman: TestUser;
let siteId: string;

beforeAll(async () => {
  [admin, foreman] = await Promise.all([createUser("admin", "Admin Consultas"), createUser("foreman", "Encarregado Consultas")]);
  siteId = (await createClientWithSite("Consultas")).site.id;
  await addMembership(foreman.id, siteId);
});

describe("consultas da tela de tarefa do campo", () => {
  it("encarregado abre a ocorrência da tarefa (sem embed ambíguo)", async () => {
    const created = await admin.db.rpc("task_create", {
      p_title: "Vistoria consultas",
      p_occurrences: [{ site_id: siteId }],
      p_assignee_ids: [foreman.id],
      p_scheduled_date: today(),
      p_client_request_id: uid(),
    });
    expect(created.error).toBeNull();
    const { data: occ } = await foreman.db.from("task_occurrences").select("id").eq("site_id", siteId).limit(1).single();
    const { data, error } = await foreman.db.from("task_occurrences").select(FIELD_OCCURRENCE_SELECT).eq("id", occ!.id).maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(occ!.id);
  });
});

describe("chamados atribuídos no campo (A-04)", () => {
  it("o chamado atribuído aparece mesmo com mais de 100 chamados ativos no local", async () => {
    const worker = await createUser("worker", "Funcionário Volume");
    const { client, site } = await createClientWithSite("Volume campo");
    await addMembership(worker.id, site.id);
    const tag = Date.now().toString().slice(-6);
    const start = Date.now() - 200 * 86_400_000;
    const rows = Array.from({ length: 150 }, (_, i) => ({
      number: `2026-8${tag}${String(i).padStart(4, "0")}`,
      client_id: client.id,
      site_id: site.id,
      origin: "cliente_externo" as const,
      requester_name: "Fictício",
      title: `Volume ${i}`,
      description: "x",
      status: "programada" as const,
      scheduled_date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
      client_request_id: uid(),
      created_by: admin.id,
    }));
    const { data: inserted, error } = await serviceClient().from("service_requests").insert(rows).select("id, title");
    expect(error).toBeNull();
    // O mais recente: na ordem por data, fica depois dos 100 primeiros.
    const last = inserted!.find((r) => r.title === "Volume 149")!;
    const assigned = await serviceClient().from("request_assignments").insert({ service_request_id: last.id, profile_id: worker.id });
    expect(assigned.error).toBeNull();

    const { data, error: queryError } = await fieldRequestsQuery(worker.db, ["programada"], worker.id).order("scheduled_date").limit(100);
    expect(queryError).toBeNull();
    expect(data?.map((r) => r.id)).toEqual([last.id]);

    // Sem filtro de pessoa, a mesma consulta traz todos os chamados visíveis do local.
    const all = await fieldRequestsQuery(worker.db, ["programada"], null).eq("site_id", site.id);
    expect(all.data).toHaveLength(150);

    // Atribuição encerrada não conta.
    await serviceClient().from("request_assignments").update({ unassigned_at: new Date().toISOString() }).eq("service_request_id", last.id);
    const after = await fieldRequestsQuery(worker.db, ["programada"], worker.id);
    expect(after.data).toEqual([]);
  }, 60_000);
});
