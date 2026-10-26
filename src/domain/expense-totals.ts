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
  allocations: ReadonlyArray<{ siteId: string; amountCents: number }>;
};

export type SiteTotals = BucketTotals & { siteId: string };

export type ExpenseTotals = {
  /** Consolidado da empresa: soma de total_cents de cada compra (uma vez). */
  company: BucketTotals;
  counts: BucketTotals;
  /** Valor atribuído a cada obra pelas parcelas do rateio. */
  bySite: SiteTotals[];
};

const zero = (): BucketTotals => ({ approved: 0, inReview: 0, returned: 0, draft: 0 });

export function summarizeExpenses(expenses: readonly ExpenseForTotals[]): ExpenseTotals {
  const company = zero();
  const counts = zero();
  const sites = new Map<string, SiteTotals>();

  for (const e of expenses) {
    const bucket = BUCKET_OF_STATUS[e.reviewStatus];
    company[bucket] = sumCents([company[bucket], e.totalCents]);
    counts[bucket] += 1;
    for (const a of e.allocations) {
      const site = sites.get(a.siteId) ?? { siteId: a.siteId, ...zero() };
      site[bucket] = sumCents([site[bucket], a.amountCents]);
      sites.set(a.siteId, site);
    }
  }

  const bySite = [...sites.values()].sort(
    (x, y) => y.approved + y.inReview - (x.approved + x.inReview) || x.siteId.localeCompare(y.siteId),
  );
  return { company, counts, bySite };
}

export type Headline = {
  /** "empresa" = consolidado (total das compras); "obra" = atribuído àquela obra pelo rateio. */
  scope: "empresa" | "obra";
  values: BucketTotals;
};

/** Números do painel: com filtro de obra, só o valor atribuído a ela; sem filtro, o consolidado da empresa. */
export function headlineTotals(totals: ExpenseTotals, siteId: string | null): Headline {
  if (!siteId) return { scope: "empresa", values: { ...totals.company } };
  const site = totals.bySite.find((s) => s.siteId === siteId);
  const values = zero();
  if (site) for (const k of Object.keys(values) as TotalsBucket[]) values[k] = site[k];
  return { scope: "obra", values };
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

/** Uma linha por parcela, na ordem do rateio. Com obra filtrada, só as parcelas daquela obra. */
export function allocationRows<E extends ExpenseForTotals>(expenses: readonly E[], siteId: string | null): AllocationRow<E>[] {
  const rows: AllocationRow<E>[] = [];
  for (const expense of expenses) {
    expense.allocations.forEach((a, i) => {
      if (siteId && a.siteId !== siteId) return;
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
