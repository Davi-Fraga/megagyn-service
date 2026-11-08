import { listExpenses } from "@/app/admin/despesas/expense-list";
import type { ExpenseFilters } from "@/domain/expense-filters";
import type { RequestStatus } from "@/domain/request-status";
import { listOccurrences } from "./agenda";
import type { ServerDb } from "./data";

export type DashboardFilters = { clientId: string | null; siteId: string | null; personId: string | null; from: string; to: string; today: string };

/** Filtros da lista de despesas que correspondem aos do painel (profissional = comprador). */
export function dashboardExpenseFilters(f: DashboardFilters): ExpenseFilters {
  return { from: f.from, to: f.to, siteId: f.siteId, clientId: f.clientId, purchaserId: f.personId, supplierId: null, categoryId: null, status: null, q: null };
}

type LabelCount = { label: string | null; count: number };

/** Linha de "O que precisa de você", já com número e título. */
export type AttentionRow = {
  id: string;
  number: string;
  title: string;
  status: RequestStatus;
  due_date: string | null;
  site_id: string;
  overdue: boolean;
  pending_reason: string | null;
  assignee_ids: string[];
};

/** Resultado de `public.dashboard_summary` (migração 20261106000100). */
export type DashboardSummary = {
  requests: {
    by_status: Partial<Record<RequestStatus, number>>;
    not_closed: number;
    overdue: number;
    new_today: number;
    pending_by_reason: LabelCount[];
    pending_by_owner: LabelCount[];
  };
  attention: { total: number; rows: AttentionRow[] };
  work_entries: { total: number; by_site: Array<{ site_id: string; count: number }> };
  active_sites: number;
  open_quotes: { count: number; total_cents: number };
};

/** Tamanho da fila "O que precisa de você" no painel. */
export const ATTENTION_SIZE = 8;

/**
 * Dados dos cartões do painel. Os chamados, as atividades, os locais e os orçamentos são
 * contados no banco (`dashboard_summary`), com a RLS de quem chama: nada de baixar as linhas
 * só para contar. Tarefas e despesas usam a mesma função da lista que o cartão abre (B-11).
 */
export async function loadDashboardRows(db: ServerDb, f: DashboardFilters) {
  const [summary, occurrences, expenses] = await Promise.all([
    (async () => {
      const { data, error } = await db.rpc("dashboard_summary", {
        p_today: f.today,
        p_from: f.from,
        p_to: f.to,
        p_client_id: f.clientId ?? undefined,
        p_site_id: f.siteId ?? undefined,
        p_person_id: f.personId ?? undefined,
        p_attention_size: ATTENTION_SIZE,
      });
      if (error) throw error;
      return data as unknown as DashboardSummary;
    })(),
    listOccurrences(db, { from: f.today, to: f.today, siteId: f.siteId, clientId: f.clientId, personId: f.personId }),
    listExpenses(db, dashboardExpenseFilters(f)),
  ]);
  return { summary, occurrences, expenses };
}
