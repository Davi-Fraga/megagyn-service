import { isValidIsoDate } from "./dates";
import type { ExpenseReviewStatus } from "./expense-totals";
import { UUID_RE } from "./ids";

/** Filtros de despesas: a tela, o CSV e o PDF leem os mesmos parâmetros (totais conciliam). */
export type ExpenseFilters = {
  /** Período pela data da compra (expense_date), inclusivo. */
  from: string | null;
  to: string | null;
  /** Obra: compras com parcela nesta obra; os totais passam a ser o valor atribuído a ela. */
  siteId: string | null;
  supplierId: string | null;
  purchaserId: string | null;
  categoryId: string | null;
  /** null = todas as enviadas (rascunhos só aparecem quando pedidos explicitamente). */
  status: ExpenseReviewStatus | null;
  q: string | null;
};

export const EXPENSE_STATUSES: readonly ExpenseReviewStatus[] = ["enviado_para_conferencia", "aprovado", "devolvido_para_correcao", "rascunho"];

type Params = Record<string, string | string[] | undefined>;
const one = (p: Params, k: string) => {
  const v = p[k];
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
};
const uuid = (v: string | null) => (v && UUID_RE.test(v) ? v : null);
const date = (v: string | null) => (v && isValidIsoDate(v) ? v : null);

export function parseExpenseFilters(p: Params): ExpenseFilters {
  const status = one(p, "situacao");
  return {
    from: date(one(p, "de")),
    to: date(one(p, "ate")),
    siteId: uuid(one(p, "obra")),
    supplierId: uuid(one(p, "fornecedor")),
    purchaserId: uuid(one(p, "comprador")),
    categoryId: uuid(one(p, "categoria")),
    status: EXPENSE_STATUSES.includes(status as ExpenseReviewStatus) ? (status as ExpenseReviewStatus) : null,
    q:
      (one(p, "q") ?? "")
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60) || null,
  };
}

export function expenseFiltersToQuery(f: ExpenseFilters): string {
  const q = new URLSearchParams();
  if (f.from) q.set("de", f.from);
  if (f.to) q.set("ate", f.to);
  if (f.siteId) q.set("obra", f.siteId);
  if (f.supplierId) q.set("fornecedor", f.supplierId);
  if (f.purchaserId) q.set("comprador", f.purchaserId);
  if (f.categoryId) q.set("categoria", f.categoryId);
  if (f.status) q.set("situacao", f.status);
  if (f.q) q.set("q", f.q);
  return q.toString();
}
