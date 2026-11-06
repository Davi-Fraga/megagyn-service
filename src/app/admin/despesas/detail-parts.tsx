import Link from "next/link";
import { formatDateBR, formatDateTimeBR, formatTimeBR, isoDateInTz } from "@/domain/dates";
import {
  EXPENSE_STATUS_LABEL,
  EXPENSE_STATUS_TONE,
  REIMBURSEMENT_STATUS_LABEL,
  REIMBURSEMENT_STATUS_TONE,
  REVIEW_ACTION_LABEL,
  type ExpenseReviewAction,
} from "@/domain/expense-status";
import { formatBRL } from "@/domain/money";
import { cn } from "@/ui/cn";
import { DescriptionList } from "@/ui/page";
import { Badge } from "@/ui/status";
import type { ExpenseDetail } from "./expense-list";

type NameOf = (id: string | null | undefined) => string;

/** Partes do detalhe de uma compra usadas no campo (CMP-08) e na administração (ADM-11). */

export function ExpenseBadges({ detail }: { detail: ExpenseDetail }) {
  const e = detail.expense;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge tone={EXPENSE_STATUS_TONE[e.reviewStatus]}>{EXPENSE_STATUS_LABEL[e.reviewStatus]}</Badge>
      {e.reimbursement && (
        <Badge tone={REIMBURSEMENT_STATUS_TONE[e.reimbursement.status]}>{REIMBURSEMENT_STATUS_LABEL[e.reimbursement.status]}</Badge>
      )}
    </span>
  );
}

export function ExpenseFacts({ detail, name, requestHref }: { detail: ExpenseDetail; name: NameOf; requestHref?: (id: string) => string }) {
  const e = detail.expense;
  return (
    <DescriptionList
      items={[
        { label: "Valor total da compra", value: <span className="text-lg font-bold tabular-nums">{formatBRL(e.totalCents)}</span> },
        { label: "Data da compra", value: formatDateBR(e.expenseDate) },
        { label: "Fornecedor", value: e.supplierName },
        { label: "Categoria", value: e.categoryName ?? "—" },
        { label: "Forma de pagamento", value: e.paymentName ?? "—" },
        { label: "Número da nota", value: e.documentNumber ?? "—" },
        { label: "Comprador", value: name(e.purchasedBy) },
        { label: "Quem pagou", value: e.paidByKind === "empresa" ? "Empresa" : `${name(e.paidByProfileId)} (gera reembolso)` },
        {
          label: "Chamado relacionado",
          value: detail.request ? (
            requestHref ? (
              <Link href={requestHref(detail.request.id)} className="text-info underline">
                {detail.request.number}, {detail.request.title}
              </Link>
            ) : (
              `${detail.request.number}, ${detail.request.title}`
            )
          ) : (
            "—"
          ),
        },
        { label: "Itens", value: e.itemsNotes ?? "—", hidden: !e.itemsNotes },
        { label: "Enviada em", value: formatDateTimeBR(e.submittedAt), hidden: !e.submittedAt },
      ]}
    />
  );
}

/**
 * Histórico da conferência no desenho do histórico da O.S.: linha fina com marcador quadrado,
 * o mais recente na cor de acento e a devolução na de alerta.
 */
export function ReviewHistory({ detail, name }: { detail: ExpenseDetail; name: NameOf }) {
  if (detail.reviews.length === 0) return <p className="text-sm text-muted">Ainda não enviada para conferência.</p>;
  return (
    <ol>
      {detail.reviews.map((r, index) => {
        const last = index === detail.reviews.length - 1;
        return (
          <li key={r.id} className={cn("relative ml-1 border-l border-linha pl-5", !last && "pb-6")}>
            <span
              aria-hidden
              className={cn("absolute -left-1 top-2 size-[7px]", r.action === "devolvida" ? "bg-alerta" : last ? "bg-acento" : "bg-grafite")}
            />
            <p className="font-semibold leading-snug">{REVIEW_ACTION_LABEL[r.action as ExpenseReviewAction] ?? r.action}</p>
            <p className="mt-0.5 text-[0.9375rem]">
              <span className="font-semibold">{name(r.actor_id)}</span>
              <span className="ml-2 text-muted">{`${formatDateBR(isoDateInTz(new Date(r.created_at)))} às ${formatTimeBR(r.created_at)}`}</span>
            </p>
            {r.reason && <p className="mt-1.5 max-w-[60ch] whitespace-pre-line text-[0.95rem]">Motivo: {r.reason}</p>}
          </li>
        );
      })}
    </ol>
  );
}

export function ReimbursementFacts({ detail, name }: { detail: ExpenseDetail; name: NameOf }) {
  const r = detail.reimbursement;
  if (!r) return <p className="text-sm text-muted">Paga pela empresa: não há reembolso.</p>;
  const balance = r.amount_due_cents - r.amount_paid_cents;
  return (
    <div className="space-y-3">
      <DescriptionList
        items={[
          { label: "Reembolsar para", value: name(r.payee_profile_id) },
          { label: "Situação", value: <Badge tone={REIMBURSEMENT_STATUS_TONE[r.status]}>{REIMBURSEMENT_STATUS_LABEL[r.status]}</Badge> },
          { label: "Valor a reembolsar", value: formatBRL(r.amount_due_cents) },
          { label: "Já reembolsado", value: formatBRL(r.amount_paid_cents) },
          { label: "Saldo", value: <span className="font-bold">{formatBRL(balance)}</span> },
          { label: "Último registro", value: r.settled_at ? `${formatDateTimeBR(r.settled_at)}, por ${name(r.settled_by)}` : "—" },
        ]}
      />
      {r.settlement_notes && (
        <div>
          <p className="mb-1 text-[0.8125rem] text-muted">Pagamentos registrados</p>
          <ul className="divide-y divide-linha border-y border-linha text-[0.95rem] tabular-nums">
            {r.settlement_notes.split("\n").map((line, i) => (
              <li key={i} className="py-1.5">
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-sm text-muted">O reembolso é independente da conferência e não faz transferência bancária.</p>
    </div>
  );
}

/** Última devolução (motivo exibido em destaque para quem vai corrigir). */
export function lastReturnReason(detail: ExpenseDetail): string | null {
  const last = [...detail.reviews].reverse().find((r) => r.action === "devolvida");
  return last?.reason ?? null;
}
