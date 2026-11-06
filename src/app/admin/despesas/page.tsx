import { Download, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDateBR, todayIso } from "@/domain/dates";
import { EXPENSE_STATUSES, expenseFiltersToQuery, parseExpenseFilters } from "@/domain/expense-filters";
import {
  EXPENSE_STATUS_LABEL,
  EXPENSE_STATUS_TONE,
  REIMBURSEMENT_STATUS_LABEL,
  REIMBURSEMENT_STATUS_TONE,
} from "@/domain/expense-status";
import { headlineTotals } from "@/domain/expense-totals";
import { formatBRL } from "@/domain/money";
import { loadProfiles, loadSites } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { buttonClass } from "@/ui/button";
import { cn } from "@/ui/cn";
import { EmptyState, Notice, PageHeader } from "@/ui/page";
import { GenerateReportButton } from "@/ui/report-button";
import { Badge } from "@/ui/status";
import { DataTable } from "@/ui/data-table";
import { listExpenses } from "./expense-list";

// Esta página pede PDFs; a geração roda após a resposta e precisa caber no tempo da função (Vercel Hobby: até 300 s).
export const maxDuration = 300;

export const metadata: Metadata = { title: "Compras e despesas" };

const SHOW_ROWS = 300;

export default async function AdminExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseExpenseFilters(await searchParams);
  const db = await createSupabaseServer();
  const [list, sites, profiles, suppliers, categories, clients] = await Promise.all([
    listExpenses(db, filters),
    loadSites(db),
    loadProfiles(db),
    db.from("suppliers").select("id, name").order("name"),
    db.from("expense_categories").select("id, name").order("sort_order"),
    db.from("clients").select("id, display_name").order("display_name"),
  ]);
  const query = expenseFiltersToQuery(filters);
  const headline = headlineTotals(list.totals, filters.siteId, filters.clientId);
  const siteName = new Map(sites.map((s) => [s.id, s]));
  const filteredSite = filters.siteId ? siteName.get(filters.siteId) : null;
  const filteredClient = filters.clientId ? (clients.data ?? []).find((c) => c.id === filters.clientId) : null;
  // Parcela que conta no filtro (obra e/ou cliente): é o que a coluna "Atribuído" e os totais somam.
  const inFilter = (a: { siteId: string; clientId: string | null }) =>
    (!filters.siteId || a.siteId === filters.siteId) && (!filters.clientId || a.clientId === filters.clientId);
  const buyers = profiles.list.filter((p) => p.role === "admin" || p.role === "foreman" || p.role === "worker");
  const counts = list.totals.counts;
  // PDF: período do filtro; sem período, o mês corrente até hoje.
  const today = todayIso();
  const pdfFrom = filters.from ?? `${today.slice(0, 8)}01`;
  const pdfTo = filters.to ?? today;

  const cards = [
    { key: "approved", label: "Aprovadas", value: headline.values.approved, count: counts.approved, cls: "border-ok" },
    { key: "inReview", label: "Em conferência", value: headline.values.inReview, count: counts.inReview, cls: "border-info" },
    { key: "returned", label: "Devolvidas", value: headline.values.returned, count: counts.returned, cls: "border-alerta" },
  ] as const;

  return (
    <>
      <PageHeader
        title="Compras e despesas"
        description="Custos internos da Megagyn. Nunca aparecem para o cliente e não se somam a orçamentos nem a diárias."
        actions={
          <>
            <a href={`/api/csv/despesas${query ? `?${query}` : ""}`} className={buttonClass("secondary")}>
              <Download aria-hidden className="size-4" /> Exportar CSV
            </a>
            <GenerateReportButton
              key={`${pdfFrom}_${pdfTo}_${filters.siteId ?? ""}`}
              kind="despesas_internas"
              params={{ from: pdfFrom, to: pdfTo, siteId: filters.siteId }}
              label="PDF de despesas internas"
              icon={<FileText aria-hidden className="size-4" />}
            />
          </>
        }
      />

      <form method="get" className="mb-5 grid gap-3 rounded-panel border border-linha bg-papel p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm font-semibold">
          Compra de
          <input type="date" name="de" defaultValue={filters.from ?? ""} className="campo-input" />
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Compra até
          <input type="date" name="ate" defaultValue={filters.to ?? ""} className="campo-input" />
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Cliente
          <select name="cliente" defaultValue={filters.clientId ?? ""} className="campo-input">
            <option value="">Todos</option>
            {(clients.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Obra
          <select name="obra" defaultValue={filters.siteId ?? ""} className="campo-input">
            <option value="">Todas (total da empresa)</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.clientName} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Situação
          <select name="situacao" defaultValue={filters.status ?? ""} className="campo-input">
            <option value="">Todas as enviadas</option>
            {EXPENSE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {EXPENSE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Comprador
          <select name="comprador" defaultValue={filters.purchaserId ?? ""} className="campo-input">
            <option value="">Todos</option>
            {buyers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Categoria
          <select name="categoria" defaultValue={filters.categoryId ?? ""} className="campo-input">
            <option value="">Todas</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Fornecedor cadastrado
          <select name="fornecedor" defaultValue={filters.supplierId ?? ""} className="campo-input">
            <option value="">Todos</option>
            {(suppliers.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Fornecedor, descrição ou nº da nota
          <input type="search" name="q" defaultValue={filters.q ?? ""} className="campo-input" placeholder="Ex.: cimento" />
        </label>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
          <button type="submit" className={buttonClass("dark")}>
            Filtrar
          </button>
          {query && (
            <Link href="/admin/despesas" className="font-semibold text-info underline">
              Limpar filtros
            </Link>
          )}
        </div>
      </form>

      <section aria-labelledby="totais" className="mb-10 border-t border-linha pt-5">
        <h2 id="totais" className="text-[1.3125rem]">
          {headline.scope === "obra"
            ? `Valor atribuído a ${filteredSite?.name ?? "esta obra"} (parcelas do rateio)`
            : headline.scope === "cliente"
              ? `Valor atribuído a ${filteredClient?.display_name ?? "este cliente"} (parcelas do rateio)`
              : "Total da empresa (soma das compras, cada uma uma vez)"}
        </h2>
        <p className="mb-5 mt-1 max-w-prose text-sm text-muted">
          {headline.scope === "obra"
            ? "Considera só a parte de cada compra destinada a esta obra, não o valor inteiro da nota."
            : headline.scope === "cliente"
              ? "Considera só a parte de cada compra destinada aos locais deste cliente, não o valor inteiro da nota."
              : "Uma compra dividida entre obras conta uma única vez pelo valor total da nota."}{" "}
          Aprovadas e em conferência ficam separadas: não some os quadros.
        </p>
        {/* Número sobre um traço fino, na cor da situação (o rótulo também diz a situação). */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-3">
          {cards.map((c) => (
            <div key={c.key} data-total={c.key} className={cn("border-t-2 pt-2", c.cls)}>
              <p className="text-[0.8125rem] text-muted">{c.label}</p>
              <p className="tipo-placa text-2xl tabular-nums">{formatBRL(c.value)}</p>
              <p className="text-sm text-muted">{c.count} compra(s)</p>
            </div>
          ))}
        </div>
        {!filters.siteId && !filters.clientId && list.totals.bySite.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer font-semibold text-info">Ver quanto foi atribuído a cada obra</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-[0.95rem]">
                <caption className="pb-2 text-left text-sm text-muted">
                  Divisão do mesmo total pelas parcelas do rateio (a soma das obras é igual ao total da empresa).
                </caption>
                <thead>
                  <tr className="tipo-condensada text-[0.8125rem] text-muted">
                    <th scope="col" className="border-b border-grafite pb-2 pr-3 font-semibold">Obra</th>
                    <th scope="col" className="border-b border-grafite pb-2 pr-3 text-right font-semibold">Aprovadas</th>
                    <th scope="col" className="border-b border-grafite pb-2 pr-3 text-right font-semibold">Em conferência</th>
                    <th scope="col" className="border-b border-grafite pb-2 text-right font-semibold">Devolvidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linha">
                  {list.totals.bySite.map((s) => (
                    <tr key={s.siteId}>
                      <td className="py-2 pr-3">
                        <Link href={`/admin/despesas?${expenseFiltersToQuery({ ...filters, siteId: s.siteId })}`} className="hover:underline">
                          {siteName.get(s.siteId)?.name ?? "—"}
                        </Link>
                        <span className="block text-sm text-muted">{siteName.get(s.siteId)?.clientName}</span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(s.approved)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(s.inReview)}</td>
                      <td className="py-2 text-right tabular-nums">{formatBRL(s.returned)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>

      <p className="mb-2 text-sm text-muted" aria-live="polite">
        {list.total} compra(s) encontrada(s){list.rows.length > SHOW_ROWS ? `; mostrando as ${SHOW_ROWS} mais recentes (o CSV traz todas)` : ""}.
        Período pela data da compra.
      </p>
      {list.truncated && (
        <div className="mb-3">
          <Notice tone="alerta">Resultado muito grande: refine o período para que os totais considerem todas as compras.</Notice>
        </div>
      )}

      {list.rows.length === 0 ? (
        <EmptyState title="Nenhuma compra com esses filtros." text="As compras registradas pelo encarregado aparecem aqui para conferência." />
      ) : (
        <DataTable
          variant="ruler"
          minWidth="min-w-[60rem]"
          rows={list.rows.slice(0, SHOW_ROWS)}
          rowKey={(e) => e.id}
          columns={[
            { header: "Data", className: "tipo-condensada whitespace-nowrap text-[0.9375rem]", cell: (e) => formatDateBR(e.expenseDate) },
            {
              header: "Compra",
              cell: (e) => (
                <>
                  <Link href={`/admin/despesas/${e.id}`} className="text-[1.0625rem] font-semibold leading-snug hover:underline">
                    {e.description}
                  </Link>
                  <p className="mt-0.5 text-[0.9375rem] text-muted">{[e.supplierName, e.categoryName].filter(Boolean).join(", ")}</p>
                </>
              ),
            },
            {
              header: "Rateio",
              className: "text-[0.9375rem]",
              cell: (e) => (
                <ul>
                  {e.allocations.map((a) => (
                    <li key={a.siteId} className={cn((filters.siteId || filters.clientId) && inFilter(a) && "font-semibold")}>
                      {a.siteName}: <span className="tabular-nums">{formatBRL(a.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              ),
            },
            { header: "Comprador", className: "text-[0.9375rem]", cell: (e) => profiles.name(e.purchasedBy) },
            {
              header: "Total da compra",
              align: "right",
              className: "tipo-condensada whitespace-nowrap text-[1.0625rem] tabular-nums",
              cell: (e) => formatBRL(e.totalCents),
            },
            filters.siteId || filters.clientId
              ? {
                  header: filters.siteId ? "Atribuído à obra" : "Atribuído ao cliente",
                  align: "right",
                  className: "tipo-condensada whitespace-nowrap text-[1.0625rem] tabular-nums",
                  cell: (e) => formatBRL(e.allocations.filter(inFilter).reduce((n, a) => n + a.amountCents, 0)),
                }
              : null,
            {
              header: "Situação",
              className: "space-y-1",
              cell: (e) => (
                <>
                  <Badge tone={EXPENSE_STATUS_TONE[e.reviewStatus]}>{EXPENSE_STATUS_LABEL[e.reviewStatus]}</Badge>
                  {e.reimbursement && (
                    <div>
                      <Badge tone={REIMBURSEMENT_STATUS_TONE[e.reimbursement.status]}>{REIMBURSEMENT_STATUS_LABEL[e.reimbursement.status]}</Badge>
                    </div>
                  )}
                </>
              ),
            },
          ]}
        />
      )}
    </>
  );
}
