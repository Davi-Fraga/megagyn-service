import { listExpenses } from "@/app/admin/despesas/expense-list";
import type { ExpenseFilters } from "@/domain/expense-filters";
import { listOccurrences } from "./agenda";
import type { ServerDb } from "./data";
import { fetchAll } from "./paginate";

export type DashboardFilters = { clientId: string | null; siteId: string | null; personId: string | null; from: string; to: string; today: string };

/** Filtros da lista de despesas que correspondem aos do painel (profissional = comprador). */
export function dashboardExpenseFilters(f: DashboardFilters): ExpenseFilters {
  return { from: f.from, to: f.to, siteId: f.siteId, clientId: f.clientId, purchaserId: f.personId, supplierId: null, categoryId: null, status: null, q: null };
}

/**
 * Linhas que alimentam os cartões do painel. Tudo paginado: a API devolve no máximo
 * 1000 linhas por consulta (max_rows), e um cartão nunca pode contar menos em silêncio
 * nem divergir da lista que ele abre. Tarefas e despesas usam a mesma função da lista.
 */
export async function loadDashboardRows(db: ServerDb, f: DashboardFilters) {
  const [requests, occurrences, workEntries, expenses, activeSites, quotes] = await Promise.all([
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
    listOccurrences(db, { from: f.today, to: f.today, siteId: f.siteId, clientId: f.clientId, personId: f.personId }),
    fetchAll((a, b) => {
      // Com cliente: o embed "inner" filtra pelos locais dele (mesmo critério da lista de atividades).
      let q = db
        .from("work_entries")
        .select(`id, site_id, author_id, ${f.clientId ? "site:sites!inner(client_id)" : "site:sites(client_id)"}`)
        .gte("activity_date", f.from)
        .lte("activity_date", f.to)
        .order("id")
        .range(a, b);
      if (f.clientId) q = q.eq("site.client_id", f.clientId);
      if (f.siteId) q = q.eq("site_id", f.siteId);
      if (f.personId) q = q.eq("author_id", f.personId);
      return q;
    }),
    listExpenses(db, dashboardExpenseFilters(f)),
    (async () => {
      // Mesmo critério da lista de locais (situação Ativa e cliente).
      let q = db.from("sites").select("id", { count: "exact", head: true }).eq("status", "ativa");
      if (f.clientId) q = q.eq("client_id", f.clientId);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    })(),
    fetchAll((a, b) => {
      let q = db.from("quotes").select("id, total_cents, status, valid_until").eq("status", "enviado").order("id").range(a, b);
      if (f.clientId) q = q.eq("client_id", f.clientId);
      return q;
    }),
  ]);
  return { requests, occurrences, workEntries, expenses, activeSites, quotes };
}
