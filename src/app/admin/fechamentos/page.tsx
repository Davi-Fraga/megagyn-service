import type { Metadata } from "next";
import Link from "next/link";
import { formatDateTimeBR, monthName, monthTitle, todayIso } from "@/domain/dates";
import { loadSites } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { buttonClass } from "@/ui/button";
import { EmptyState, PageHeader, Panel } from "@/ui/page";
import { cn } from "@/ui/cn";
import { DataTable } from "@/ui/data-table";

export const metadata: Metadata = { title: "Fechamento mensal" };

export default async function ClosingsPage() {
  const db = await createSupabaseServer();
  const [sites, closings] = await Promise.all([
    loadSites(db),
    db
      .from("monthly_closings")
      .select("id, period_year, period_month, status, client:clients(display_name), site:sites(name), current:closing_versions!monthly_closings_current_version_fk(version_no, generated_at)")
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false })
      .limit(60),
  ]);
  const [ty, tm] = todayIso().split("-").map(Number) as [number, number];
  const defaultMonth = tm === 1 ? 12 : tm - 1;
  const defaultYear = tm === 1 ? ty - 1 : ty;
  const byClient = new Map<string, { name: string; sites: typeof sites }>();
  for (const s of sites) {
    const entry = byClient.get(s.client_id) ?? { name: s.clientName, sites: [] };
    entry.sites.push(s);
    byClient.set(s.client_id, entry);
  }

  return (
    <>
      <PageHeader
        title="Fechamento mensal"
        description="Apure o mês, confira a prévia e emita a versão. O relatório usa a situação de cada chamado no último dia do mês, mesmo que ele tenha mudado depois."
      />
      <Panel title="Apurar um mês">
        <form method="get" action="/admin/fechamentos/apuracao" className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <label className="space-y-1 text-sm font-semibold">
            Cliente e unidade
            <select name="alvo" required className="campo-input">
              <option value="">Selecione…</option>
              {[...byClient.entries()].map(([clientId, c]) => (
                <optgroup key={clientId} label={c.name}>
                  <option value={`${clientId}:todas`}>{c.name} — todas as unidades</option>
                  {c.sites.map((s) => (
                    <option key={s.id} value={`${clientId}:${s.id}`}>
                      {c.name} — {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold">
            Mês
            <select name="mes" defaultValue={String(defaultMonth)} className="campo-input">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {monthName(m).replace(/^./, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold">
            Ano
            <input name="ano" type="number" min={2020} max={2100} defaultValue={defaultYear} className="campo-input" />
          </label>
          <button type="submit" className={buttonClass("primary")}>
            Apurar
          </button>
        </form>
      </Panel>

      <h2 className="mb-2 mt-8 text-lg font-bold">Fechamentos emitidos</h2>
      {(closings.data ?? []).length === 0 ? (
        <EmptyState title="Nenhum fechamento emitido ainda." text="Apure um mês acima, confira a prévia e emita a primeira versão." />
      ) : (
        <DataTable
          variant="ruler"
          minWidth="min-w-[44rem]"
          rows={closings.data ?? []}
          rowKey={(c) => c.id}
          columns={[
            {
              header: "Mês",
              headerClassName: "whitespace-nowrap",
              cell: (c) => (
                <Link href={`/admin/fechamentos/${c.id}`} className="tipo-placa whitespace-nowrap underline-offset-4 hover:underline">
                  {monthTitle(c.period_year, c.period_month)}
                </Link>
              ),
            },
            {
              header: "Cliente e unidade",
              cell: (c) => (
                <>
                  <p className="font-semibold leading-snug">{c.client?.display_name}</p>
                  <p className="mt-0.5 text-[0.9375rem] text-muted">{c.site?.name ?? "Todas as unidades"}</p>
                </>
              ),
            },
            { header: "Versão atual", className: "tipo-condensada text-[0.9375rem]", cell: (c) => (c.current ? `Versão ${c.current.version_no}` : "Sem versão") },
            { header: "Emitida em", className: "tipo-condensada text-[0.9375rem]", cell: (c) => (c.current ? formatDateTimeBR(c.current.generated_at) : "—") },
            {
              header: "Situação",
              className: (c) => cn("text-[0.9375rem] font-semibold", c.status === "fechado" ? "text-ok" : "text-muted"),
              cell: (c) => (c.status === "fechado" ? "Emitido" : "Rascunho"),
            },
          ]}
        />
      )}
    </>
  );
}
