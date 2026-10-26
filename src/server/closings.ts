import { buildBillingStatement, type BillingStatement } from "@/domain/billing";
import { classifyForPeriod, type ClosingItem, type ClosingRequestInput } from "@/domain/closing";
import { daysOfMonth, monthRangeUtc, monthTitle, todayIso } from "@/domain/dates";
import type { RequestStatus } from "@/domain/request-status";
import { STATUS_LABEL } from "@/domain/request-status";
import { loadPhotos, type ServerDb } from "./data";
import { chunk, fetchAll } from "./paginate";
import { loadDiary, toClientDay } from "./daily-log";

/**
 * Apuração do fechamento mensal (Word §8; docs/04 §9).
 * - Chamados: estado conforme eventos ANTES do corte (fuso America/Sao_Paulo), nunca o estado atual.
 * - Diário: projeção dos lançamentos (work_entries) visíveis ao cliente, por local e data.
 * - Lista branca: o payload só contém dados de atendimento; nada de custos, fornecedores,
 *   comprovantes, reembolsos, notas internas ou demandas internas.
 */

export type ClosingParams = {
  clientId: string;
  siteId: string | null;
  year: number;
  month: number;
  includeBilling: boolean;
};

export type ClosingPhoto = { id: string; caption: string | null };

export type ClosingRequestItem = {
  id: string;
  number: string;
  title: string;
  siteName: string;
  areaName: string | null;
  openedAt: string;
  openedBeforePeriod: boolean;
  statusAtStart: RequestStatus | null;
  statusAtCutoff: RequestStatus;
  statusLabel: string;
  validatedAt: string | null;
  executedAt: string | null;
  solution: string | null;
  cancelReason: string | null;
  reopenReason: string | null;
  pending: { reason: string | null; explanation: string | null; nextAction: string | null; ownerName: string | null; expectedReturnDate: string | null } | null;
  schedule: { scheduledDate: string | null; assigneeNames: string[] } | null;
  resultPhotos: ClosingPhoto[];
};

export type ClosingActivity = {
  id: string;
  text: string;
  solution: string | null;
  materials: string | null;
  outcome: "executado" | "parcial" | "nao_executado";
  blockerReason: string | null;
  nextStep: string | null;
  requestNumber: string | null;
  areaName: string | null;
  photos: ClosingPhoto[];
};

export type ClosingDay = {
  date: string;
  team: string[];
  hoursByPerson: Array<{ name: string; hours: number }>;
  totalHours: number;
  activities: ClosingActivity[];
  planned: Array<{ title: string; status: string; assigneeNames: string[]; noShowReason: string | null }>;
};

export type ClosingPayload = {
  schema: 1;
  period: { year: number; month: number; title: string; firstDay: string; lastDay: string; startUtc: string; cutoffUtc: string };
  client: { id: string; displayName: string; legalName: string };
  sites: Array<{ id: string; name: string; address: string | null; days: ClosingDay[] }>;
  requests: {
    herdados: ClosingRequestItem[];
    novos: ClosingRequestItem[];
    concluidos: ClosingRequestItem[];
    emAberto: Record<"aberta" | "programada" | "em_execucao" | "pendente", ClosingRequestItem[]>;
    aguardandoValidacao: ClosingRequestItem[];
    cancelados: ClosingRequestItem[];
    reabertos: ClosingRequestItem[];
  };
  billing: { statements: Array<BillingStatement & { siteName: string }> } | null;
  summary: {
    herdados: number;
    novos: number;
    concluidos: number;
    emAberto: Record<string, number>;
    emAbertoTotal: number;
    aguardandoValidacao: number;
    cancelados: number;
    reabertos: number;
    dias: number;
    atividades: number;
  };
};

export type ClosingHeaderSnapshot = {
  company: {
    tradeName: string;
    legalName: string;
    cnpj: string | null;
    addressText: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    technicalManagerName: string | null;
    technicalManagerTitle: string | null;
    crea: string | null;
    footerText: string | null;
    city: string | null;
    objective: string;
    logoAttachmentId: string | null;
    signatureAttachmentId: string | null;
  };
  issuedAt: string;
  issuedOn: string;
};

type RequestRow = {
  id: string;
  number: string;
  title: string;
  opened_at: string;
  is_internal: boolean;
  site_id: string;
  site: { name: string } | null;
  area: { name: string } | null;
};

export async function computeClosing(db: ServerDb, p: ClosingParams): Promise<{ payload: ClosingPayload; header: ClosingHeaderSnapshot }> {
  const { start, end } = monthRangeUtc(p.year, p.month);
  const days = daysOfMonth(p.year, p.month);
  const firstDay = days[0]!;
  const lastDay = days[days.length - 1]!;

  const { data: client, error: clientErr } = await db.from("clients").select("id, display_name, legal_name").eq("id", p.clientId).single();
  if (clientErr || !client) throw new Error("Cliente não encontrado.");

  let sitesQuery = db.from("sites").select("id, name, address_text").eq("client_id", p.clientId).order("name");
  if (p.siteId) sitesQuery = sitesQuery.eq("id", p.siteId);
  const { data: sites } = await sitesQuery;
  const siteList = sites ?? [];
  if (p.siteId && siteList.length === 0) throw new Error("Local não pertence ao cliente.");
  const siteIds = siteList.map((s) => s.id);

  // ---------------- Chamados (snapshot por eventos) ----------------
  // Todas as páginas (a API corta em 1000 linhas). Chamados encerrados antes do início do
  // período e não reabertos não aparecem em nenhuma seção: ficam fora da consulta.
  const startIso = start.toISOString();
  const requests = (await fetchAll((from, to) => {
    let q = db
      .from("service_requests")
      .select("id, number, title, opened_at, is_internal, site_id, site:sites(name), area:site_areas(name)")
      .eq("client_id", p.clientId)
      .eq("is_internal", false)
      .lt("opened_at", end.toISOString())
      .or(`closed_at.is.null,closed_at.gte.${startIso}`)
      .or(`cancelled_at.is.null,cancelled_at.gte.${startIso}`)
      .order("id")
      .range(from, to);
    if (p.siteId) q = q.eq("site_id", p.siteId);
    return q;
  })) as unknown as RequestRow[];
  const ids = requests.map((r) => r.id);

  type EventRow = { service_request_id: string; event_type: string; to_status: RequestStatus | null; occurred_at: string; reason: string | null; payload: unknown; work_entry_id: string | null; is_internal: boolean };
  const events: EventRow[] = [];
  for (const batch of chunk(ids, 150)) {
    const rows = await fetchAll((from, to) =>
      db
        .from("request_events")
        .select("service_request_id, event_type, to_status, occurred_at, reason, payload, work_entry_id, is_internal")
        .in("service_request_id", batch)
        .lt("occurred_at", end.toISOString())
        .order("occurred_at")
        .order("id")
        .range(from, to),
    );
    events.push(...(rows as EventRow[]));
  }
  const eventsByRequest = new Map<string, typeof events>();
  for (const e of events) eventsByRequest.set(e.service_request_id, [...(eventsByRequest.get(e.service_request_id) ?? []), e]);

  const inputs: Array<ClosingRequestInput & { row: RequestRow }> = requests.map((r) => ({
    id: r.id,
    number: r.number,
    title: r.title,
    openedAt: r.opened_at,
    isInternal: r.is_internal,
    row: r,
    events: (eventsByRequest.get(r.id) ?? []).map((e) => ({
      eventType: e.event_type,
      toStatus: e.to_status,
      occurredAt: e.occurred_at,
      reason: e.is_internal ? null : e.reason,
      payload: (e.payload ?? {}) as Record<string, unknown>,
    })),
  }));
  const classification = classifyForPeriod(inputs, { start, end });

  // Fotos de resultado dos concluídos no mês (lançamento ligado à execução informada antes do corte).
  const executionEntryByRequest = new Map<string, string>();
  for (const e of events) if (e.event_type === "execucao_informada" && e.work_entry_id) executionEntryByRequest.set(e.service_request_id, e.work_entry_id);
  const concludedEntryIds = classification.concluidos.map((i) => executionEntryByRequest.get(i.request.id)).filter((x): x is string => !!x);
  const resultPhotos = await loadPhotos(db, "work_entry", concludedEntryIds);

  const toItem = (i: ClosingItem<ClosingRequestInput & { row: RequestRow }>): ClosingRequestItem => {
    const execution = [...(eventsByRequest.get(i.request.id) ?? [])].reverse().find((e) => e.event_type === "execucao_informada");
    const solution = execution ? ((execution.payload as Record<string, unknown>)?.solution as string | undefined) ?? null : null;
    const entryId = executionEntryByRequest.get(i.request.id);
    return {
      id: i.request.id,
      number: i.request.number,
      title: i.request.title,
      siteName: i.request.row.site?.name ?? "",
      areaName: i.request.row.area?.name ?? null,
      openedAt: i.request.openedAt,
      openedBeforePeriod: i.openedBeforePeriod,
      statusAtStart: i.statusAtStart,
      statusAtCutoff: i.statusAtCutoff,
      statusLabel: STATUS_LABEL[i.statusAtCutoff],
      validatedAt: i.validatedAt,
      executedAt: i.executedAt,
      solution,
      cancelReason: i.cancelReason,
      reopenReason: i.reopenReason,
      pending: i.lastPending
        ? {
            reason: i.lastPending.reason,
            explanation: i.lastPending.explanation,
            nextAction: i.lastPending.nextAction,
            ownerName: i.lastPending.ownerName,
            expectedReturnDate: i.lastPending.expectedReturnDate,
          }
        : null,
      schedule: i.lastSchedule,
      resultPhotos:
        i.statusAtCutoff === "concluida" && entryId
          ? (resultPhotos.get(entryId) ?? [])
              .filter((ph) => !ph.revoked && ph.role === "resultado" && ph.bucket === "evidence" && ph.visibility === "client")
              .slice(0, 4)
              .map((ph) => ({ id: ph.id, caption: ph.caption ?? null }))
          : [],
    };
  };

  // ---------------- Diário por local (fonte única: work_entries) ----------------
  const diary = await loadDiary(db, siteIds, firstDay, lastDay, { clientView: true });
  const sitesPayload = siteList.map((site) => ({
    id: site.id,
    name: site.name,
    address: site.address_text,
    days: (diary.get(site.id) ?? []).map(toClientDay),
  }));
  type TimeRow = { profile_id: string; site_id: string; work_date: string; hours: number | null; billable: boolean; billing_units: number };
  // Paginado: cliente grande passa de 1000 jornadas no mês e nenhuma diária pode sumir do demonstrativo.
  const timeRows: TimeRow[] = siteIds.length
    ? ((await fetchAll((a, b) =>
        db
          .from("time_entries")
          .select("id, profile_id, site_id, work_date, hours, billable, billing_units")
          .in("site_id", siteIds)
          .gte("work_date", firstDay)
          .lte("work_date", lastDay)
          .order("id")
          .range(a, b),
      )) as unknown as TimeRow[])
    : [];

  // ---------------- Demonstrativo (valor faturável; só se habilitado) ----------------
  let billing: ClosingPayload["billing"] = null;
  if (p.includeBilling) {
    const { data: rules } = await db.from("billing_rules").select("id, site_id, unit_type, unit_price_cents, valid_from, valid_to, show_in_client_report").eq("client_id", p.clientId);
    const statements: Array<BillingStatement & { siteName: string }> = [];
    for (const site of siteList) {
      // Só regras liberadas para o relatório do cliente (R-73); custos internos nunca entram aqui.
      const siteRules = (rules ?? []).filter((r) => r.show_in_client_report && (r.site_id === null || r.site_id === site.id));
      const unitType = (siteRules.find((r) => r.site_id === site.id) ?? siteRules[0])?.unit_type as "diaria" | "hora" | undefined;
      if (!unitType) continue;
      const st = buildBillingStatement({
        entries: timeRows
          .filter((t) => t.site_id === site.id)
          .map((t) => ({
            workDate: t.work_date,
            siteId: t.site_id,
            hours: t.hours === null ? null : Number(t.hours),
            billable: t.billable,
            billingUnitsCenti: Math.round(Number(t.billing_units) * 100),
          })),
        rules: siteRules.map((r) => ({ id: r.id, siteId: r.site_id, unitType: r.unit_type as "diaria" | "hora", unitPriceCents: r.unit_price_cents, validFrom: r.valid_from, validTo: r.valid_to })),
        siteId: site.id,
        unitType,
      });
      if (st.lines.length > 0 || st.missingRuleDates.length > 0) statements.push({ ...st, siteName: site.name });
    }
    billing = { statements };
  }

  const { data: s } = await db.from("company_settings").select("*").eq("id", 1).single();
  const now = new Date();
  const totalActivities = sitesPayload.reduce((n, site) => n + site.days.reduce((m, d) => m + d.activities.length, 0), 0);
  const totalDays = new Set(sitesPayload.flatMap((site) => site.days.filter((d) => d.activities.length > 0).map((d) => d.date))).size;

  const payload: ClosingPayload = {
    schema: 1,
    period: { year: p.year, month: p.month, title: monthTitle(p.year, p.month), firstDay, lastDay, startUtc: start.toISOString(), cutoffUtc: end.toISOString() },
    client: { id: client.id, displayName: client.display_name, legalName: client.legal_name },
    sites: sitesPayload,
    requests: {
      herdados: classification.herdados.map(toItem),
      novos: classification.novos.map(toItem),
      concluidos: classification.concluidos.map(toItem),
      emAberto: {
        aberta: classification.emAberto.aberta.map(toItem),
        programada: classification.emAberto.programada.map(toItem),
        em_execucao: classification.emAberto.em_execucao.map(toItem),
        pendente: classification.emAberto.pendente.map(toItem),
      },
      aguardandoValidacao: classification.aguardandoValidacao.map(toItem),
      cancelados: classification.cancelados.map(toItem),
      reabertos: classification.reabertos.map(toItem),
    },
    billing,
    summary: { ...classification.summary, dias: totalDays, atividades: totalActivities },
  };

  const header: ClosingHeaderSnapshot = {
    company: {
      tradeName: s?.trade_name ?? "Megagyn",
      legalName: s?.legal_name ?? "",
      cnpj: s?.cnpj ?? null,
      addressText: s?.address_text ?? null,
      phone: s?.phone ?? null,
      email: s?.email ?? null,
      website: s?.website ?? null,
      technicalManagerName: s?.technical_manager_name ?? null,
      technicalManagerTitle: s?.technical_manager_title ?? null,
      crea: s?.crea ?? null,
      footerText: s?.report_footer_text ?? null,
      city: s?.report_city ?? null,
      objective: s?.report_objective_text ?? "",
      logoAttachmentId: s?.logo_attachment_id ?? null,
      signatureAttachmentId: s?.signature_attachment_id ?? null,
    },
    issuedAt: now.toISOString(),
    issuedOn: todayIso(now),
  };
  return { payload, header };
}

/** Todas as fotos referenciadas no payload (para o PDF detalhado). */
export function closingPhotoIds(payload: ClosingPayload): string[] {
  const ids: string[] = [];
  for (const site of payload.sites) for (const d of site.days) for (const a of d.activities) ids.push(...a.photos.map((p) => p.id));
  for (const i of payload.requests.concluidos) ids.push(...i.resultPhotos.map((p) => p.id));
  return ids;
}
