import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExpenseFilters } from "@/domain/expense-filters";
import type { ReimbursementStatus } from "@/domain/expense-status";
import {
  summarizeExpenses,
  type ExpenseForTotals,
  type ExpenseReviewStatus,
} from "@/domain/expense-totals";
import type { Database } from "@/server/db/database.types";
import { loadPhotos } from "@/server/data";
import { orThrow } from "@/server/query";

/**
 * Consulta ÚNICA de despesas para a tela (ADM-11), o CSV e o PDF de despesas internas:
 * mesmos filtros → mesmos totais. Funciona com a sessão do admin (RLS) ou com a chave
 * de serviço (PDF no servidor). Busca todas as linhas do filtro (em páginas) para que os
 * totais nunca dependam de quantas linhas a tela exibe.
 */

type Db = SupabaseClient<Database>;

export type ExpenseAllocationItem = {
  siteId: string;
  clientId: string | null;
  siteName: string;
  clientName: string;
  amountCents: number;
  purpose: string;
};

export type ExpenseListRow = Omit<ExpenseForTotals, "allocations"> & {
  expenseDate: string;
  description: string;
  itemsNotes: string | null;
  supplierName: string;
  categoryName: string | null;
  paymentName: string | null;
  documentNumber: string | null;
  purchasedBy: string;
  createdBy: string;
  paidByKind: "empresa" | "colaborador";
  paidByProfileId: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reimbursement: {
    status: ReimbursementStatus;
    dueCents: number;
    paidCents: number;
  } | null;
  allocations: ExpenseAllocationItem[];
};

const PAGE = 1000;
const MAX_ROWS = 20_000;

const BASE_SELECT = `id, expense_date, description, items_notes, total_cents, review_status, paid_by_kind, paid_by_profile_id,
  purchased_by, created_by, document_number, supplier_name_free, submitted_at, reviewed_at, created_at,
  supplier:suppliers(name), category:expense_categories(name), payment:payment_methods(name),
  reimbursement:reimbursements(status, amount_due_cents, amount_paid_cents),
  allocations:expense_allocations(site_id, amount_cents, purpose, sort_order, site:sites(name, client_id, client:clients(display_name)))`;

function buildQuery(db: Db, f: ExpenseFilters) {
  // Com obra ou cliente: o embed "match" (inner) filtra as compras; "allocations" continua trazendo todas as parcelas.
  const select = f.clientId
    ? `${BASE_SELECT}, match:expense_allocations!inner(site_id, site:sites!inner(client_id))`
    : f.siteId
      ? `${BASE_SELECT}, match:expense_allocations!inner(site_id)`
      : BASE_SELECT;
  let q = db
    .from("expenses")
    .select(select, { count: "exact" })
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id");
  if (f.siteId) q = q.eq("match.site_id", f.siteId);
  if (f.clientId) q = q.eq("match.site.client_id", f.clientId);
  if (f.status) q = q.eq("review_status", f.status);
  else q = q.neq("review_status", "rascunho");
  if (f.from) q = q.gte("expense_date", f.from);
  if (f.to) q = q.lte("expense_date", f.to);
  if (f.supplierId) q = q.eq("supplier_id", f.supplierId);
  if (f.purchaserId) q = q.eq("purchased_by", f.purchaserId);
  if (f.categoryId) q = q.eq("expense_category_id", f.categoryId);
  if (f.q)
    q = q.or(
      `description.ilike.%${f.q}%,supplier_name_free.ilike.%${f.q}%,document_number.ilike.%${f.q}%`,
    );
  return q;
}

type RawRow = {
  id: string;
  expense_date: string;
  description: string;
  items_notes: string | null;
  total_cents: number;
  review_status: ExpenseReviewStatus;
  paid_by_kind: "empresa" | "colaborador";
  paid_by_profile_id: string | null;
  purchased_by: string;
  created_by: string;
  document_number: string | null;
  supplier_name_free: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  supplier: { name: string } | null;
  category: { name: string } | null;
  payment: { name: string } | null;
  reimbursement: {
    status: ReimbursementStatus;
    amount_due_cents: number;
    amount_paid_cents: number;
  } | null;
  allocations: Array<{
    site_id: string;
    amount_cents: number;
    purpose: string;
    sort_order: number;
    site: { name: string; client_id: string; client: { display_name: string } | null } | null;
  }>;
};

export function normalizeExpense(r: RawRow): ExpenseListRow {
  const allocations = [...(r.allocations ?? [])]
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order || a.site_id.localeCompare(b.site_id),
    )
    .map((a) => ({
      siteId: a.site_id,
      clientId: a.site?.client_id ?? null,
      siteName: a.site?.name ?? "Obra sem acesso",
      clientName: a.site?.client?.display_name ?? "—",
      amountCents: a.amount_cents,
      purpose: a.purpose,
    }));
  return {
    id: r.id,
    totalCents: r.total_cents,
    reviewStatus: r.review_status,
    expenseDate: r.expense_date,
    description: r.description,
    itemsNotes: r.items_notes,
    supplierName: r.supplier?.name ?? r.supplier_name_free ?? "—",
    categoryName: r.category?.name ?? null,
    paymentName: r.payment?.name ?? null,
    documentNumber: r.document_number,
    purchasedBy: r.purchased_by,
    createdBy: r.created_by,
    paidByKind: r.paid_by_kind,
    paidByProfileId: r.paid_by_profile_id,
    submittedAt: r.submitted_at,
    reviewedAt: r.reviewed_at,
    reimbursement: r.reimbursement
      ? {
          status: r.reimbursement.status,
          dueCents: r.reimbursement.amount_due_cents,
          paidCents: r.reimbursement.amount_paid_cents,
        }
      : null,
    allocations,
  };
}

export async function listExpenses(db: Db, f: ExpenseFilters) {
  const rows: ExpenseListRow[] = [];
  let total = 0;
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error, count } = await buildQuery(db, f).range(
      from,
      from + PAGE - 1,
    );
    if (error) throw error;
    total = count ?? total;
    const page = (data ?? []) as unknown as RawRow[];
    rows.push(...page.map(normalizeExpense));
    if (page.length < PAGE || rows.length >= total) break;
  }
  return {
    rows,
    total,
    truncated: rows.length < total,
    totals: summarizeExpenses(rows),
  };
}

export type ExpenseList = Awaited<ReturnType<typeof listExpenses>>;

/** Detalhe de uma compra (tela do campo e da administração). A RLS decide se a sessão pode vê-la. */
export async function getExpenseDetail(db: Db, id: string) {
  const data = orThrow(
    await db
      .from("expenses")
      .select(
        `${BASE_SELECT}, supplier_id, expense_category_id, payment_method_id, service_request_id, notes, approval_version,
       request:service_requests(id, number, title)`,
      )
      .eq("id", id)
      .maybeSingle(),
  );
  if (!data) return null;
  const raw = data as unknown as RawRow & {
    supplier_id: string | null;
    expense_category_id: string | null;
    payment_method_id: string | null;
    service_request_id: string | null;
    notes: string | null;
    request: { id: string; number: string; title: string } | null;
  };

  const [reviews, reimbursement, receipts] = await Promise.all([
    db
      .from("expense_reviews")
      .select("id, action, actor_id, reason, created_at")
      .eq("expense_id", id)
      .order("created_at")
      .order("id"),
    db.from("reimbursements").select("*").eq("expense_id", id).maybeSingle(),
    loadPhotos(db, "expense", [id]),
  ]);

  return {
    expense: normalizeExpense(raw),
    supplierId: raw.supplier_id,
    supplierNameFree: raw.supplier_name_free,
    categoryId: raw.expense_category_id,
    paymentMethodId: raw.payment_method_id,
    serviceRequestId: raw.service_request_id,
    request: raw.request,
    reviews: reviews.data ?? [],
    reimbursement: reimbursement.data,
    receipts: receipts.get(id) ?? [],
  };
}

export type ExpenseDetail = NonNullable<
  Awaited<ReturnType<typeof getExpenseDetail>>
>;
