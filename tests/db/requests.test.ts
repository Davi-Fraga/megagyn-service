import { beforeAll, describe, expect, it } from "vitest";
import {
  addMembership,
  catalogId,
  createClientWithSite,
  createUser,
  fakePhoto,
  serviceClient,
  sql,
  today,
  uid,
  type TestUser,
} from "./helpers";

let admin: TestUser;
let worker: TestUser;
let foreman: TestUser;
let outsider: TestUser;
let siteA: { id: string; client_id: string };
let siteB: { id: string; client_id: string };
let pendingReasonId: string;

beforeAll(async () => {
  [admin, worker, foreman, outsider] = await Promise.all([
    createUser("admin", "Admin Teste"),
    createUser("worker", "João Teste"),
    createUser("foreman", "Carlos Teste"),
    createUser("worker", "Fora Teste"),
  ]);
  siteA = (await createClientWithSite("A")).site;
  siteB = (await createClientWithSite("B")).site;
  await addMembership(worker.id, siteA.id);
  await addMembership(foreman.id, siteA.id);
  await addMembership(outsider.id, siteB.id);
  pendingReasonId = await catalogId("pending_reasons", "Falta de material");
});

async function openRequest(extra: Record<string, unknown> = {}) {
  const photo = await fakePhoto(admin, siteA.id);
  const { data, error } = await admin.db.rpc("request_open", {
    p_client_request_id: uid(),
    p_site_id: siteA.id,
    p_title: "Vazamento no subsolo",
    p_description: "Cano de água potável pingando",
    p_origin: "cliente_externo",
    p_channel: "whatsapp",
    p_requester_name: "Síndica (fictícia)",
    p_photo_ids: [photo.id],
    ...extra,
  });
  if (error) throw error;
  return data;
}

async function schedule(requestId: string, assignees: string[] = [worker.id]) {
  const { data, error } = await admin.db.rpc("request_schedule", {
    p_request_id: requestId,
    p_assignee_ids: assignees,
    p_scheduled_date: today(),
  });
  if (error) throw error;
  return data;
}

describe("T-A1 — administrador abre chamado em nome do cliente", () => {
  it("nasce Aberta com número único, foto inicial e evento de abertura", async () => {
    const r = await openRequest();
    expect(r.status).toBe("aberta");
    expect(r.number).toMatch(/^\d{4}-\d{6}$/);
    expect(r.origin).toBe("cliente_externo");
    expect(r.requester_name).toBe("Síndica (fictícia)");

    const { data: events } = await admin.db.from("request_events").select("event_type,to_status").eq("service_request_id", r.id);
    expect(events).toEqual([{ event_type: "abertura", to_status: "aberta" }]);
    const { data: links } = await admin.db
      .from("attachment_links")
      .select("evidence_role")
      .eq("entity_type", "service_request")
      .eq("entity_id", r.id);
    expect(links).toEqual([{ evidence_role: "inicial" }]);
  });

  it("clique duplo com o mesmo identificador não cria outro chamado (T-A17)", async () => {
    const key = uid();
    const args = { p_client_request_id: key, p_site_id: siteA.id, p_title: "Teste", p_description: "x", p_requester_name: "Fulano" };
    const [a, b] = await Promise.all([admin.db.rpc("request_open", args), admin.db.rpc("request_open", args)]);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(a.data!.id).toBe(b.data!.id);
  });

  it("exige solicitante quando a origem é o cliente", async () => {
    const { error } = await admin.db.rpc("request_open", {
      p_client_request_id: uid(),
      p_site_id: siteA.id,
      p_title: "Sem solicitante",
      p_description: "x",
    });
    expect(error?.hint).toBe("requesterName");
  });

  it("equipe de campo não abre chamado (somente atividade avulsa)", async () => {
    const { error } = await worker.db.rpc("request_open", {
      p_client_request_id: uid(),
      p_site_id: siteA.id,
      p_title: "x",
      p_description: "x",
      p_requester_name: "x",
    });
    expect(error?.code).toBe("42501");
  });
});

describe("T-A2 — triagem, execução com evidência e validação", () => {
  it("bloqueia Executada sem solução ou sem foto do resultado e só o admin valida", async () => {
    const r = await openRequest();

    const notMember = await admin.db.rpc("request_schedule", {
      p_request_id: r.id,
      p_assignee_ids: [outsider.id],
      p_scheduled_date: today(),
    });
    expect(notMember.error?.hint).toBe("assigneeIds");

    expect((await schedule(r.id)).status).toBe("programada");
    const started = await worker.db.rpc("request_start", { p_request_id: r.id });
    expect(started.data?.status).toBe("em_execucao");

    const noPhoto = await worker.db.rpc("request_mark_executed", {
      p_request_id: r.id,
      p_client_request_id: uid(),
      p_solution: "Troca da luva",
      p_result_photo_ids: [],
    });
    expect(noPhoto.error?.hint).toBe("resultPhotoIds");

    const photo = await fakePhoto(worker, siteA.id);
    const noSolution = await worker.db.rpc("request_mark_executed", {
      p_request_id: r.id,
      p_client_request_id: uid(),
      p_solution: "   ",
      p_result_photo_ids: [photo.id],
    });
    expect(noSolution.error?.hint).toBe("solution");

    const otherSitePhoto = await fakePhoto(admin, siteB.id);
    const wrongSite = await admin.db.rpc("request_mark_executed", {
      p_request_id: r.id,
      p_client_request_id: uid(),
      p_solution: "Troca",
      p_result_photo_ids: [otherSitePhoto.id],
    });
    expect(wrongSite.error?.message).toContain("outro local");

    const executed = await worker.db.rpc("request_mark_executed", {
      p_request_id: r.id,
      p_client_request_id: uid(),
      p_solution: "Substituída a luva de 50 mm",
      p_result_photo_ids: [photo.id],
      p_hours_worked: 2,
    });
    expect(executed.error).toBeNull();
    expect(executed.data?.status).toBe("executada");

    const workerValidates = await worker.db.rpc("request_validate", { p_request_id: r.id });
    expect(workerValidates.error?.code).toBe("42501");

    const validated = await admin.db.rpc("request_validate", { p_request_id: r.id });
    expect(validated.data?.status).toBe("concluida");
    expect(validated.data?.closed_at).not.toBeNull();

    const { data: entries } = await admin.db.from("work_entries").select("id,solution,service_request_id").eq("service_request_id", r.id);
    expect(entries).toHaveLength(1);
    const { data: resultLinks } = await admin.db
      .from("attachment_links")
      .select("evidence_role")
      .eq("entity_type", "work_entry")
      .eq("entity_id", entries![0]!.id);
    expect(resultLinks).toEqual([{ evidence_role: "resultado" }]);
  });

  it("devolução para correção exige motivo e volta para Em execução", async () => {
    const r = await openRequest();
    await schedule(r.id);
    const photo = await fakePhoto(worker, siteA.id);
    await worker.db.rpc("request_mark_executed", {
      p_request_id: r.id,
      p_client_request_id: uid(),
      p_solution: "Feito",
      p_result_photo_ids: [photo.id],
    });
    expect((await admin.db.rpc("request_return", { p_request_id: r.id, p_reason: "" })).error?.hint).toBe("reason");
    const back = await admin.db.rpc("request_return", { p_request_id: r.id, p_reason: "Foto não mostra o registro" });
    expect(back.data?.status).toBe("em_execucao");
  });

  it("a situação não muda por atualização direta na tabela", async () => {
    const r = await openRequest();
    await admin.db.from("service_requests").update({ status: "concluida" }).eq("id", r.id);
    const { data } = await admin.db.from("service_requests").select("status").eq("id", r.id).single();
    expect(data?.status).toBe("aberta");

    const svc = await serviceClient().from("service_requests").update({ status: "concluida" }).eq("id", r.id);
    expect(svc.error?.message).toContain("ações do sistema");
  });
});

describe("T-A3 — pendência e retomada", () => {
  it("exige motivo, explicação, providência, responsável e previsão; retoma sem apagar histórico", async () => {
    const r = await openRequest();
    await schedule(r.id);

    const missing = await worker.db.rpc("request_report_pending", {
      p_request_id: r.id,
      p_client_request_id: uid(),
      p_pending_reason_id: pendingReasonId,
      p_explanation: "Faltou luva",
      p_next_action: "",
      p_next_action_owner_id: foreman.id,
      p_expected_return_date: today(),
    });
    expect(missing.error?.hint).toBe("nextAction");

    const pending = await worker.db.rpc("request_report_pending", {
      p_request_id: r.id,
      p_client_request_id: uid(),
      p_pending_reason_id: pendingReasonId,
      p_explanation: "Faltou luva de 50 mm",
      p_next_action: "Comprar luva",
      p_next_action_owner_id: foreman.id,
      p_expected_return_date: today(),
    });
    expect(pending.error).toBeNull();
    expect(pending.data?.status).toBe("pendente");
    expect(pending.data?.current_pending).toMatchObject({ pending_reason: "Falta de material", next_action_owner_name: "Carlos Teste" });

    const { data: filtered } = await admin.db.from("service_requests").select("id").eq("status", "pendente").eq("id", r.id);
    expect(filtered).toHaveLength(1);

    const resumed = await worker.db.rpc("request_resume", { p_request_id: r.id });
    expect(resumed.data?.status).toBe("em_execucao");
    expect(resumed.data?.current_pending).toBeNull();

    const { data: events } = await admin.db
      .from("request_events")
      .select("event_type")
      .eq("service_request_id", r.id)
      .order("id");
    expect(events!.map((e) => e.event_type)).toEqual(["abertura", "classificacao", "pendencia", "retomada"]);
  });
});

describe("reabertura e cancelamento preservam histórico", () => {
  it("reabrir mantém o evento de validação anterior", async () => {
    const r = await openRequest();
    await schedule(r.id);
    const photo = await fakePhoto(worker, siteA.id);
    await worker.db.rpc("request_mark_executed", {
      p_request_id: r.id,
      p_client_request_id: uid(),
      p_solution: "Feito",
      p_result_photo_ids: [photo.id],
    });
    await admin.db.rpc("request_validate", { p_request_id: r.id });
    const reopened = await admin.db.rpc("request_reopen", { p_request_id: r.id, p_reason: "Vazamento voltou" });
    expect(reopened.data?.status).toBe("aberta");
    expect(reopened.data?.closed_at).toBeNull();
    const { data: events } = await admin.db.from("request_events").select("event_type,reason").eq("service_request_id", r.id).order("id");
    expect(events!.map((e) => e.event_type)).toContain("validacao");
    expect(events!.at(-1)).toEqual({ event_type: "reabertura", reason: "Vazamento voltou" });
  });

  it("eventos não podem ser alterados nem apagados, nem pela chave de serviço", async () => {
    const r = await openRequest();
    const svc = serviceClient();
    const del = await svc.from("request_events").delete().eq("service_request_id", r.id);
    expect(del.error?.message).toContain("não pode ser alterado");
  });
});

describe("cenário 1 — O.S. em local de outro cliente", () => {
  it("O.S. com local de outro cliente é recusada pelo banco", async () => {
    // A abertura pela tela deriva o cliente do local: não há parâmetro de cliente para errar.
    const r = await openRequest();
    expect(r.client_id).toBe(siteA.client_id);

    // Gravação direta com a chave de serviço (passa pela RLS, não pela FK composta): cliente de A, local de B.
    const title = `Local de outro cliente ${uid()}`;
    const svc = serviceClient();
    const { error } = await svc.from("service_requests").insert({
      number: `T1-${uid()}`,
      client_id: siteA.client_id,
      site_id: siteB.id,
      origin: "cliente_externo",
      title,
      description: "Gravação direta com local de outro cliente (teste).",
      client_request_id: uid(),
      created_by: admin.id,
    });
    expect(error?.code).toBe("23503");
    expect(error?.message).toContain("service_requests_site_id_client_id_fkey");
    const { count } = await svc.from("service_requests").select("id", { count: "exact", head: true }).eq("title", title);
    expect(count).toBe(0);
  });
});

describe("T-A10 (campo) — escopo por local", () => {
  it("funcionário de outro local não vê o chamado, os eventos nem a foto", async () => {
    const r = await openRequest();
    const { data: seen } = await outsider.db.from("service_requests").select("id").eq("id", r.id);
    expect(seen).toEqual([]);
    const { data: ev } = await outsider.db.from("request_events").select("id").eq("service_request_id", r.id);
    expect(ev).toEqual([]);
    const { data: att } = await outsider.db.from("attachments").select("id").eq("site_id", siteA.id);
    expect(att).toEqual([]);
    const act = await outsider.db.rpc("request_start", { p_request_id: r.id });
    expect(act.error?.message).toBe("Chamado não encontrado.");
  });

  it("funcionário de outro local não anexa foto ao chamado nem grava anexo direto", async () => {
    const r = await openRequest();
    // Mesmo com um arquivo que escapasse da checagem da rota, o vínculo é recusado no banco.
    const own = await fakePhoto(outsider, siteA.id);
    const add = await outsider.db.rpc("request_add_photos", { p_request_id: r.id, p_photo_ids: [own.id], p_client_request_id: uid() });
    expect(add.error).toBeTruthy();
    const { count } = await serviceClient()
      .from("attachment_links")
      .select("attachment_id", { count: "exact", head: true })
      .eq("entity_id", r.id)
      .eq("attachment_id", own.id);
    expect(count).toBe(0);
    const direct = await outsider.db.from("attachments").insert({
      bucket: "evidence",
      site_id: siteA.id,
      storage_key: `${siteA.id}/2026/10/${uid()}.jpg`,
      mime_type: "image/jpeg",
      size_bytes: 10,
      uploaded_by: outsider.id,
      client_upload_id: uid(),
    });
    expect(direct.error).toBeTruthy();
  });
});

describe("T-A15 — usuário inativado", () => {
  it("perde acesso sem apagar autorias", async () => {
    const temp = await createUser("worker", "Temporário Teste");
    await addMembership(temp.id, siteA.id);
    const entry = await temp.db.rpc("work_entry_create", {
      p_client_request_id: uid(),
      p_site_id: siteA.id,
      p_activity_date: today(),
      p_description: "Limpeza do salão",
    });
    expect(entry.error).toBeNull();

    await admin.db.from("profiles").update({ is_active: false, deactivated_at: new Date().toISOString() }).eq("id", temp.id);

    const { data: after } = await temp.db.from("work_entries").select("id").eq("id", entry.data!.id);
    expect(after).toEqual([]);
    const attempt = await temp.db.rpc("work_entry_create", {
      p_client_request_id: uid(),
      p_site_id: siteA.id,
      p_activity_date: today(),
      p_description: "Depois de inativado",
    });
    expect(attempt.error?.code).toBe("42501");

    const { data: kept } = await admin.db.from("work_entries").select("author_id").eq("id", entry.data!.id).single();
    expect(kept?.author_id).toBe(temp.id);
  });
});

describe("integridade geral", () => {
  it("todas as tabelas públicas têm RLS ligada", () => {
    const withoutRls = sql(
      "select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity",
    );
    expect(withoutRls).toBe("");
  });

  it("usuário anônimo não executa funções de negócio", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const anonDb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { error } = await anonDb.rpc("request_validate", { p_request_id: uid() });
    expect(error).not.toBeNull();
    const { data } = await anonDb.from("service_requests").select("id").limit(1);
    expect(data ?? []).toEqual([]);
  });
});

describe("B-26 — edição com versão desatualizada", () => {
  /** Edita só o título, repetindo os demais campos como estão no banco. */
  async function editTitle(id: string, title: string, extra: Record<string, unknown> = {}) {
    const { data: r } = await serviceClient()
      .from("service_requests")
      .select("description, priority_id, service_category_id, due_date, site_area_id, is_internal")
      .eq("id", id)
      .single();
    return admin.db.rpc("request_update", {
      p_request_id: id,
      p_title: title,
      p_description: r!.description,
      p_priority_id: r!.priority_id as string,
      p_service_category_id: r!.service_category_id as string,
      p_due_date: r!.due_date as string,
      p_site_area_id: r!.site_area_id as string,
      p_is_internal: r!.is_internal,
      ...extra,
    } as never);
  }
  const titleOf = async (id: string) => (await serviceClient().from("service_requests").select("title").eq("id", id).single()).data!.title;

  it("edição com versão antiga é recusada e não sobrescreve a anterior", async () => {
    const req = await openRequest();
    const first = await editTitle(req.id, "Título salvo pela primeira aba", { p_expected_version: req.version });
    expect(first.error).toBeNull();
    expect((first.data as { version: number }).version).toBe(req.version + 1);

    const stale = await editTitle(req.id, "Título da segunda aba", { p_expected_version: req.version });
    expect(stale.error?.hint).toBe("expectedVersion");
    expect(stale.error?.message).toContain("foi alterado depois que você abriu a página");
    expect(await titleOf(req.id)).toBe("Título salvo pela primeira aba");
  });

  it("mudança de situação também conta como alteração", async () => {
    const req = await openRequest();
    await schedule(req.id);
    const stale = await editTitle(req.id, "Título com versão de antes da programação", { p_expected_version: req.version });
    expect(stale.error?.hint).toBe("expectedVersion");
  });

  it("o reenvio da mesma edição (mesma chave) não acusa versão", async () => {
    const req = await openRequest();
    const key = uid();
    const args = { p_expected_version: req.version, p_client_request_id: key };
    expect((await editTitle(req.id, "Título reenviado", args)).error).toBeNull();
    expect((await editTitle(req.id, "Título reenviado", args)).error).toBeNull();
  });

  it("sem a versão esperada, a edição segue como antes (app anterior)", async () => {
    const req = await openRequest();
    expect((await editTitle(req.id, "Título sem versão")).error).toBeNull();
    expect(await titleOf(req.id)).toBe("Título sem versão");
  });
});

describe("B-20 — desligamento com pendências", () => {
  /** Pessoa nova com acesso ao local A, um chamado programado e uma tarefa abertos para ela. */
  async function personWithPendencies(name: string) {
    const person = await createUser("worker", name);
    await addMembership(person.id, siteA.id);
    const req = await openRequest();
    await schedule(req.id, [person.id]);
    const { data: task, error } = await admin.db.rpc("task_create", {
      p_client_request_id: uid(),
      p_title: `Tarefa de ${name}`,
      p_scheduled_date: today(),
      p_assignee_ids: [person.id],
      p_occurrences: [{ site_id: siteA.id }],
    });
    if (error) throw error;
    return { person, req, task: task! };
  }
  type OpenItems = { requests: Array<{ id: string }>; tasks: Array<{ id: string }>; memberships: Array<{ site_id: string }> };
  const deactivate = (args: Record<string, unknown>) => admin.db.rpc("profile_deactivate" as never, args as never);
  const openAssignees = async (requestId: string) =>
    (await serviceClient().from("request_assignments").select("profile_id").eq("service_request_id", requestId).is("unassigned_at", null)).data!.map((a) => a.profile_id);
  const taskAssignees = async (taskId: string) =>
    (await serviceClient().from("task_assignments").select("profile_id").eq("task_id", taskId)).data!.map((a) => a.profile_id);

  it("a prévia lista os chamados, as tarefas e os locais abertos da pessoa (só para a administração)", async () => {
    const { person, req, task } = await personWithPendencies("Prévia Desligamento");
    const { data, error } = await admin.db.rpc("profile_open_items" as never, { p_profile: person.id } as never);
    expect(error).toBeNull();
    const items = data as unknown as OpenItems;
    expect(items.requests.map((r) => r.id)).toEqual([req.id]);
    expect(items.tasks.map((t) => t.id)).toEqual([task.id]);
    expect(items.memberships.map((m) => m.site_id)).toEqual([siteA.id]);
    const byWorker = await worker.db.rpc("profile_open_items" as never, { p_profile: person.id } as never);
    expect(byWorker.error?.code).toBe("42501");
  });

  it("desativar com transferência move as atribuições abertas e mantém o autor dos registros", async () => {
    const { person, req, task } = await personWithPendencies("Transferência Desligamento");
    const started = await person.db.rpc("request_start", { p_request_id: req.id });
    expect(started.error).toBeNull();

    const { data, error } = await deactivate({ p_profile: person.id, p_reason: "Fim do contrato (fictício)", p_reassign_to: foreman.id });
    expect(error).toBeNull();
    expect(data).toMatchObject({ requests_moved: 1, requests_left: 0, tasks_moved: 1, tasks_left: 0, memberships_ended: 1 });

    expect(await openAssignees(req.id)).toEqual([foreman.id]);
    expect(await taskAssignees(task.id)).toEqual([foreman.id]);
    const svc = serviceClient();
    const { data: events } = await svc.from("request_events").select("event_type, actor_id").eq("service_request_id", req.id);
    expect(events).toEqual(expect.arrayContaining([{ event_type: "inicio", actor_id: person.id }, { event_type: "atribuicao", actor_id: admin.id }]));
    const { data: memberships } = await svc.from("site_memberships").select("active_to").eq("profile_id", person.id);
    expect(memberships!.every((m) => m.active_to !== null && m.active_to <= today())).toBe(true);
    const { data: profile } = await svc.from("profiles").select("is_active, deactivated_at").eq("id", person.id).single();
    expect(profile!.is_active).toBe(false);
    expect(profile!.deactivated_at).not.toBeNull();
    const { count } = await svc.from("notifications").select("id", { count: "exact", head: true }).eq("kind", "desligamento").eq("link", `/admin/usuarios/${person.id}`);
    expect(count).toBeGreaterThan(0);
  });

  it("sem transferência, ou para quem não trabalha no local, as pendências ficam sem responsável e são contadas", async () => {
    const alone = await personWithPendencies("Sem Transferência");
    const res = await deactivate({ p_profile: alone.person.id, p_reason: "Desligamento (fictício)" });
    expect(res.error).toBeNull();
    expect(res.data).toMatchObject({ requests_moved: 0, requests_left: 1, tasks_moved: 0, tasks_left: 1 });
    expect(await openAssignees(alone.req.id)).toEqual([]);
    expect(await taskAssignees(alone.task.id)).toEqual([]);

    const elsewhere = await personWithPendencies("Transferência Inválida");
    const res2 = await deactivate({ p_profile: elsewhere.person.id, p_reason: "Desligamento (fictício)", p_reassign_to: outsider.id });
    expect(res2.data).toMatchObject({ requests_moved: 0, requests_left: 1, tasks_moved: 0, tasks_left: 1 });
    expect(await openAssignees(elsewhere.req.id)).toEqual([]);
  });

  it("exige motivo, recusa desativar a si mesmo e só a administração desativa", async () => {
    const { person } = await personWithPendencies("Regras Desligamento");
    expect((await deactivate({ p_profile: person.id, p_reason: " " })).error?.hint).toBe("reason");
    expect((await deactivate({ p_profile: admin.id, p_reason: "Teste" })).error?.message).toContain("próprio acesso");
    const byWorker = await worker.db.rpc("profile_deactivate" as never, { p_profile: person.id, p_reason: "Teste" } as never);
    expect(byWorker.error?.code).toBe("42501");
    const { data: profile } = await serviceClient().from("profiles").select("is_active").eq("id", person.id).single();
    expect(profile!.is_active).toBe(true);
  });
});
