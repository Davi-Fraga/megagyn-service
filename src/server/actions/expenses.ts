"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fieldError, toActionError, type ActionState } from "@/domain/action-errors";
import { fdAllocations } from "@/domain/expense-form";
import { fdCaptions, fdDate, fdMoney, fdStr, fdUuid, fdUuids } from "@/domain/form-data";
import { newId } from "@/domain/ids";
import { validateAllocations } from "@/domain/money";
import { requireProfile } from "@/server/auth";
import { errorInfo, log } from "@/server/log";
import { createSupabaseServer, type ServerDb } from "@/server/supabase/server";

/**
 * Compras/despesas INTERNAS: registro com rateio (campo), conferência e reembolso (administração).
 * Toda regra é imposta de novo no banco (expense_save / expense_approve / expense_return /
 * reimbursement_register_payment); aqui só antecipamos mensagens amigáveis.
 */

/** Campo obrigatório ausente vai como null: a função do banco devolve a mensagem amigável com o campo. */
const nul = <T,>(v: T | null): T => v as T;

function key(fd: FormData): string {
  return fdUuid(fd, "client_request_id") ?? newId();
}

/**
 * toActionError já converte o `hint` do banco para snake_case (receipts → receipt_ids).
 * Aqui só os campos cujo input tem outro nome (valores digitados em R$, fornecedor livre).
 */
const FIELD_OF_HINT: Record<string, string> = {
  total_cents: "total",
  supplier: "supplier_name_free",
  photo_ids: "receipt_ids",
  amount_cents: "amount",
};

function fail(error: unknown, event: string): ActionState {
  const state = toActionError(error);
  if (state.message?.startsWith("Não foi possível")) log.error(event, errorInfo(error));
  if (state.fieldErrors) {
    state.fieldErrors = Object.fromEntries(Object.entries(state.fieldErrors).map(([k, v]) => [FIELD_OF_HINT[k] ?? k, v]));
  }
  return state;
}

function refresh() {
  revalidatePath("/", "layout");
}

async function saveCaptions(db: ServerDb, fd: FormData) {
  const captions = fdCaptions(fd);
  if (Object.keys(captions).length > 0) await db.rpc("attachment_set_captions", { p_captions: captions });
}

// ---------------------------------------------------------------------------
// Campo (encarregado; a administração também pode registrar)
// ---------------------------------------------------------------------------

/** Cria ou altera uma compra. `intent=draft` salva sem enviar para conferência. */
export async function saveExpenseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const profile = await requireProfile(["admin", "foreman"]);
  const db = await createSupabaseServer();
  const expenseId = fdUuid(fd, "expense_id");
  const submit = fdStr(fd, "intent") !== "draft";

  const totalCents = fdMoney(fd, "total");
  if (totalCents === null || totalCents <= 0) {
    return fieldError("total", "Informe o valor total da compra (maior que zero). Ex.: 1.000,00");
  }
  const allocations = fdAllocations(fd);
  const check = validateAllocations(totalCents, allocations);
  if (!check.ok) return fieldError("allocations", check.errors[0]!.message);

  const paidByKind = fdStr(fd, "paid_by_kind") === "colaborador" ? "colaborador" : "empresa";
  const supplierId = fdUuid(fd, "supplier_id");
  const { data, error } = await db.rpc("expense_save", {
    p_client_request_id: key(fd),
    p_expense_id: expenseId ?? undefined,
    p_expense_date: nul(fdDate(fd, "expense_date")),
    p_description: fdStr(fd, "description") ?? "",
    p_total_cents: totalCents,
    p_allocations: allocations.map((a) => ({ site_id: a.siteId, amount_cents: a.amountCents, purpose: a.purpose })),
    p_supplier_id: supplierId ?? undefined,
    p_supplier_name_free: supplierId ? undefined : (fdStr(fd, "supplier_name_free") ?? undefined),
    p_expense_category_id: fdUuid(fd, "expense_category_id") ?? undefined,
    p_items_notes: fdStr(fd, "items_notes") ?? undefined,
    p_payment_method_id: fdUuid(fd, "payment_method_id") ?? undefined,
    p_document_number: fdStr(fd, "document_number") ?? undefined,
    p_paid_by_kind: paidByKind,
    // Na edição pela administração, mantém o comprador/pessoa a reembolsar originais
    // (para o encarregado o banco sempre usa o próprio usuário).
    p_purchased_by: profile.role === "admin" ? (fdUuid(fd, "purchased_by") ?? undefined) : undefined,
    p_paid_by_profile_id: paidByKind === "colaborador" && profile.role === "admin" ? (fdUuid(fd, "paid_by_profile_id") ?? undefined) : undefined,
    p_service_request_id: fdUuid(fd, "service_request_id") ?? undefined,
    p_receipt_ids: fdUuids(fd, "receipt_ids"),
    p_submit: submit,
  });
  if (error || !data) return fail(error, "expense.save_fail");
  await saveCaptions(db, fd);
  refresh();

  redirect(`/campo/compras/${data.id}?feito=${doneCode(fdStr(fd, "was_status"), data.review_status)}`);
}

/** Aviso exibido após salvar, conforme a situação anterior e a nova. */
function doneCode(was: string | null, now: string): string {
  if (now === "rascunho") return "rascunho";
  if (now !== "enviado_para_conferencia") return "salva";
  if (was === "aprovado") return "reenviada";
  if (was === "devolvido_para_correcao") return "corrigida";
  if (was === "enviado_para_conferencia") return "salva";
  return "enviada";
}

// ---------------------------------------------------------------------------
// Administração: conferência e reembolso
// ---------------------------------------------------------------------------

export async function approveExpenseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const id = fdUuid(fd, "expense_id");
  if (!id) return { ok: false, message: "Compra não encontrada." };
  const { error } = await db.rpc("expense_approve", { p_expense_id: id, p_note: fdStr(fd, "note") ?? undefined });
  if (error) return fail(error, "expense.approve_fail");
  refresh();
  redirect(`/admin/despesas/${id}?feito=aprovada`);
}

export async function returnExpenseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const id = fdUuid(fd, "expense_id");
  if (!id) return { ok: false, message: "Compra não encontrada." };
  const { error } = await db.rpc("expense_return", { p_expense_id: id, p_reason: fdStr(fd, "reason") ?? "" });
  if (error) return fail(error, "expense.return_fail");
  refresh();
  redirect(`/admin/despesas/${id}?feito=devolvida`);
}

/** Quitação manual do reembolso (sem transferência bancária pelo sistema). */
export async function registerReimbursementAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const id = fdUuid(fd, "expense_id");
  if (!id) return { ok: false, message: "Compra não encontrada." };
  const amount = fdMoney(fd, "amount");
  if (amount === null || amount <= 0) return fieldError("amount", "Informe o valor pago (maior que zero). Ex.: 250,00");
  // Com a chave, o toque repetido depois de uma resposta perdida não lança o pagamento de novo (B-09).
  const { data, error } = await db.rpc("reimbursement_register_payment", {
    p_expense_id: id,
    p_amount_cents: amount,
    p_notes: fdStr(fd, "notes") ?? undefined,
    p_client_request_id: key(fd),
  });
  if (error || !data) return fail(error, "reimbursement.pay_fail");
  refresh();
  // A linha muda de grupo (pendente → parcial → quitado): o aviso vai para o topo da página.
  const back = fdStr(fd, "return_to");
  if (back && /^\/admin\/[a-z0-9/-]*$/i.test(back)) redirect(`${back}?feito=${data.status === "quitado" ? "quitado" : "pago"}`);
  return {
    ok: true,
    message: data.status === "quitado" ? "Pagamento registrado. Reembolso quitado." : "Pagamento registrado. Ainda há saldo a reembolsar.",
  };
}
