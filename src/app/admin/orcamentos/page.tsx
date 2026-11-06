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
import { QuoteStatusBadge } from "./quote-status-badge";

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
        <div className="overflow-x-auto rounded-panel border border-linha bg-papel">
          <table className="w-full min-w-[52rem] text-left text-[0.95rem]">
            <thead className="border-b border-linha bg-concreto text-sm text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Número</th>
                <th className="px-3 py-2 font-semibold">Cliente</th>
                <th className="px-3 py-2 font-semibold">Título / local</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
                <th className="px-3 py-2 font-semibold">Situação</th>
                <th className="px-3 py-2 font-semibold">Emissão</th>
                <th className="px-3 py-2 font-semibold">Validade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {rows.map((r) => {
                const place = r.site?.name ?? r.service_location_text;
                return (
                  <tr key={r.id} className="align-top hover:bg-concreto/60">
                    <td className="px-3 py-2.5">
                      <Link href={`/admin/orcamentos/${r.id}`} className="tipo-condensada whitespace-nowrap text-[1.0625rem] underline-offset-4 hover:underline">
                        {r.number}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">{r.client?.display_name ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <Link href={`/admin/orcamentos/${r.id}`} className="font-semibold hover:underline">
                        {r.title || place || "Sem título"}
                      </Link>
                      {r.title && place && <p className="text-sm text-muted">{place}</p>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatBRL(r.total_cents)}</td>
                    <td className="px-3 py-2.5">
                      <QuoteStatusBadge status={effectiveQuoteStatus(r.status as QuoteStatus, r.valid_until, today)} />
                    </td>
                    <td className="px-3 py-2.5 text-sm">{formatDateBR(r.issued_at)}</td>
                    <td className="px-3 py-2.5 text-sm">{formatDateBR(r.valid_until)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
