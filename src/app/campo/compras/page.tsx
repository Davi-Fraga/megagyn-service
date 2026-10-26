import { ChevronRight, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDateBR } from "@/domain/dates";
import {
  EXPENSE_STATUS_LABEL,
  EXPENSE_STATUS_TONE,
  REIMBURSEMENT_STATUS_LABEL,
  REIMBURSEMENT_STATUS_TONE,
} from "@/domain/expense-status";
import { formatBRL } from "@/domain/money";
import { requireProfile } from "@/server/auth";
import { loadMyPurchaseSummary } from "@/server/purchases";
import { createSupabaseServer } from "@/server/supabase/server";
import { ButtonLink } from "@/ui/button";
import { EmptyState, Notice, PageHeader, RowList } from "@/ui/page";
import { Badge } from "@/ui/status";

export const metadata: Metadata = { title: "Minhas compras" };

export default async function MyPurchasesPage() {
  const profile = await requireProfile(["foreman", "admin"]);
  const db = await createSupabaseServer();
  const LIMIT = 150;
  const [{ data, count }, summary] = await Promise.all([
    db
      .from("expenses")
      .select(
        "id, expense_date, description, total_cents, review_status, supplier_name_free, supplier:suppliers(name), reimbursement:reimbursements(status, amount_due_cents, amount_paid_cents, payee_profile_id)",
        { count: "exact" },
      )
      .or(`created_by.eq.${profile.id},purchased_by.eq.${profile.id}`)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    // Totais vêm de consultas próprias: a lista acima mostra só as compras mais recentes.
    loadMyPurchaseSummary(db, profile.id),
  ]);
  const list = data ?? [];
  const total = count ?? list.length;
  const toReceive = summary.toReceiveCents;
  const returned = summary.returnedCount;

  return (
    <>
      <PageHeader
        title="Minhas compras"
        description="Compras que você registrou, com a conferência da administração e o reembolso."
        actions={
          <ButtonLink
            href="/campo/compras/nova"
            icon={<ShoppingCart aria-hidden className="size-5" />}
          >
            Registrar compra
          </ButtonLink>
        }
      />

      <div className="mb-4 space-y-2">
        {returned > 0 && (
          <Notice tone="alerta">
            {returned} compra(s) devolvida(s) para correção. Abra, corrija e
            reenvie.
          </Notice>
        )}
        {toReceive > 0 && (
          <Notice tone="info">
            A reembolsar para você: {formatBRL(toReceive)}.
          </Notice>
        )}
        {total > list.length && (
          <p className="text-sm text-muted">
            Mostrando as {list.length} compras mais recentes de {total}.
          </p>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="Nenhuma compra registrada."
          text="Registre a compra com a foto da nota e diga para quais obras ela foi."
          action={
            <ButtonLink href="/campo/compras/nova">Registrar compra</ButtonLink>
          }
        />
      ) : (
        <RowList>
          {list.map((e) => (
            <li key={e.id}>
              <Link
                href={`/campo/compras/${e.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-concreto"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-muted">
                      {formatDateBR(e.expense_date)} ·{" "}
                      {e.supplier?.name ?? e.supplier_name_free ?? "—"}
                    </span>
                    <span className="font-bold tabular-nums">
                      {formatBRL(e.total_cents)}
                    </span>
                  </div>
                  <p className="truncate font-semibold">{e.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={EXPENSE_STATUS_TONE[e.review_status]}>
                      {EXPENSE_STATUS_LABEL[e.review_status]}
                    </Badge>
                    {e.reimbursement && (
                      <Badge
                        tone={REIMBURSEMENT_STATUS_TONE[e.reimbursement.status]}
                      >
                        {REIMBURSEMENT_STATUS_LABEL[e.reimbursement.status]}
                      </Badge>
                    )}
                  </div>
                </div>
                <ChevronRight
                  aria-hidden
                  className="size-5 shrink-0 text-muted"
                />
              </Link>
            </li>
          ))}
        </RowList>
      )}
    </>
  );
}
