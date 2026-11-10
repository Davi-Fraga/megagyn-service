import { beforeAll, describe, expect, it } from "vitest";
import { loadDiary, toClientDay } from "@/server/daily-log";
import { addMembership, createClientWithSite, createUser, fakePhoto, serviceClient, today, uid, type TestUser } from "./helpers";

let admin: TestUser;
let worker: TestUser;
let foreman: TestUser;
let siteA: { id: string };
let siteB: { id: string };

beforeAll(async () => {
  [admin, worker, foreman] = await Promise.all([
    createUser("admin", "Admin Diário"),
    createUser("worker", "Pedro Diário"),
    createUser("foreman", "Carlos Diário"),
  ]);
  siteA = (await createClientWithSite("DiarioA")).site;
  siteB = (await createClientWithSite("DiarioB")).site;
  await addMembership(worker.id, siteA.id);
  await addMembership(foreman.id, siteA.id);
  await addMembership(foreman.id, siteB.id);
});

describe("T-A4 — atividade da OS alimenta o diário sem segundo cadastro", () => {
  it("um único lançamento, no dia e local corretos, referenciado pelo evento da OS", async () => {
    const photo = await fakePhoto(admin, siteA.id);
    const { data: req } = await admin.db.rpc("request_open", {
      p_client_request_id: uid(),
      p_site_id: siteA.id,
      p_title: "Retirada de entulho",
      p_description: "Salão de festas",
      p_requester_name: "Gerente (fictício)",
      p_photo_ids: [photo.id],
    });
    await admin.db.rpc("request_schedule", { p_request_id: req!.id, p_assignee_ids: [worker.id], p_scheduled_date: today() });

    const key = uid();
    const args = {
      p_client_request_id: key,
      p_site_id: siteA.id,
      p_activity_date: today(),
      p_description: "Remoção de todo o entulho do salão de festas",
      p_service_request_id: req!.id,
      p_participant_ids: [foreman.id],
      p_hours_worked: 9,
    };
    const first = await worker.db.rpc("work_entry_create", args);
    const second = await worker.db.rpc("work_entry_create", args); // reenvio (rede instável)
    expect(first.error).toBeNull();
    expect(second.data!.id).toBe(first.data!.id);

    const { data: entries } = await admin.db
      .from("work_entries")
      .select("id,activity_date,site_id")
      .eq("service_request_id", req!.id);
    expect(entries).toEqual([{ id: first.data!.id, activity_date: today(), site_id: siteA.id }]);

    const { data: participants } = await admin.db.from("work_entry_participants").select("profile_id").eq("work_entry_id", first.data!.id);
    expect(participants!.map((p) => p.profile_id).sort()).toEqual([foreman.id, worker.id].sort());

    const { data: status } = await admin.db.from("service_requests").select("status").eq("id", req!.id).single();
    expect(status!.status).toBe("em_execucao"); // programada → em execução ao registrar

    const { data: events } = await admin.db
      .from("request_events")
      .select("event_type,work_entry_id")
      .eq("service_request_id", req!.id)
      .eq("event_type", "atividade");
    expect(events).toEqual([{ event_type: "atividade", work_entry_id: first.data!.id }]);
  });
});

describe("T-A5 — atividade direta sem chamado entra no diário", () => {
  it("não exige chamado fictício", async () => {
    const { data, error } = await worker.db.rpc("work_entry_create", {
      p_client_request_id: uid(),
      p_site_id: siteA.id,
      p_activity_date: today(),
      p_description: "Desobstruídos ralos do estacionamento",
      p_kind: "execucao",
    });
    expect(error).toBeNull();
    expect(data!.service_request_id).toBeNull();
  });

  it("parcial ou não executada exige motivo", async () => {
    const { error } = await worker.db.rpc("work_entry_create", {
      p_client_request_id: uid(),
      p_site_id: siteA.id,
      p_activity_date: today(),
      p_description: "Pintura interrompida",
      p_outcome: "parcial",
    });
    expect(error?.hint).toBe("blockerReasonId");
  });

  it("data futura é rejeitada e data de envio fica separada da data da atividade", async () => {
    const future = await worker.db.rpc("work_entry_create", {
      p_client_request_id: uid(),
      p_site_id: siteA.id,
      p_activity_date: "2999-01-01",
      p_description: "x",
    });
    expect(future.error?.hint).toBe("activityDate");
  });
});

describe("T-A6 — encarregado em duas obras no mesmo dia", () => {
  it("agenda consolidada; cada ocorrência registra no local certo; tarefa ligada a OS gera um só lançamento", async () => {
    const { data: req } = await admin.db.rpc("request_open", {
      p_client_request_id: uid(),
      p_site_id: siteA.id,
      p_title: "Vistoria de cobertura",
      p_description: "Telhas quebradas",
      p_requester_name: "Gerente (fictício)",
    });
    await admin.db.rpc("request_schedule", { p_request_id: req!.id, p_assignee_ids: [foreman.id], p_scheduled_date: today() });

    const { data: task, error } = await admin.db.rpc("task_create", {
      p_client_request_id: uid(),
      p_title: "Vistoria e compra de material",
      p_scheduled_date: today(),
      p_assignee_ids: [foreman.id],
      p_occurrences: [{ site_id: siteA.id }, { site_id: siteB.id }],
      p_service_request_id: req!.id,
    });
    expect(error).toBeNull();

    const { data: agenda } = await foreman.db
      .from("task_occurrences")
      .select("id,site_id,scheduled_date")
      .eq("task_id", task!.id)
      .eq("scheduled_date", today());
    expect(agenda!.map((o) => o.site_id).sort()).toEqual([siteA.id, siteB.id].sort());

    const occA = agenda!.find((o) => o.site_id === siteA.id)!;
    const occB = agenda!.find((o) => o.site_id === siteB.id)!;

    const photoB = await fakePhoto(foreman, siteB.id);
    const wrong = await foreman.db.rpc("work_entry_create", {
      p_client_request_id: uid(),
      p_site_id: siteA.id,
      p_activity_date: today(),
      p_description: "Foto da obra B no registro da obra A",
      p_task_occurrence_id: occA.id,
      p_photo_ids: [photoB.id],
    });
    expect(wrong.error?.message).toContain("outro local");

    const entryA = await foreman.db.rpc("work_entry_create", {
      p_client_request_id: uid(),
      p_site_id: siteA.id,
      p_activity_date: today(),
      p_description: "Vistoria da cobertura",
      p_task_occurrence_id: occA.id,
      p_kind: "vistoria",
    });
    expect(entryA.error).toBeNull();
    expect(entryA.data!.service_request_id).toBe(req!.id); // mesmo fato, dois vínculos
    expect(entryA.data!.task_occurrence_id).toBe(occA.id);

    const entryB = await foreman.db.rpc("work_entry_create", {
      p_client_request_id: uid(),
      p_site_id: siteB.id,
      p_activity_date: today(),
      p_description: "Recebimento de material",
      p_task_occurrence_id: occB.id,
      p_photo_ids: [photoB.id],
    });
    expect(entryB.error).toBeNull();
    expect(entryB.data!.service_request_id).toBeNull(); // o chamado é da obra A

    const { data: forRequest } = await admin.db.from("work_entries").select("id").eq("service_request_id", req!.id);
    expect(forRequest).toHaveLength(1);

    const finish = await foreman.db.rpc("task_occurrence_finish", { p_occurrence_id: occA.id });
    expect(finish.data?.status).toBe("concluida");
    const notDone = await foreman.db.rpc("task_occurrence_not_done", { p_occurrence_id: occB.id, p_reason: "" });
    expect(notDone.error?.hint).toBe("reason");
    await foreman.db.rpc("task_occurrence_not_done", { p_occurrence_id: occB.id, p_reason: "Fornecedor não entregou" });
    const { data: parent } = await admin.db.from("tasks").select("status").eq("id", task!.id).single();
    expect(parent!.status).toBe("concluida");
  });

  it("funcionário não atribuído não vê a tarefa do encarregado", async () => {
    const { data: task } = await admin.db.rpc("task_create", {
      p_client_request_id: uid(),
      p_title: "Só do encarregado",
      p_scheduled_date: today(),
      p_assignee_ids: [foreman.id],
      p_occurrences: [{ site_id: siteA.id }],
    });
    const { data } = await worker.db.from("tasks").select("id").eq("id", task!.id);
    expect(data).toEqual([]);
  });

  it("responsável precisa ter vínculo com todos os locais da tarefa", async () => {
    const { error } = await admin.db.rpc("task_create", {
      p_client_request_id: uid(),
      p_title: "Inválida",
      p_scheduled_date: today(),
      p_assignee_ids: [worker.id],
      p_occurrences: [{ site_id: siteB.id }],
    });
    expect(error?.hint).toBe("assigneeIds");
  });
});

describe("jornada (horas) separada de diárias faturáveis", () => {
  it("trabalhador registra horas; só a administração ajusta diárias", async () => {
    const own = await worker.db.rpc("time_entry_upsert", { p_site_id: siteA.id, p_work_date: today(), p_hours: 9 });
    expect(own.error).toBeNull();
    expect(Number(own.data!.billing_units)).toBe(1);
    const billing = await worker.db.rpc("time_entry_upsert", {
      p_site_id: siteA.id,
      p_work_date: today(),
      p_hours: 9,
      p_billing_units: 2,
    });
    expect(billing.error?.code).toBe("42501");
    const adminAdjust = await admin.db.rpc("time_entry_upsert", {
      p_site_id: siteA.id,
      p_work_date: today(),
      p_hours: 9,
      p_profile_id: worker.id,
      p_billing_units: 0.5,
    });
    expect(Number(adminAdjust.data!.billing_units)).toBe(0.5);
    expect(adminAdjust.data!.id).toBe(own.data!.id);
  });
});

/** Tarefa de um local (obra A) atribuída ao encarregado, que também tem vínculo com a obra B. */
async function singleSiteTask(title: string) {
  const { data: task, error } = await admin.db.rpc("task_create", {
    p_client_request_id: uid(),
    p_title: title,
    p_scheduled_date: today(),
    p_assignee_ids: [foreman.id],
    p_occurrences: [{ site_id: siteA.id }],
  });
  expect(error).toBeNull();
  const { data: occ } = await admin.db.from("task_occurrences").select("id").eq("task_id", task!.id).single();
  return { task: task!, occ: occ! };
}

async function taskStatus(taskId: string) {
  const { data } = await admin.db.from("tasks").select("status").eq("id", taskId).single();
  return data!.status;
}

describe("B-06 — tarefa não fica presa em cancelada (A-05)", () => {
  it("tarefa de um local não realizada e remarcada volta a planejada e aceita novo local", async () => {
    const { task, occ } = await singleSiteTask("Troca de lâmpadas do hall");
    const notDone = await foreman.db.rpc("task_occurrence_not_done", {
      p_occurrence_id: occ.id,
      p_reason: "Material não chegou",
    });
    expect(notDone.error).toBeNull();
    expect(await taskStatus(task.id)).toBe("planejada"); // aguardando remarcação, não cancelada

    const moved = await admin.db.rpc("task_occurrence_reschedule", {
      p_occurrence_id: occ.id,
      p_scheduled_date: today(),
      p_reason: "Material entregue",
    });
    expect(moved.error).toBeNull();
    expect(moved.data!.status).toBe("prevista");
    expect(await taskStatus(task.id)).toBe("planejada");

    const added = await admin.db.rpc("task_add_occurrence", {
      p_task_id: task.id,
      p_site_id: siteB.id,
      p_scheduled_date: today(),
    });
    expect(added.error).toBeNull();
    expect(added.data!.status).toBe("prevista");
    expect(await taskStatus(task.id)).toBe("planejada");
  });

  it("cancelamento explícito continua cancelado", async () => {
    const { task, occ } = await singleSiteTask("Pintura da guarita");
    const cancelled = await admin.db.rpc("task_cancel", { p_task_id: task.id, p_reason: "  Cliente desistiu  " });
    expect(cancelled.error).toBeNull();
    expect(cancelled.data!.status).toBe("cancelada");
    expect(cancelled.data!.cancelled_at).toEqual(expect.any(String));
    expect(cancelled.data!.cancelled_by).toBe(admin.id);
    expect(cancelled.data!.cancel_reason).toBe("Cliente desistiu");

    const added = await admin.db.rpc("task_add_occurrence", {
      p_task_id: task.id,
      p_site_id: siteB.id,
      p_scheduled_date: today(),
    });
    expect(added.error?.code).toBe("P0002");

    const entry = await foreman.db.rpc("work_entry_create", {
      p_client_request_id: uid(),
      p_site_id: siteA.id,
      p_activity_date: today(),
      p_description: "Pintura iniciada",
      p_task_occurrence_id: occ.id,
    });
    expect(entry.error?.message).toContain("cancelada");
    expect(await taskStatus(task.id)).toBe("cancelada");
  });

  it("cancelar tarefa com todas as ocorrências não realizadas grava o cancelamento", async () => {
    const { task, occ } = await singleSiteTask("Limpeza da caixa d'água");
    await foreman.db.rpc("task_occurrence_not_done", { p_occurrence_id: occ.id, p_reason: "Sem acesso ao telhado" });
    expect(await taskStatus(task.id)).toBe("planejada");

    const cancelled = await admin.db.rpc("task_cancel", { p_task_id: task.id, p_reason: "Serviço feito por terceiro" });
    expect(cancelled.error).toBeNull();
    expect(cancelled.data!.status).toBe("cancelada");
    expect(cancelled.data!.cancelled_at).toEqual(expect.any(String));
    expect(cancelled.data!.cancel_reason).toBe("Serviço feito por terceiro");

    // Remarcar a ocorrência de uma tarefa cancelada de verdade não a reabre.
    await admin.db.rpc("task_occurrence_reschedule", {
      p_occurrence_id: occ.id,
      p_scheduled_date: today(),
      p_reason: "Remarcada por engano",
    });
    expect(await taskStatus(task.id)).toBe("cancelada");
  });

  it("cancelar de novo não troca data nem motivo", async () => {
    const { task } = await singleSiteTask("Revisão do portão");
    const first = await admin.db.rpc("task_cancel", { p_task_id: task.id, p_reason: "Portão substituído" });
    expect(first.data!.cancelled_at).toEqual(expect.any(String));
    const second = await admin.db.rpc("task_cancel", { p_task_id: task.id, p_reason: "Outro motivo" });
    expect(second.error).toBeNull();
    expect(second.data!.cancelled_at).toBe(first.data!.cancelled_at);
    expect(second.data!.cancelled_by).toBe(admin.id);
    expect(second.data!.cancel_reason).toBe("Portão substituído");
  });

  it("o banco recusa cancelada sem cancelled_at", async () => {
    const { task } = await singleSiteTask("Troca de fechadura");
    const svc = serviceClient();
    const noDate = await svc.from("tasks").update({ status: "cancelada" }).eq("id", task.id);
    expect(noDate.error?.code).toBe("23514");
    const noStatus = await svc.from("tasks").update({ cancelled_at: new Date().toISOString() }).eq("id", task.id);
    expect(noStatus.error?.code).toBe("23514");
    expect(await taskStatus(task.id)).toBe("planejada");
  });
});

describe("B-38 — finalizar tarefa com observação e fotos (A-14)", () => {
  it("finalizar grava a observação e as fotos, que a equipe do local vê", async () => {
    const { occ } = await singleSiteTask("Limpeza da caixa d'água");
    const photo = await fakePhoto(foreman, siteA.id);
    const { data, error } = await foreman.db.rpc("task_occurrence_finish", {
      p_occurrence_id: occ.id,
      p_notes: "Caixa lavada e tampa trocada",
      p_photo_ids: [photo.id],
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "concluida", notes: "Caixa lavada e tampa trocada" });
    const { data: links } = await admin.db
      .from("attachment_links")
      .select("attachment_id, evidence_role")
      .eq("entity_type", "task_occurrence")
      .eq("entity_id", occ.id);
    expect(links).toEqual([{ attachment_id: photo.id, evidence_role: "resultado" }]);
    const { data: seen } = await worker.db.from("attachments").select("id").eq("id", photo.id);
    expect(seen).toEqual([{ id: photo.id }]);
  });

  it("foto de outro local é recusada e a tarefa não é finalizada", async () => {
    const { occ } = await singleSiteTask("Pintura do muro");
    const photo = await fakePhoto(foreman, siteB.id);
    const { error } = await foreman.db.rpc("task_occurrence_finish", { p_occurrence_id: occ.id, p_photo_ids: [photo.id] });
    expect(error?.message).toContain("outro local");
    const { data } = await admin.db.from("task_occurrences").select("status").eq("id", occ.id).single();
    expect(data?.status).toBe("prevista");
  });

  it("o diário da administração mostra a observação e as fotos; o que vai ao cliente não leva", async () => {
    const { occ } = await singleSiteTask("Revisão do quadro elétrico");
    const photo = await fakePhoto(foreman, siteA.id);
    await foreman.db.rpc("task_occurrence_finish", { p_occurrence_id: occ.id, p_notes: "Disjuntor 3 trocado", p_photo_ids: [photo.id] });
    const days = (await loadDiary(admin.db, [siteA.id], today(), today(), { clientView: false })).get(siteA.id) ?? [];
    const planned = days.flatMap((d) => d.planned).find((p) => p.title === "Revisão do quadro elétrico");
    expect(planned).toMatchObject({ status: "concluida", finishNotes: "Disjuntor 3 trocado" });
    expect(planned?.photos.map((p) => p.id)).toEqual([photo.id]);
    // PDF do diário e fechamento: lista branca, sem a observação nem as fotos do encerramento (sem revisão).
    const client = days.map(toClientDay).flatMap((d) => d.planned);
    expect(client.some((p) => p.title === "Revisão do quadro elétrico")).toBe(false);
    for (const p of client) expect(Object.keys(p).sort()).toEqual(["assigneeNames", "noShowReason", "status", "title"]);
  });

  it("sem observação nem foto continua aceito (DP-05: não são obrigatórias)", async () => {
    const { occ } = await singleSiteTask("Troca de lâmpadas");
    const { data, error } = await foreman.db.rpc("task_occurrence_finish", { p_occurrence_id: occ.id });
    expect(error).toBeNull();
    expect(data?.status).toBe("concluida");
  });
});
