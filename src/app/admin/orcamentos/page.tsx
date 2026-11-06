import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDateBR, todayIso } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { formatBRL } from "@/domain/money";
import { QUOTE_STATUS_LABEL, QUOTE_STATUSES, type QuoteStatus } from "@/domain/quote";
import { effectiveQuoteStatus } from "@/domain/quote-rules";
import { createSupabaseServer } from "@/server/supabase/server";
import { ButtonLink, buttonClass } from "@/ui/button";
import { EmptyState, PageHeader } from "@/ui/page";
import { DataTable } from "@/ui/data-table";
import { AlertEdge } from "@/ui/status";
import { QuoteStatusRuler } from "./quote-status-ruler";

export const metadata: Metadata = { title: "Orçamentos" };

const LIMIT = 200;

export default async function QuotesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const status = QUOTE_STATUSES.includes(one(sp.status) as QuoteStatus) ? (one(sp.status) as QuoteStatus) : null;
  const clientId = UUID_RE.test(one(sp.cliente)) ? one(sp.cliente) : null;
  const today = todayIso();

  const db = await createSupabaseServer();
  let q = db
    .from("quotes")
    .select(
      "id, number, title, status, total_cents, issued_at, valid_until, service_location_text, client:clients(display_name), site:sites!quotes_site_id_fkey(name)",
      { count: "exact" },
    )
    .order("issued_at", { ascending: false })
    .order("number", { ascending: false })
    .limit(LIMIT);
  if (clientId) q = q.eq("client_id", clientId);
  // "Expirado" é derivado (enviado com validade vencida); "Enviado" mostra só os ainda válidos.
  if (status === "expirado") q = q.or(`status.eq.expirado,and(status.eq.enviado,valid_until.lt.${today})`);
  else if (status === "enviado") q = q.eq("status", "enviado").or(`valid_until.is.null,valid_until.gte.${today}`);
  else if (status) q = q.eq("status", status);

  const [{ data, count }, clients] = await Promise.all([q, db.from("clients").select("id, display_name").order("display_name")]);
  const rows = data ?? [];
  const filtered = !!(status || clientId);

  return (
    <>
      <PageHeader
        title="Orçamentos"
        description="Propostas comerciais com itens por local, fotos e versões. Valor comercial: não é despesa nem receita."
        actions={
          <ButtonLink href="/admin/orcamentos/novo" icon={<Plus aria-hidden className="size-4" />}>
            Novo orçamento
          </ButtonLink>
        }
      />

      <form method="get" className="mb-5 grid gap-3 rounded-panel border border-linha bg-papel p-4 sm:grid-cols-[1fr_1fr_auto]">
        <label className="space-y-1 text-sm font-semibold">
          Situação
          <select name="status" defaultValue={status ?? ""} className="campo-input">
            <option value="">Todas</option>
            {QUOTE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {QUOTE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Cliente
          <select name="cliente" defaultValue={clientId ?? ""} className="campo-input">
            <option value="">Todos</option>
            {(clients.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-3">
          <button type="submit" className={buttonClass("dark")}>
            Filtrar
          </button>
          {filtered && (
            <Link href="/admin/orcamentos" className="min-h-11 content-center font-semibold text-info underline">
              Limpar
            </Link>
          )}
        </div>
      </form>

      <p className="mb-2 text-sm text-muted" aria-live="polite">
        {count ?? rows.length} orçamento(s){(count ?? 0) > rows.length ? `; mostrando os ${rows.length} mais recentes` : ""}.
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title={filtered ? "Nenhum orçamento com esses filtros." : "Nenhum orçamento ainda."}
          text="Monte a proposta com itens por local, valor global ou detalhado, fotos e condições."
          action={<ButtonLink href="/admin/orcamentos/novo">Novo orçamento</ButtonLink>}
        />
      ) : (
        <DataTable
          variant="ruler"
          minWidth="min-w-[56rem]"
          rows={rows.map((r) => ({ ...r, effective: effectiveQuoteStatus(r.status as QuoteStatus, r.valid_until, today) }))}
          rowKey={(r) => r.id}
          columns={[
            {
              header: "Número",
              headerClassName: "whitespace-nowrap",
              className: "relative",
              cell: (r) => (
                <>
                  {r.effective === "expirado" && <AlertEdge />}
                  <Link href={`/admin/orcamentos/${r.id}`} className="tipo-condensada whitespace-nowrap text-[1.0625rem] underline-offset-4 hover:underline">
                    {r.number}
                  </Link>
                </>
              ),
            },
            {
              header: "Orçamento",
              cell: (r) => {
                const place = r.site?.name ?? r.service_location_text;
                return (
                  <>
                    <Link href={`/admin/orcamentos/${r.id}`} className="text-[1.0625rem] font-semibold leading-snug hover:underline">
                      {r.title || place || "Sem título"}
                    </Link>
                    <p className="mt-0.5 text-[0.9375rem] text-muted">{[r.client?.display_name, r.title ? place : null].filter(Boolean).join(", ") || "—"}</p>
                  </>
                );
              },
            },
            { header: "Situação", className: "w-56 pt-[1.3rem]", cell: (r) => <QuoteStatusRuler status={r.effective} /> },
            {
              header: "Total",
              align: "right",
              className: "tipo-condensada whitespace-nowrap text-[1.0625rem] tabular-nums",
              cell: (r) => formatBRL(r.total_cents),
            },
            { header: "Emissão", className: "tipo-condensada text-[0.9375rem]", cell: (r) => formatDateBR(r.issued_at) },
            {
              header: "Validade",
              className: "tipo-condensada text-[0.9375rem]",
              cell: (r) => (
                <>
                  <span className="block">{formatDateBR(r.valid_until)}</span>
                  {r.effective === "expirado" && <span className="block text-erro">Validade vencida</span>}
                </>
              ),
            },
          ]}
        />
      )}
    </>
  );
}
