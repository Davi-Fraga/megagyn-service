import type { Metadata } from "next";
import Link from "next/link";
import { formatDateBR, formatDateTimeBR } from "@/domain/dates";
import {
  EXPENSE_STATUS_LABEL,
  EXPENSE_STATUS_TONE,
  REIMBURSEMENT_STATUS_LABEL,
  REIMBURSEMENT_STATUS_TONE,
  type ReimbursementStatus,
} from "@/domain/expense-status";
import { formatBRL, formatCentsPlain, sumCents } from "@/domain/money";
import { registerReimbursementAction } from "@/server/actions/expenses";
import { loadProfiles } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { ActionForm, TextField } from "@/ui/form";
import { EmptyState, Notice, PageHeader, Panel } from "@/ui/page";
import { Badge } from "@/ui/status";

export const metadata: Metadata = { title: "Reembolsos" };

const SECTIONS: Array<{ status: ReimbursementStatus; title: string; empty: string }> = [
  { status: "pendente", title: "Pendentes", empty: "Nenhum reembolso pendente." },
  { status: "parcial", title: "Pagos em parte", empty: "Nenhum reembolso parcial." },
  { status: "quitado", title: "Quitados", empty: "Nenhum reembolso quitado ainda." },
];

/** ADM-12 — reembolsos de compras pagas por colaboradores. Independe da conferência; sem transferência bancária. */
const DONE: Record<string, string> = {
  pago: "Pagamento registrado. Ainda há saldo a reembolsar.",
  quitado: "Pagamento registrado. Reembolso quitado.",
};

export default async function ReimbursementsPage({ searchParams }: { searchParams: Promise<{ feito?: string }> }) {
  const { feito } = await searchParams;
  const db = await createSupabaseServer();
  const [{ data }, profiles] = await Promise.all([
    db
      .from("reimbursements")
      .select(
        "id, expense_id, payee_profile_id, amount_due_cents, amount_paid_cents, status, settled_at, settlement_notes, expense:expenses(id, expense_date, description, total_cents, review_status, supplier_name_free, supplier:suppliers(name))",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    loadProfiles(db),
  ]);
  const list = data ?? [];
  const open = list.filter((r) => r.status !== "quitado");
  const openBalance = sumCents(open.map((r) => r.amount_due_cents - r.amount_paid_cents));

  return (
    <>
      <PageHeader
        title="Reembolsos"
        description="Compras pagas do próprio bolso pela equipe. Registre aqui o que já foi devolvido; o sistema não faz transferência."
      />
      {feito && DONE[feito] && (
        <div className="mb-4">
          <Notice tone="ok">{DONE[feito]}</Notice>
        </div>
      )}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-panel border border-linha bg-papel px-4 py-3">
          <p className="text-sm font-semibold text-muted">Saldo a reembolsar</p>
          <p className="text-2xl font-bold tabular-nums">{formatBRL(openBalance)}</p>
          <p className="text-sm text-muted">{open.length} reembolso(s) em aberto</p>
        </div>
      </div>

      <div className="space-y-5">
        {SECTIONS.map((section) => {
          const items = list.filter((r) => r.status === section.status);
          return (
            <Panel key={section.status} title={`${section.title} (${items.length})`}>
              {items.length === 0 ? (
                <EmptyState title={section.empty} />
              ) : (
                <ul className="divide-y divide-linha">
                  {items.map((r) => {
                    const balance = r.amount_due_cents - r.amount_paid_cents;
                    const e = r.expense;
                    return (
                      <li key={r.id} data-reimbursement={r.expense_id} className="grid gap-3 py-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm text-muted">
                            {formatDateBR(e?.expense_date)} · {e?.supplier?.name ?? e?.supplier_name_free ?? "—"}
                          </p>
                          <Link href={`/admin/despesas/${r.expense_id}`} className="font-semibold hover:underline">
                            {e?.description ?? "Compra"}
                          </Link>
                          <p className="text-[0.95rem]">
                            Para <b>{profiles.name(r.payee_profile_id)}</b> · devido {formatBRL(r.amount_due_cents)} · pago{" "}
                            {formatBRL(r.amount_paid_cents)} · <b>saldo {formatBRL(balance)}</b>
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge tone={REIMBURSEMENT_STATUS_TONE[r.status]}>{REIMBURSEMENT_STATUS_LABEL[r.status]}</Badge>
                            {e && <Badge tone={EXPENSE_STATUS_TONE[e.review_status]}>{EXPENSE_STATUS_LABEL[e.review_status]}</Badge>}
                          </div>
                          {r.settlement_notes && (
                            <p className="whitespace-pre-line text-sm text-muted">
                              {r.settlement_notes}
                              {r.settled_at ? `\nÚltimo registro: ${formatDateTimeBR(r.settled_at)}` : ""}
                            </p>
                          )}
                        </div>
                        {balance > 0 && (
                          <ActionForm action={registerReimbursementAction} submitLabel="Registrar pagamento" pendingLabel="Registrando…" submitSize="sm" resetOnSuccess className="space-y-3">
                            <input type="hidden" name="expense_id" value={r.expense_id} />
                            <input type="hidden" name="return_to" value="/admin/reembolsos" />
                            <TextField label="Valor pago (R$)" name="amount" required inputMode="decimal" defaultValue={formatCentsPlain(balance)} />
                            <TextField label="Observação" name="notes" maxLength={200} placeholder="Ex.: PIX em 25/10" />
                          </ActionForm>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          );
        })}
      </div>
    </>
  );
}
