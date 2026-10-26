import { addDaysIso, isValidIsoDate, todayIso, zonedMidnightUtc } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { REQUEST_STATUSES, type RequestStatus, isOverdue } from "@/domain/request-status";
import type { ServerDb } from "@/server/supabase/server";
import { fetchAll } from "./paginate";

export type RequestFilters = {
  status: RequestStatus | "abertos" | null;
  clientId: string | null;
  siteId: string | null;
  assigneeId: string | null;
  pendingReasonId: string | null;
  from: string | null;
  to: string | null;
  overdue: boolean;
  q: string | null;
};

type Params = Record<string, string | string[] | undefined>;
const one = (p: Params, k: string) => {
  const v = p[k];
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
};
const uuid = (v: string | null) => (v && UUID_RE.test(v) ? v : null);
const date = (v: string | null) => (v && isValidIsoDate(v) ? v : null);

export function parseRequestFilters(p: Params): RequestFilters {
  const status = one(p, "status");
  return {
    status: status === "abertos" ? "abertos" : REQUEST_STATUSES.includes(status as RequestStatus) ? (status as RequestStatus) : null,
    clientId: uuid(one(p, "cliente")),
    siteId: uuid(one(p, "local")),
    assigneeId: uuid(one(p, "responsavel")),
    pendingReasonId: uuid(one(p, "motivo")),
    from: date(one(p, "de")),
    to: date(one(p, "ate")),
    overdue: one(p, "atrasados") === "1",
    q: (one(p, "q") ?? "").replace(/[^\p{L}\p{N}\s-]/gu, "").trim().slice(0, 60) || null,
  };
}

export function filtersToQuery(f: RequestFilters): string {
  const q = new URLSearchParams();
  if (f.status) q.set("status", f.status);
  if (f.clientId) q.set("cliente", f.clientId);
  if (f.siteId) q.set("local", f.siteId);
  if (f.assigneeId) q.set("responsavel", f.assigneeId);
  if (f.pendingReasonId) q.set("motivo", f.pendingReasonId);
  if (f.from) q.set("de", f.from);
  if (f.to) q.set("ate", f.to);
  if (f.overdue) q.set("atrasados", "1");
  if (f.q) q.set("q", f.q);
  return q.toString();
}

const dayStartUtc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return zonedMidnightUtc(y!, m!, d!).toISOString();
};

/** Mesma consulta para a tela e para o CSV (totais conciliam). Período = data de abertura. */
export async function listRequests(db: ServerDb, f: RequestFilters, limit = 300) {
  const assigneeEmbed = f.assigneeId ? "assignees:request_assignments!inner(profile_id, unassigned_at)" : "assignees:request_assignments(profile_id, unassigned_at)";
  const build = () => {
    let q = db
      .from("service_requests")
      .select(
        `id, number, title, status, origin, due_date, scheduled_date, opened_at, closed_at, is_internal, current_pending, requester_name,
       site:sites(id, name), client:clients(id, display_name), priority:priority_definitions(name, level),
       category:service_categories(name), ${assigneeEmbed}`,
        { count: "exact" },
      )
      .order("opened_at", { ascending: false })
      .order("id");

    if (f.status === "abertos") q = q.not("status", "in", "(concluida,cancelada)");
    else if (f.status) q = q.eq("status", f.status);
    if (f.clientId) q = q.eq("client_id", f.clientId);
    if (f.siteId) q = q.eq("site_id", f.siteId);
    if (f.assigneeId) q = q.eq("assignees.profile_id", f.assigneeId).is("assignees.unassigned_at", null);
    if (f.pendingReasonId) q = q.eq("current_pending->>pending_reason_id", f.pendingReasonId);
    if (f.from) q = q.gte("opened_at", dayStartUtc(f.from));
    if (f.to) q = q.lt("opened_at", dayStartUtc(addDaysIso(f.to, 1)));
    if (f.overdue) q = q.lt("due_date", todayIso()).not("status", "in", "(concluida,cancelada)");
    if (f.q) q = q.or(`title.ilike.%${f.q}%,number.ilike.%${f.q}%`);
    return q;
  };

  // O CSV pede até 10 mil linhas; a API entrega no máximo 1000 por vez.
  let count: number | null = null;
  const data = await fetchAll(
    (from, to) =>
      build()
        .range(from, to)
        .then((res) => {
          if (from === 0) count = res.count;
          return res;
        }),
    1000,
    limit,
  );
  const today = todayIso();
  const rows = (data ?? []).map((r) => ({
    ...r,
    activeAssigneeIds: (r.assignees ?? []).filter((a) => a.unassigned_at === null).map((a) => a.profile_id),
    overdue: isOverdue(r.due_date, r.status, today),
  }));
  return { rows, total: count ?? rows.length };
}

export type RequestListRow = Awaited<ReturnType<typeof listRequests>>["rows"][number];
