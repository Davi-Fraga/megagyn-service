import { NextResponse } from "next/server";
import { listExpenses, type ExpenseListRow } from "@/app/admin/despesas/expense-list";
import { toCsv, type CsvColumn } from "@/domain/csv";
import { formatDateBR, todayIso } from "@/domain/dates";
import { parseExpenseFilters } from "@/domain/expense-filters";
import { expenseCsvFileName } from "@/domain/expense-report";
import { EXPENSE_STATUS_LABEL, REIMBURSEMENT_STATUS_LABEL } from "@/domain/expense-status";
import { allocationRows, type AllocationRow } from "@/domain/expense-totals";
import { loadProfiles } from "@/server/data";
import { errorInfo, log } from "@/server/log";
import { createSupabaseServer } from "@/server/supabase/server";

export const runtime = "nodejs";

const TOTAL = "Valor total da compra (R$)";
const ATTRIBUTED = "Valor atribuído à obra (R$)";

/**
 * CSV de despesas internas (ADM-11) com os MESMOS filtros e a mesma consulta da tela.
 * Uma linha por parcela do rateio: somar "Valor atribuído à obra" dá o total da tela
 * (sem duplicar compras divididas); "Valor total da compra" se repete e não deve ser somado.
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Sessão expirada. Entre novamente.", { status: 401 });
  const { data: role } = await supabase.rpc("current_app_role");
  if (role !== "admin") return new NextResponse("Acesso não autorizado.", { status: 403 });

  const filters = parseExpenseFilters(Object.fromEntries(new URL(request.url).searchParams));
  let list;
  let profiles;
  try {
    [list, profiles] = await Promise.all([listExpenses(supabase, filters), loadProfiles(supabase)]);
  } catch (error) {
    log.error("csv.expenses_fail", errorInfo(error));
    return new NextResponse("Não foi possível gerar o CSV. Tente novamente.", { status: 500 });
  }

  const site = (r: AllocationRow<ExpenseListRow>) => r.expense.allocations[r.index - 1]!;
  const columns: CsvColumn<AllocationRow<ExpenseListRow>>[] = [
    { header: "Data da compra", value: (r) => formatDateBR(r.expense.expenseDate) },
    { header: "Fornecedor", value: (r) => r.expense.supplierName },
    { header: "Descrição", value: (r) => r.expense.description },
    { header: "Categoria", value: (r) => r.expense.categoryName },
    { header: "Comprador", value: (r) => profiles.name(r.expense.purchasedBy) },
    { header: "Quem pagou", value: (r) => (r.expense.paidByKind === "empresa" ? "Empresa" : `Colaborador: ${profiles.name(r.expense.paidByProfileId)}`) },
    { header: "Forma de pagamento", value: (r) => r.expense.paymentName },
    { header: "Nº do documento", value: (r) => r.expense.documentNumber },
    { header: "Situação da conferência", value: (r) => EXPENSE_STATUS_LABEL[r.expense.reviewStatus] },
    { header: "Reembolso", value: (r) => (r.expense.reimbursement ? REIMBURSEMENT_STATUS_LABEL[r.expense.reimbursement.status] : "") },
    { header: TOTAL, value: (r) => r.totalCents },
    { header: "Parcela", value: (r) => `${r.index} de ${r.count}` },
    { header: "Obra", value: (r) => site(r).siteName },
    { header: "Cliente", value: (r) => site(r).clientName },
    { header: "Finalidade", value: (r) => site(r).purpose },
    { header: ATTRIBUTED, value: (r) => r.attributedCents },
    { header: "ID da compra", value: (r) => r.expense.id },
  ];

  const csv = toCsv(columns, allocationRows(list.rows, filters.siteId), { money: [TOTAL, ATTRIBUTED] });
  const name = expenseCsvFileName(todayIso());
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
