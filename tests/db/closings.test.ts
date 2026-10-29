import { beforeAll, describe, expect, it } from "vitest";
import { computeClosing } from "@/server/closings";
import { addMembership, createClientWithSite, createUser, serviceClient, uid, type TestUser } from "./helpers";

const sp = (s: string) => new Date(`${s}-03:00`).toISOString();

let admin: TestUser;
let worker: TestUser;
let clientId: string;
let siteId: string;

async function historical(
  number: string,
  title: string,
  events: Array<{ type: string; to?: string; at: string; payload?: Record<string, unknown>; reason?: string }>,
  extra: Record<string, unknown> = {},
) {
  const svc = serviceClient();
  const last = [...events].reverse().find((e) => e.to)!;
  const { data: req, error } = await svc
    .from("service_requests")
    .insert({
      number,
      client_id: clientId,
      site_id: siteId,
      origin: "cliente_externo",
      requester_name: "Fictício",
      title,
      description: "Teste de fechamento",
      status: last.to as never,
      opened_at: events[0]!.at,
      client_request_id: uid(),
      created_by: admin.id,
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw error;
  let prev: string | null = null;
  for (const e of events) {
    const { error: evErr } = await svc.from("request_events").insert({
      service_request_id: req!.id,
      event_type: e.type as never,
      from_status: (e.to ? prev : null) as never,
      to_status: (e.to ?? null) as never,
      actor_id: admin.id,
      occurred_at: e.at,
      reason: e.reason ?? null,
      payload: (e.payload ?? {}) as never,
    });
    if (evErr) throw evErr;
    if (e.to) prev = e.to;
  }
  return req!.id;
}

beforeAll(async () => {
  admin = await createUser("admin", "Admin Fechamento");
  worker = await createUser("worker", "Funcionário Fechamento");
  const created = await createClientWithSite("Fechamento");
  clientId = created.client.id;
  siteId = created.site.id;
  await addMembership(worker.id, siteId);
  const tag = Date.now().toString().slice(-5);

  await historical(`2026-8${tag}1`, "Aberto em setembro, resolvido em outubro", [
    { type: "abertura", to: "aberta", at: sp("2026-09-10T09:00:00") },
    { type: "classificacao", to: "programada", at: sp("2026-09-10T10:00:00"), payload: { scheduled_date: "2026-09-11", assignee_names: ["Funcionário Fechamento"] } },
    {
      type: "pendencia",
      to: "pendente",
      at: sp("2026-09-20T16:00:00"),
      payload: { pending_reason: "Falta de material", explanation: "Faltou peça", next_action: "Comprar peça", next_action_owner_name: "Encarregado", expected_return_date: "2026-10-02" },
    },
    { type: "retomada", to: "em_execucao", at: sp("2026-10-02T08:00:00") },
    { type: "execucao_informada", to: "executada", at: sp("2026-10-03T08:00:00"), payload: { solution: "Peça trocada" } },
    { type: "validacao", to: "concluida", at: sp("2026-10-05T09:00:00") },
  ]);
  await historical(`2026-8${tag}2`, "Antigo concluído em setembro", [
    { type: "abertura", to: "aberta", at: sp("2026-07-01T09:00:00") },
    { type: "execucao_informada", to: "executada", at: sp("2026-09-14T09:00:00"), payload: { solution: "Feito" } },
    { type: "validacao", to: "concluida", at: sp("2026-09-15T09:00:00") },
  ]);
  await historical(`2026-8${tag}3`, "Demanda interna não vai ao cliente", [{ type: "abertura", to: "aberta", at: sp("2026-09-02T09:00:00") }], {
    is_internal: true,
  });

  const svc = serviceClient();
  const { data: entry } = await svc
    .from("work_entries")
    .insert({ site_id: siteId, activity_date: "2026-09-03", author_id: worker.id, description: "Remoção de entulho", submitted_payload: {}, client_request_id: uid() })
    .select("id")
    .single();
  await svc.from("work_entry_participants").insert({ work_entry_id: entry!.id, profile_id: worker.id });
  await svc.from("work_entries").insert({
    site_id: siteId,
    activity_date: "2026-09-03",
    author_id: worker.id,
    description: "Nota de bastidor (não visível ao cliente)",
    client_visible: false,
    submitted_payload: {},
    client_request_id: uid(),
  });
  await svc.from("time_entries").insert({ profile_id: worker.id, site_id: siteId, work_date: "2026-09-03", hours: 9, billing_units: 1 });
  await svc.from("billing_rules").insert({ client_id: clientId, site_id: siteId, unit_type: "diaria", unit_price_cents: 33300, valid_from: "2026-01-01" });
  // Despesa interna no mesmo local: não pode aparecer no fechamento.
  const exp = await admin.db.rpc("expense_save", {
    p_client_request_id: uid(),
    p_expense_date: "2026-09-03",
    p_description: "Compra sigilosa de material",
    p_supplier_name_free: "Fornecedor interno",
    p_total_cents: 123456,
    p_allocations: [{ site_id: siteId, amount_cents: 123456, purpose: "Uso interno" }],
  });
  if (exp.error) throw exp.error;
});

describe("T-A9 — fechamento mensal com snapshot temporal", () => {
  it("setembro: o resolvido em outubro continua pendente; o antigo concluído aparece nas conclusões", async () => {
    const { payload } = await computeClosing(admin.db, { clientId, siteId, year: 2026, month: 9, includeBilling: false });
    expect(payload.period.title).toBe("SETEMBRO / 2026");
    expect(payload.requests.emAberto.pendente.map((i) => i.title)).toEqual(["Aberto em setembro, resolvido em outubro"]);
    expect(payload.requests.emAberto.pendente[0]!.pending?.nextAction).toBe("Comprar peça");
    expect(payload.requests.concluidos.map((i) => i.title)).toEqual(["Antigo concluído em setembro"]);
    expect(payload.requests.concluidos[0]!.openedBeforePeriod).toBe(true);
    expect(payload.requests.novos.map((i) => i.title)).toEqual(["Aberto em setembro, resolvido em outubro"]);
    const all = JSON.stringify(payload);
    expect(all).not.toContain("Demanda interna não vai ao cliente");
  });

  it("outubro: o mesmo chamado aparece como herdado e concluído", async () => {
    const { payload } = await computeClosing(admin.db, { clientId, siteId, year: 2026, month: 10, includeBilling: false });
    expect(payload.requests.herdados.map((i) => i.title)).toContain("Aberto em setembro, resolvido em outubro");
    expect(payload.requests.concluidos.map((i) => i.title)).toContain("Aberto em setembro, resolvido em outubro");
    expect(payload.requests.concluidos[0]!.solution).toBe("Peça trocada");
  });

  it("diário só com lançamentos visíveis ao cliente e demonstrativo quando pedido", async () => {
    const { payload } = await computeClosing(admin.db, { clientId, siteId, year: 2026, month: 9, includeBilling: true });
    const day = payload.sites[0]!.days.find((d) => d.date === "2026-09-03")!;
    expect(day.activities.map((a) => a.text)).toEqual(["Remoção de entulho"]);
    expect(day.hoursByPerson).toEqual([{ name: "Funcionário Fechamento", hours: 9 }]);
    // I4: sem liberação no contrato (show_in_client_report), o demonstrativo não vai ao cliente.
    expect(payload.billing?.statements ?? []).toEqual([]);
    await serviceClient().from("billing_rules").update({ show_in_client_report: true }).eq("client_id", clientId);
    const released = await computeClosing(admin.db, { clientId, siteId, year: 2026, month: 9, includeBilling: true });
    expect(released.payload.billing?.statements[0]).toMatchObject({ unitsTotalCenti: 100, totalCents: 33300 });
  });

  it("o payload não contém dados financeiros internos", async () => {
    const { payload } = await computeClosing(admin.db, { clientId, siteId, year: 2026, month: 9, includeBilling: false });
    const text = JSON.stringify(payload);
    for (const forbidden of ["total_cents", "expense", "supplier", "reimburse", "comprovante", "internal"]) {
      expect(text.toLowerCase()).not.toContain(forbidden);
    }
    expect(payload.billing).toBeNull();
  });
});

describe("T-A12 — versões do fechamento", () => {
  it("v2 corrige sem alterar a v1 publicada", async () => {
    const svc = serviceClient();
    const { data: closing } = await admin.db
      .from("monthly_closings")
      .insert({ client_id: clientId, site_id: siteId, period_year: 2026, period_month: 9, created_by: admin.id })
      .select("id")
      .single();
    const first = await computeClosing(admin.db, { clientId, siteId, year: 2026, month: 9, includeBilling: false });
    const v1 = await admin.db.rpc("closing_version_create", {
      p_closing_id: closing!.id,
      p_cutoff_at: first.payload.period.cutoffUtc,
      p_period_start: first.payload.period.startUtc,
      p_criteria: { includeBilling: false },
      p_header: first.header as never,
      p_payload: first.payload as never,
      p_summary: first.payload.summary as never,
    });
    expect(v1.error).toBeNull();
    expect(v1.data!.version_no).toBe(1);

    // Correção posterior em um lançamento de setembro.
    const { data: entry } = await svc.from("work_entries").select("id").eq("site_id", siteId).eq("description", "Remoção de entulho").single();
    const adjust = await admin.db.rpc("work_entry_adjust", {
      p_work_entry_id: entry!.id,
      p_reason: "Texto incompleto",
      p_description: "Remoção de entulho do salão de festas",
      p_solution: "",
      p_materials: "",
      p_hours_worked: null as never,
      p_activity_date: "2026-09-03",
      p_client_visible: true,
    });
    expect(adjust.error).toBeNull();

    const noReason = await admin.db.rpc("closing_version_create", {
      p_closing_id: closing!.id,
      p_cutoff_at: first.payload.period.cutoffUtc,
      p_period_start: first.payload.period.startUtc,
      p_criteria: {},
      p_header: first.header as never,
      p_payload: first.payload as never,
      p_summary: first.payload.summary as never,
    });
    expect(noReason.error?.hint).toBe("reason");

    const second = await computeClosing(admin.db, { clientId, siteId, year: 2026, month: 9, includeBilling: false });
    const v2 = await admin.db.rpc("closing_version_create", {
      p_closing_id: closing!.id,
      p_cutoff_at: second.payload.period.cutoffUtc,
      p_period_start: second.payload.period.startUtc,
      p_criteria: {},
      p_header: second.header as never,
      p_payload: second.payload as never,
      p_summary: second.payload.summary as never,
      p_reason: "Correção do texto do dia 03/09",
    });
    expect(v2.data!.version_no).toBe(2);
    expect(v2.data!.supersedes_version_id).toBe(v1.data!.id);

    const { data: stored } = await admin.db.from("closing_versions").select("version_no, payload").eq("closing_id", closing!.id).order("version_no");
    const texts = stored!.map((v) => JSON.stringify(v.payload));
    expect(texts[0]).toContain('"Remoção de entulho"');
    expect(texts[1]).toContain("Remoção de entulho do salão de festas");

    const tamper = await svc.from("closing_versions").update({ reason: "x" }).eq("id", v1.data!.id);
    expect(tamper.error?.message).toContain("não pode ser alterado");
  });
});

describe("C2 — histórico grande (limite de 1000 linhas da API)", () => {
  it("apura todos os chamados e eventos, sem truncar", async () => {
    test_timeout: {
      const svc = serviceClient();
      const created = await createClientWithSite("Volume");
      const tag = Date.now().toString().slice(-6);
      const rows = Array.from({ length: 160 }, (_, i) => ({
        number: `2026-7${tag}${String(i).padStart(3, "0")}`,
        client_id: created.client.id,
        site_id: created.site.id,
        origin: "cliente_externo" as const,
        requester_name: "Fictício",
        title: `Volume ${i}`,
        description: "x",
        status: "concluida" as const,
        opened_at: sp("2026-08-01T09:00:00"),
        client_request_id: uid(),
        created_by: admin.id,
      }));
      const { data: reqs, error } = await svc.from("service_requests").insert(rows).select("id");
      if (error) throw error;
      const steps: Array<[string, string | null, string]> = [
        ["abertura", "aberta", "2026-08-01T09:00:00"],
        ["classificacao", "programada", "2026-08-01T10:00:00"],
        ["inicio", "em_execucao", "2026-08-02T08:00:00"],
        ["atividade", null, "2026-08-02T09:00:00"],
        ["comentario", null, "2026-08-02T10:00:00"],
        ["execucao_informada", "executada", "2026-09-10T08:00:00"],
        ["validacao", "concluida", "2026-09-12T08:00:00"],
      ];
      const events = reqs!.flatMap((r) =>
        steps.map(([type, to, at]) => ({ service_request_id: r.id, event_type: type as never, to_status: to as never, actor_id: admin.id, occurred_at: sp(at) })),
      );
      for (let i = 0; i < events.length; i += 500) {
        const { error: evErr } = await svc.from("request_events").insert(events.slice(i, i + 500));
        if (evErr) throw evErr;
      }
      const { payload } = await computeClosing(admin.db, { clientId: created.client.id, siteId: created.site.id, year: 2026, month: 9, includeBilling: false });
      expect(payload.summary.concluidos).toBe(160);
      expect(payload.summary.herdados).toBe(160);
      expect(payload.summary.emAbertoTotal).toBe(0);
    }
  }, 120_000);
});
