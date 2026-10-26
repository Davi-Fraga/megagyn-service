import { PencilLine } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDateBR, todayIso } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { ExpenseBadges, ExpenseFacts, lastReturnReason, ReimbursementFacts, ReviewHistory } from "@/app/admin/despesas/detail-parts";
import { getExpenseDetail } from "@/app/admin/despesas/expense-list";
import { requireProfile } from "@/server/auth";
import { loadProfiles } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { AllocationSummaryTable } from "@/ui/allocation-table";
import { Notice, PageHeader, Panel } from "@/ui/page";
import { PhotoGrid } from "@/ui/photo-grid";
import { ExpenseForm, type ExpenseFormInitial } from "../expense-form";
import { loadExpenseFormOptions } from "../options";

export const metadata: Metadata = { title: "Compra" };

const DONE: Record<string, string> = {
  enviada: "Compra enviada para conferência.",
  reenviada: "Alteração salva. A compra voltou para conferência da administração.",
  corrigida: "Correção enviada. A compra voltou para conferência.",
  rascunho: "Rascunho salvo. Envie para conferência quando terminar.",
  salva: "Alterações salvas.",
};

export default async function PurchasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feito?: string }>;
}) {
  const profile = await requireProfile(["foreman", "admin"]);
  const { id } = await params;
  const { feito } = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const db = await createSupabaseServer();
  const [detail, profiles] = await Promise.all([getExpenseDetail(db, id), loadProfiles(db)]);
  if (!detail) notFound();
  const e = detail.expense;
  const canEdit = profile.role === "admin" || e.createdBy === profile.id;
  const editOpen = e.reviewStatus === "rascunho" || e.reviewStatus === "devolvido_para_correcao";
  const options = canEdit
    ? await loadExpenseFormOptions(
        db,
        e.allocations.map((a) => ({ id: a.siteId, name: a.siteName, clientName: a.clientName })),
      )
    : null;
  const initial: ExpenseFormInitial = {
    expenseId: e.id,
    wasStatus: e.reviewStatus,
    expenseDate: e.expenseDate,
    supplierId: detail.supplierId,
    supplierNameFree: detail.supplierNameFree,
    categoryId: detail.categoryId,
    description: e.description,
    itemsNotes: e.itemsNotes,
    totalCents: e.totalCents,
    paymentMethodId: detail.paymentMethodId,
    documentNumber: e.documentNumber,
    paidByKind: e.paidByKind,
    purchasedBy: e.purchasedBy,
    paidByProfileId: e.paidByProfileId,
    serviceRequestId: detail.serviceRequestId,
    allocations: e.allocations.map((a) => ({ siteId: a.siteId, amountCents: a.amountCents, purpose: a.purpose })),
    receiptCount: detail.receipts.filter((r) => !r.revoked).length,
  };
  const returnReason = e.reviewStatus === "devolvido_para_correcao" ? lastReturnReason(detail) : null;
  const form = options && <ExpenseForm initial={initial} {...options} today={todayIso()} />;

  return (
    <>
      <PageHeader
        back={{ href: "/campo/compras", label: "Minhas compras" }}
        eyebrow={`${formatDateBR(e.expenseDate)} · ${e.supplierName}`}
        title={e.description}
        description={<ExpenseBadges detail={detail} />}
      />
      {feito && DONE[feito] && (
        <div className="mb-4">
          <Notice tone="ok">{DONE[feito]}</Notice>
        </div>
      )}
      {returnReason && (
        <section className="mb-5 overflow-hidden rounded-panel border border-alerta bg-papel">
          <div aria-hidden className="faixa-alerta h-2" />
          <div className="space-y-1 p-4">
            <h2 className="font-bold">Devolvida pela administração</h2>
            <p className="whitespace-pre-line">{returnReason}</p>
            <p className="text-sm text-muted">Corrija abaixo e toque em “Reenviar para conferência”.</p>
          </div>
        </section>
      )}

      <div className="space-y-5">
        {form && editOpen && (
          <Panel title={e.reviewStatus === "rascunho" ? "Continuar a compra" : "Corrigir a compra"}>{form}</Panel>
        )}

        <Panel title="Compra">
          <ExpenseFacts detail={detail} name={profiles.name} requestHref={(rid) => `/campo/chamados/${rid}`} />
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

        {form && !editOpen && (
          <details className="rounded-panel border border-linha bg-papel">
            <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 font-bold">
              <PencilLine aria-hidden className="size-5" /> Corrigir dados da compra
            </summary>
            <div className="space-y-4 border-t border-linha p-4">
              {e.reviewStatus === "aprovado" && (
                <Notice tone="alerta">Alterar valor ou rateio devolve a compra para conferência.</Notice>
              )}
              {form}
            </div>
          </details>
        )}

        <Panel title="Reembolso">
          <ReimbursementFacts detail={detail} name={profiles.name} />
        </Panel>

        <Panel title="Conferência">
          <ReviewHistory detail={detail} name={profiles.name} />
        </Panel>
      </div>
    </>
  );
}
