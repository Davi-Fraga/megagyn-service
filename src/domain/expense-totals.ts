/**
 * Totais de compras/despesas INTERNAS (nunca exibidos a clientes e nunca somados a
 * orçamentos ou diárias faturáveis).
 *
 * Duas leituras que NUNCA se somam:
 *  - consolidado da empresa = soma de expenses.total_cents (cada compra conta uma vez);
 *  - atribuído por obra     = soma das parcelas do rateio (expense_allocations.amount_cents).
 * Como o banco garante soma das parcelas = total, a soma do atribuído a todas as obras
 * é igual ao consolidado; uma compra de R$ 1.000,00 rateada 600/400 vale R$ 1.000,00, não R$ 2.000,00.
 */
import { sumCents } from "./money";

export type ExpenseReviewStatus = "rascunho" | "enviado_para_conferencia" | "aprovado" | "devolvido_para_correcao";

/** Grupos dos totais: aprovadas e em conferência ficam sempre separadas. */
export type TotalsBucket = "approved" | "inReview" | "returned" | "draft";
export type BucketTotals = Record<TotalsBucket, number>;

export const BUCKET_OF_STATUS: Record<ExpenseReviewStatus, TotalsBucket> = {
  aprovado: "approved",
  enviado_para_conferencia: "inReview",
  devolvido_para_correcao: "returned",
  rascunho: "draft",
};

export type ExpenseForTotals = {
  id: string;
  totalCents: number;
  reviewStatus: ExpenseReviewStatus;
  /** clientId: cliente dono do local da parcela (para o filtro de cliente). */
  allocations: ReadonlyArray<{ siteId: string; amountCents: number; clientId?: string | null }>;
};

export type SiteTotals = BucketTotals & { siteId: string };
export type ClientTotals = BucketTotals & { clientId: string };

export type ExpenseTotals = {
  /** Consolidado da empresa: soma de total_cents de cada compra (uma vez). */
  company: BucketTotals;
  counts: BucketTotals;
  /** Valor atribuído a cada obra pelas parcelas do rateio. */
  bySite: SiteTotals[];
  /** Valor atribuído a cada cliente: soma das parcelas dos locais dele. */
  byClient: ClientTotals[];
};

const zero = (): BucketTotals => ({ approved: 0, inReview: 0, returned: 0, draft: 0 });

export function summarizeExpenses(expenses: readonly ExpenseForTotals[]): ExpenseTotals {
  const company = zero();
  const counts = zero();
  const sites = new Map<string, SiteTotals>();
  const clients = new Map<string, ClientTotals>();

  for (const e of expenses) {
    const bucket = BUCKET_OF_STATUS[e.reviewStatus];
    company[bucket] = sumCents([company[bucket], e.totalCents]);
    counts[bucket] += 1;
    for (const a of e.allocations) {
      const site = sites.get(a.siteId) ?? { siteId: a.siteId, ...zero() };
      site[bucket] = sumCents([site[bucket], a.amountCents]);
      sites.set(a.siteId, site);
      if (!a.clientId) continue;
      const client = clients.get(a.clientId) ?? { clientId: a.clientId, ...zero() };
      client[bucket] = sumCents([client[bucket], a.amountCents]);
      clients.set(a.clientId, client);
    }
  }

  const bySite = [...sites.values()].sort(
    (x, y) => y.approved + y.inReview - (x.approved + x.inReview) || x.siteId.localeCompare(y.siteId),
  );
  return { company, counts, bySite, byClient: [...clients.values()] };
}

export type HeadlineScope = "empresa" | "obra" | "cliente";

export type Headline<S extends HeadlineScope = HeadlineScope> = {
  /** "empresa" = consolidado (total das compras); "obra"/"cliente" = atribuído pelas parcelas do rateio. */
  scope: S;
  values: BucketTotals;
};

const pick = (row: BucketTotals | undefined): BucketTotals => {
  const values = zero();
  if (row) for (const k of Object.keys(values) as TotalsBucket[]) values[k] = row[k];
  return values;
};

/**
 * Números da lista de despesas e do painel (a mesma soma nos dois): com filtro de obra, só o
 * valor atribuído a ela; com filtro de cliente, as parcelas dos locais dele; sem filtro, o
 * consolidado da empresa.
 */
export function headlineTotals(totals: ExpenseTotals, siteId: string | null): Headline<"empresa" | "obra">;
export function headlineTotals(totals: ExpenseTotals, siteId: string | null, clientId: string | null): Headline;
export function headlineTotals(totals: ExpenseTotals, siteId: string | null, clientId: string | null = null): Headline {
  if (siteId) return { scope: "obra", values: pick(totals.bySite.find((s) => s.siteId === siteId)) };
  if (clientId) return { scope: "cliente", values: pick(totals.byClient.find((c) => c.clientId === clientId)) };
  return { scope: "empresa", values: { ...totals.company } };
}

export type AllocationRow<E extends ExpenseForTotals> = {
  expense: E;
  siteId: string;
  /** Total da compra (repetido em cada parcela; não somar esta coluna). */
  totalCents: number;
  /** Valor da parcela atribuído à obra (esta coluna soma sem duplicar). */
  attributedCents: number;
  /** Posição da parcela (1-based) e quantidade de parcelas da compra. */
  index: number;
  count: number;
};

/** Uma linha por parcela, na ordem do rateio. Com obra ou cliente filtrado, só as parcelas deles. */
export function allocationRows<E extends ExpenseForTotals>(expenses: readonly E[], siteId: string | null, clientId: string | null = null): AllocationRow<E>[] {
  const rows: AllocationRow<E>[] = [];
  for (const expense of expenses) {
    expense.allocations.forEach((a, i) => {
      if (siteId && a.siteId !== siteId) return;
      if (clientId && a.clientId !== clientId) return;
      rows.push({
        expense,
        siteId: a.siteId,
        totalCents: expense.totalCents,
        attributedCents: a.amountCents,
        index: i + 1,
        count: expense.allocations.length,
      });
    });
  }
  return rows;
}
