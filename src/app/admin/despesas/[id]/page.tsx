import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDateBR } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { formatCentsPlain } from "@/domain/money";
import { approveExpenseAction, registerReimbursementAction, returnExpenseAction } from "@/server/actions/expenses";
import { loadProfiles } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { AllocationSummaryTable } from "@/ui/allocation-table";
import { ActionForm, TextField } from "@/ui/form";
import { Notice, PageHeader, Panel } from "@/ui/page";
import { PhotoGrid } from "@/ui/photo-grid";
import { ReasonAction } from "@/ui/reason-action";
import { ExpenseBadges, ExpenseFacts, ReimbursementFacts, ReviewHistory } from "../detail-parts";
import { getExpenseDetail } from "../expense-list";

export const metadata: Metadata = { title: "Compra" };

const DONE: Record<string, string> = {
  aprovada: "Compra aprovada.",
  devolvida: "Compra devolvida para correção. O encarregado foi avisado com o motivo.",
  pago: "Pagamento registrado. Ainda há saldo a reembolsar.",
  quitado: "Pagamento registrado. Reembolso quitado.",
};

export default async function AdminExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feito?: string }>;
}) {
  const { id } = await params;
  const { feito } = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const db = await createSupabaseServer();
  const [detail, profiles] = await Promise.all([getExpenseDetail(db, id), loadProfiles(db)]);
  if (!detail) notFound();
  const e = detail.expense;
  const r = detail.reimbursement;
  const balance = r ? r.amount_due_cents - r.amount_paid_cents : 0;
  const canApprove = e.reviewStatus === "enviado_para_conferencia";
  const canReturn = e.reviewStatus === "enviado_para_conferencia" || e.reviewStatus === "aprovado";

  return (
    <>
      <PageHeader
        back={{ href: "/admin/despesas", label: "Compras e despesas" }}
        eyebrow={`${formatDateBR(e.expenseDate)}, ${e.supplierName}, por ${profiles.name(e.purchasedBy)}`}
        title={e.description}
        description={<ExpenseBadges detail={detail} />}
      />
      {feito && DONE[feito] && (
        <div className="mb-4">
          <Notice tone="ok">{DONE[feito]}</Notice>
        </div>
      )}

      {/* grid-cols-1: sem ela, a coluna única do celular cresce além da tela. */}
      <div className="grid grid-cols-1 gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-10">
          <Panel title="Compra">
            <ExpenseFacts detail={detail} name={profiles.name} requestHref={(rid) => `/admin/chamados/${rid}`} />
          </Panel>
          <Panel title="Rateio entre obras">
            <AllocationSummaryTable
              allocations={e.allocations.map((a) => ({ siteName: a.siteName, clientName: a.clientName, amountCents: a.amountCents, purpose: a.purpose }))}
              totalCents={e.totalCents}
            />
          </Panel>
          <Panel title="Comprovantes">
            <PhotoGrid photos={detail.receipts} emptyText="Nenhum comprovante anexado." />
          </Panel>
          <Panel title="Histórico da conferência">
            <ReviewHistory detail={detail} name={profiles.name} />
          </Panel>
        </div>

        <aside className="space-y-10">
          <Panel title="Conferência">
            {e.reviewStatus === "rascunho" && <p className="text-sm text-muted">Rascunho: ainda não foi enviada para conferência.</p>}
            {e.reviewStatus === "devolvido_para_correcao" && (
              <p className="text-sm text-muted">Devolvida para correção. Aguardando o encarregado corrigir e reenviar.</p>
            )}
            {e.reviewStatus === "aprovado" && (
              <p className="mb-3 text-sm text-muted">
                Aprovada. Se o encarregado alterar valor, data, pagador ou rateio, ela volta sozinha para conferência.
              </p>
            )}
            {canApprove && (
              <div className="mb-3">
                <ActionForm action={approveExpenseAction} submitLabel="Aprovar compra" pendingLabel="Aprovando…">
                  <input type="hidden" name="expense_id" value={e.id} />
                  <TextField label="Observação da aprovação" name="note" maxLength={300} />
                </ActionForm>
              </div>
            )}
            {canReturn && (
              <ReasonAction
                action={returnExpenseAction}
                hidden={{ expense_id: e.id }}
                label="Devolver para correção"
                confirmLabel="Confirmar devolução"
                reasonLabel="O que precisa ser corrigido"
                reasonHint="O encarregado recebe este motivo."
                variant="danger"
              />
            )}
          </Panel>

          <Panel title="Reembolso">
            <ReimbursementFacts detail={detail} name={profiles.name} />
            {r && balance > 0 && (
              <div className="mt-4 border-t border-linha pt-4">
                <ActionForm action={registerReimbursementAction} submitLabel="Registrar pagamento" pendingLabel="Registrando…" resetOnSuccess>
                  <input type="hidden" name="expense_id" value={e.id} />
                  <input type="hidden" name="return_to" value={`/admin/despesas/${e.id}`} />
                  <TextField label="Valor pago (R$)" name="amount" required inputMode="decimal" defaultValue={formatCentsPlain(balance)} />
                  <TextField label="Observação" name="notes" maxLength={200} placeholder="Ex.: PIX em 25/10" />
                </ActionForm>
              </div>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}
