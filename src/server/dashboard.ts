import type { ServerDb } from "./data";
import { fetchAll } from "./paginate";

export type DashboardFilters = { clientId: string | null; siteId: string | null; personId: string | null; from: string; to: string; today: string };

/**
 * Linhas que alimentam os cartões do painel. Tudo paginado: a API devolve no máximo
 * 1000 linhas por consulta (max_rows), e um cartão nunca pode contar menos em silêncio
 * nem divergir da lista que ele abre.
 */
export async function loadDashboardRows(db: ServerDb, f: DashboardFilters) {
  const [requests, occurrences, workEntries, expenses, allocations, quotes] = await Promise.all([
    fetchAll((a, b) => {
      let q = db
        .from("service_requests")
        .select("id, status, due_date, opened_at, current_pending, client_id, site_id, assignees:request_assignments(profile_id, unassigned_at)")
        .order("id")
        .range(a, b);
      if (f.clientId) q = q.eq("client_id", f.clientId);
      if (f.siteId) q = q.eq("site_id", f.siteId);
      return q;
    }),
    fetchAll((a, b) => {
      let q = db
        .from("task_occurrences")
        .select("id, status, site_id, task:tasks(assignments:task_assignments(profile_id))")
        .eq("scheduled_date", f.today)
        .order("id")
        .range(a, b);
      if (f.siteId) q = q.eq("site_id", f.siteId);
      return q;
    }),
    fetchAll((a, b) => {
      let q = db.from("work_entries").select("id, site_id, author_id").gte("activity_date", f.from).lte("activity_date", f.to).order("id").range(a, b);
      if (f.siteId) q = q.eq("site_id", f.siteId);
      if (f.personId) q = q.eq("author_id", f.personId);
      return q;
    }),
    fetchAll((a, b) => {
      let q = db.from("expenses").select("id, total_cents, review_status").gte("expense_date", f.from).lte("expense_date", f.to).order("id").range(a, b);
      if (f.personId) q = q.eq("purchased_by", f.personId);
      return q;
    }),
    fetchAll((a, b) => {
      let q = db
        .from("expense_allocations")
        .select("id, amount_cents, site_id, expense:expenses!inner(review_status, expense_date)")
        .gte("expense.expense_date", f.from)
        .lte("expense.expense_date", f.to)
        .order("id")
        .range(a, b);
      if (f.siteId) q = q.eq("site_id", f.siteId);
      return q;
    }),
    fetchAll((a, b) => {
      let q = db.from("quotes").select("id, total_cents, status, valid_until").eq("status", "enviado").order("id").range(a, b);
      if (f.clientId) q = q.eq("client_id", f.clientId);
      return q;
    }),
  ]);
  return { requests, occurrences, workEntries, expenses, allocations, quotes };
}
