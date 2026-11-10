import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDaysIso, todayIso, zonedMidnightUtc } from "@/domain/dates";
import { REQUEST_STATUSES, type RequestStatus } from "@/domain/request-status";
import { loadDashboardRows, type DashboardFilters } from "@/server/dashboard";
import { listRequests, type RequestFilters } from "@/server/request-list";
import { addMembership, createClientWithSite, createSite, createUser, serviceClient, sql, uid, type TestUser } from "./helpers";

/**
 * F5.6 e etapa 4 da trilha visual: o número do cartão do painel é o mesmo da lista que ele
 * abre, sem truncar em 1000 linhas, e a contagem é feita no banco (dashboard_summary).
 */

let admin: TestUser;
let person: TestUser;
let clientId: string;
const VOLUME = 1050;

// Cliente com chamados variados, para conferir cada contagem contra a lista de chamados.
let mixedClientId: string;
let mixedSiteId: string;
let otherSiteId: string;
const ids: Record<string, string> = {};
const today = todayIso();
const midnight = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return zonedMidnightUtc(y, m, d).getTime();
};
const minutesAfterMidnight = (n: number) => new Date(midnight(today) + n * 60_000).toISOString();

beforeAll(async () => {
  admin = await createUser("admin", "Admin Painel");
  person = await createUser("worker", "Pessoa Painel");
  const svc = serviceClient();
  const tag = Date.now().toString().slice(-6);

  const created = await createClientWithSite("Painel");
  clientId = created.client.id;
  const rows = Array.from({ length: VOLUME }, (_, i) => ({
    number: `2026-9${tag}${String(i).padStart(4, "0")}`,
    client_id: clientId,
    site_id: created.site.id,
    origin: "cliente_externo" as const,
    requester_name: "Fictício",
    title: `Painel ${i}`,
    description: "x",
    status: "aberta" as const,
    client_request_id: uid(),
    created_by: admin.id,
  }));
  const { error } = await svc.from("service_requests").insert(rows);
  if (error) throw error;

  const mixed = await createClientWithSite("Painel misto");
  mixedClientId = mixed.client.id;
  mixedSiteId = mixed.site.id;
  otherSiteId = (await createSite(mixedClientId, `Obra Painel misto B ${tag}`)).id;
  const pending = (reason: string, owner: string) => ({ pending_reason: reason, next_action_owner_name: owner });
  const spec: Array<{ key: string; status: RequestStatus; due?: number; opened?: string; current_pending?: Record<string, string> }> = [
    { key: "aberta", status: "aberta" },
    { key: "programada-vencida", status: "programada", due: -1 },
    { key: "executada", status: "executada", due: 1 },
    { key: "pendente-cliente", status: "pendente", current_pending: pending("Aguardando cliente", "Cliente") },
    { key: "pendente-material", status: "pendente", current_pending: pending("Aguardando material", "Megagyn") },
    { key: "pendente-vencida", status: "pendente", due: -3, current_pending: pending("Aguardando material", "Megagyn") },
    { key: "concluida", status: "concluida", due: -7 },
    { key: "cancelada", status: "cancelada" },
    { key: "em-execucao-ontem", status: "em_execucao", opened: new Date(midnight(today) - 3_600_000).toISOString() },
    { key: "aberta-vencida", status: "aberta", due: -5 },
  ];
  const mixedRows = spec.map((s, i) => {
    ids[s.key] = uid();
    return {
      id: ids[s.key],
      number: `2026-8${tag}${String(i).padStart(3, "0")}`,
      client_id: mixedClientId,
      site_id: mixedSiteId,
      origin: "cliente_externo" as const,
      requester_name: "Fictício",
      title: `Misto ${s.key}`,
      description: "x",
      status: s.status,
      due_date: s.due === undefined ? null : addDaysIso(today, s.due),
      opened_at: s.opened ?? minutesAfterMidnight(i + 1),
      current_pending: s.current_pending ?? null,
      client_request_id: uid(),
      created_by: admin.id,
    };
  });
  const { error: mErr } = await svc.from("service_requests").insert(mixedRows);
  if (mErr) throw mErr;

  // A pessoa está no chamado vencido; no "pendente-cliente" ela foi desligada e não conta mais.
  const { error: aErr } = await svc.from("request_assignments").insert([
    { service_request_id: ids["programada-vencida"]!, profile_id: person.id, assigned_by: admin.id },
    { service_request_id: ids["pendente-cliente"]!, profile_id: person.id, assigned_by: admin.id, unassigned_at: new Date().toISOString() },
  ]);
  if (aErr) throw aErr;

  // Atividades: duas na obra A hoje, uma na obra B hoje e uma na obra A fora do período.
  const entry = (site: string, date: string, author: string) => ({
    site_id: site,
    activity_date: date,
    author_id: author,
    description: "Atividade do painel",
    submitted_payload: {},
    client_request_id: uid(),
  });
  const { error: wErr } = await svc
    .from("work_entries")
    .insert([entry(mixedSiteId, today, person.id), entry(mixedSiteId, today, admin.id), entry(otherSiteId, today, person.id), entry(mixedSiteId, addDaysIso(today, -40), person.id)]);
  if (wErr) throw wErr;

  // Orçamentos enviados: um válido, um sem validade e um vencido (não conta). Nascem em rascunho
  // e passam a "enviado" como numa transição: a situação não muda por gravação direta (B-04).
  const quote = (i: number, validUntil: string | null, total: number) => ({
    number: `ORC-P4-${tag}-${i}`,
    client_id: mixedClientId,
    issued_at: addDaysIso(today, -30),
    valid_until: validUntil,
    total_cents: total,
    created_by: admin.id,
  });
  const { error: qErr } = await svc.from("quotes").insert([quote(1, addDaysIso(today, 10), 150_000), quote(2, null, 50_000), quote(3, addDaysIso(today, -1), 999_999)]);
  if (qErr) throw qErr;
  sql(`select set_config('app.in_transition', 'on', true); update public.quotes set status = 'enviado' where client_id = '${mixedClientId}'`);
}, 180_000);

// Apaga os chamados, as atividades e os orçamentos criados aqui: sem isso, cada rodada deixava
// mais 1060 chamados na base local, e o painel e as listas ficavam lentos para os outros testes.
afterAll(async () => {
  const svc = serviceClient();
  const clients = [clientId, mixedClientId].filter(Boolean);
  const sites = [mixedSiteId, otherSiteId].filter(Boolean);
  const steps = [
    () => svc.from("work_entries").delete().in("site_id", sites),
    () => svc.from("quotes").delete().in("client_id", clients),
    () => svc.from("request_assignments").delete().in("service_request_id", Object.values(ids)),
    () => svc.from("service_requests").delete().in("client_id", clients),
  ];
  for (const step of steps) {
    const { error } = await step();
    if (error) throw error;
  }
}, 120_000);

const filters = (over: Partial<DashboardFilters> = {}): DashboardFilters => ({ clientId: null, siteId: null, personId: null, from: today, to: today, today, ...over });
const listFilters = (over: Partial<RequestFilters> = {}): RequestFilters => ({
  status: null,
  clientId: mixedClientId,
  siteId: null,
  assigneeId: null,
  pendingReasonId: null,
  from: null,
  to: null,
  overdue: false,
  q: null,
  ...over,
});

describe("painel da administração", () => {
  it("conta todos os chamados do filtro, mesmo acima de 1000", async () => {
    const { summary } = await loadDashboardRows(admin.db, filters({ clientId }));
    expect(summary.requests.by_status.aberta).toBe(VOLUME);
    expect(summary.requests.not_closed).toBe(VOLUME);
    expect(summary.attention.total).toBe(VOLUME);
    expect(summary.attention.rows).toHaveLength(8);
  }, 120_000);

  it("cada contagem de chamados é igual ao total da lista com o mesmo filtro", async () => {
    const { summary } = await loadDashboardRows(admin.db, filters({ clientId: mixedClientId }));
    const r = summary.requests;
    expect(r.by_status).toEqual({ aberta: 2, programada: 1, executada: 1, pendente: 3, concluida: 1, cancelada: 1, em_execucao: 1 });
    expect(r.not_closed).toBe(8);
    expect(r.overdue).toBe(3);
    expect(r.new_today).toBe(9);

    for (const status of REQUEST_STATUSES) {
      const { total } = await listRequests(admin.db, listFilters({ status }));
      expect(r.by_status[status] ?? 0, `situação ${status}`).toBe(total);
    }
    expect(r.not_closed).toBe((await listRequests(admin.db, listFilters({ status: "abertos" }))).total);
    expect(r.overdue).toBe((await listRequests(admin.db, listFilters({ overdue: true }))).total);
    expect(r.new_today).toBe((await listRequests(admin.db, listFilters({ from: today, to: today }))).total);
  }, 60_000);

  it("filtro por pessoa conta só os chamados em que ela está, sem os desligados", async () => {
    const { summary } = await loadDashboardRows(admin.db, filters({ clientId: mixedClientId, personId: person.id }));
    expect(summary.requests.by_status).toEqual({ programada: 1 });
    expect(summary.requests.overdue).toBe(1);
    expect(summary.attention.total).toBe(1);
    const { total } = await listRequests(admin.db, listFilters({ assigneeId: person.id }));
    expect(summary.requests.not_closed).toBe(total);
  }, 60_000);

  it("pendências por motivo e por responsável vêm da maior para a menor", async () => {
    const { summary } = await loadDashboardRows(admin.db, filters({ clientId: mixedClientId }));
    expect(summary.requests.pending_by_reason).toEqual([
      { label: "Aguardando material", count: 2 },
      { label: "Aguardando cliente", count: 1 },
    ]);
    expect(summary.requests.pending_by_owner).toEqual([
      { label: "Megagyn", count: 2 },
      { label: "Cliente", count: 1 },
    ]);
  }, 60_000);

  it("fila: vencidos pelo prazo, depois validar, destravar e triar", async () => {
    const { summary } = await loadDashboardRows(admin.db, filters({ clientId: mixedClientId }));
    const order = ["aberta-vencida", "pendente-vencida", "programada-vencida", "executada", "pendente-cliente", "pendente-material", "aberta"];
    expect(summary.attention.total).toBe(order.length);
    expect(summary.attention.rows.map((row) => row.id)).toEqual(order.map((k) => ids[k]));
    const first = summary.attention.rows[0]!;
    expect(first).toMatchObject({ title: "Misto aberta-vencida", status: "aberta", overdue: true, site_id: mixedSiteId, pending_reason: null });
    expect(first.number).toMatch(/^2026-8/);
    expect(summary.attention.rows.find((row) => row.id === ids["programada-vencida"])?.assignee_ids).toEqual([person.id]);
    expect(summary.attention.rows.find((row) => row.id === ids["pendente-cliente"])).toMatchObject({ pending_reason: "Aguardando cliente", assignee_ids: [] });

    const { data, error } = await admin.db.rpc("dashboard_summary", { p_today: today, p_from: today, p_to: today, p_client_id: mixedClientId, p_attention_size: 3 });
    expect(error).toBeNull();
    const small = data as unknown as { attention: { total: number; rows: unknown[] } };
    expect(small.attention.total).toBe(order.length);
    expect(small.attention.rows).toHaveLength(3);
  }, 60_000);

  it("atividades por local no período, obras ativas e orçamentos dentro da validade", async () => {
    const { summary } = await loadDashboardRows(admin.db, filters({ clientId: mixedClientId }));
    expect(summary.work_entries).toEqual({
      total: 3,
      by_site: [
        { site_id: mixedSiteId, count: 2 },
        { site_id: otherSiteId, count: 1 },
      ],
    });
    expect(summary.active_sites).toBe(2);
    expect(summary.open_quotes).toEqual({ count: 2, total_cents: 200_000 });

    const byPerson = await loadDashboardRows(admin.db, filters({ clientId: mixedClientId, personId: person.id }));
    expect(byPerson.summary.work_entries.total).toBe(2);
    const bySite = await loadDashboardRows(admin.db, filters({ siteId: otherSiteId }));
    expect(bySite.summary.work_entries).toEqual({ total: 1, by_site: [{ site_id: otherSiteId, count: 1 }] });
  }, 60_000);

  it("funcionário só conta o que enxerga: sem acesso ao local, zero", async () => {
    const outsider = await createUser("worker", "Funcionário sem obra");
    const blind = await loadDashboardRows(outsider.db, filters({ clientId: mixedClientId }));
    expect(blind.summary.requests.by_status).toEqual({});
    expect(blind.summary.requests.not_closed).toBe(0);
    expect(blind.summary.attention).toEqual({ total: 0, rows: [] });
    expect(blind.summary.work_entries).toEqual({ total: 0, by_site: [] });

    // Com vínculo só na obra A: vê os chamados e as atividades dela, não as da obra B.
    await addMembership(outsider.id, mixedSiteId);
    const seen = await loadDashboardRows(outsider.db, filters({ clientId: mixedClientId }));
    expect(seen.summary.requests.not_closed).toBe(8);
    expect(seen.summary.work_entries).toEqual({ total: 2, by_site: [{ site_id: mixedSiteId, count: 2 }] });
  }, 60_000);

  it("usuário anônimo não conta nada: a leitura é recusada (B-16)", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const anonDb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    // Desde o B-16 o anônimo não tem leitura nenhuma de locais: em vez de zeros, a consulta é recusada.
    const { data, error } = await anonDb.rpc("dashboard_summary", { p_today: today, p_from: today, p_to: today });
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("leitura de chamados e atividades decide o admin uma vez por consulta", () => {
    // Sem o atalho, has_site_access roda linha a linha (cerca de 100 µs cada), e o painel
    // passa de 2 s com 18 mil chamados. A regra é a mesma: has_site_access já aceita o admin.
    for (const [table, policy] of [
      ["service_requests", "service_requests_select"],
      ["work_entries", "work_entries_select"],
    ]) {
      const qual = sql(`select qual from pg_policies where schemaname = 'public' and tablename = '${table}' and policyname = '${policy}'`);
      expect(qual, policy).toMatch(/^\(\( SELECT (public\.)?is_admin\(\) AS is_admin\) OR (public\.)?has_site_access\(site_id\)\)$/);
    }
  });
});

describe("cenário 12 (doc 07): atividade ligada a O.S. e tarefa", () => {
  it("atividade ligada a O.S. e tarefa conta uma vez no cartão", async () => {
    const foreman = await createUser("foreman", "Encarregado Cenário 12");
    const { client, site } = await createClientWithSite("Cenário 12");
    await addMembership(foreman.id, site.id);
    const { data: req, error: reqErr } = await admin.db.rpc("request_open", {
      p_client_request_id: uid(),
      p_site_id: site.id,
      p_title: "Vistoria do cenário 12 (fictícia)",
      p_description: "Teste do painel",
      p_requester_name: "Gerente (fictício)",
    });
    expect(reqErr).toBeNull();
    await admin.db.rpc("request_schedule", { p_request_id: req!.id, p_assignee_ids: [foreman.id], p_scheduled_date: today });
    const { data: task, error: taskErr } = await admin.db.rpc("task_create", {
      p_client_request_id: uid(),
      p_title: "Vistoria ligada à O.S. (fictícia)",
      p_scheduled_date: today,
      p_assignee_ids: [foreman.id],
      p_occurrences: [{ site_id: site.id }],
      p_service_request_id: req!.id,
    });
    expect(taskErr).toBeNull();
    const { data: occ } = await foreman.db.from("task_occurrences").select("id").eq("task_id", task!.id).single();
    const entry = await foreman.db.rpc("work_entry_create", {
      p_client_request_id: uid(),
      p_site_id: site.id,
      p_activity_date: today,
      p_description: "Vistoria feita (fictícia)",
      p_task_occurrence_id: occ!.id,
    });
    expect(entry.error).toBeNull();
    // O mesmo lançamento tem os dois vínculos; o cartão "Atividades registradas" conta 1.
    expect([entry.data!.service_request_id, entry.data!.task_occurrence_id]).toEqual([req!.id, occ!.id]);

    const { summary } = await loadDashboardRows(admin.db, filters({ clientId: client.id }));
    expect(summary.work_entries).toEqual({ total: 1, by_site: [{ site_id: site.id, count: 1 }] });
  }, 60_000);
});
