import { Download, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDateBR, formatDateTimeBR } from "@/domain/dates";
import { STATUS_LABEL, REQUEST_STATUSES } from "@/domain/request-status";
import { loadCatalogs, loadProfiles, loadSites } from "@/server/data";
import { filtersToQuery, listRequests, parseRequestFilters } from "@/server/request-list";
import { createSupabaseServer } from "@/server/supabase/server";
import { ButtonLink, buttonClass } from "@/ui/button";
import { EmptyState, PageHeader } from "@/ui/page";
import { AlertEdge } from "@/ui/status";
import { StatusRuler } from "@/ui/status-ruler";
import { DataTable } from "@/ui/data-table";

export const metadata: Metadata = { title: "Chamados e OS" };

export default async function AdminRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseRequestFilters(await searchParams);
  const db = await createSupabaseServer();
  const [{ rows, total }, sites, profiles, catalogs, clients] = await Promise.all([
    listRequests(db, filters),
    loadSites(db),
    loadProfiles(db),
    loadCatalogs(db),
    db.from("clients").select("id, display_name").order("display_name"),
  ]);
  const query = filtersToQuery(filters);
  const staff = profiles.list.filter((p) => p.role !== "client" && p.is_active);

  return (
    <>
      <PageHeader
        title="Chamados e ordens de serviço"
        description="Cada chamado mantém o mesmo número da abertura ao encerramento, com histórico e fotos."
        actions={
          <>
            <a href={`/api/csv/chamados?${query}`} className={buttonClass("secondary")}>
              <Download aria-hidden className="size-4" /> Exportar CSV
            </a>
            <ButtonLink href="/admin/chamados/novo" icon={<Plus aria-hidden className="size-4" />}>
              Abrir chamado
            </ButtonLink>
          </>
        }
      />

      <form method="get" className="mb-8 grid gap-x-4 gap-y-3 border-b border-linha pb-6 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-[0.8125rem] font-medium text-muted">
          Situação
          <select name="status" defaultValue={filters.status ?? ""} className="campo-input">
            <option value="">Todas</option>
            <option value="abertos">Em aberto (não encerrados)</option>
            {REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[0.8125rem] font-medium text-muted">
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
        <label className="space-y-1 text-[0.8125rem] font-medium text-muted">
          Obra ou unidade
          <select name="local" defaultValue={filters.siteId ?? ""} className="campo-input">
            <option value="">Todas</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.clientName} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[0.8125rem] font-medium text-muted">
          Responsável
          <select name="responsavel" defaultValue={filters.assigneeId ?? ""} className="campo-input">
            <option value="">Todos</option>
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[0.8125rem] font-medium text-muted">
          Motivo da pendência
          <select name="motivo" defaultValue={filters.pendingReasonId ?? ""} className="campo-input">
            <option value="">Qualquer</option>
            {catalogs.pendingReasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[0.8125rem] font-medium text-muted">
          Aberto de
          <input type="date" name="de" defaultValue={filters.from ?? ""} className="campo-input" />
        </label>
        <label className="space-y-1 text-[0.8125rem] font-medium text-muted">
          Aberto até
          <input type="date" name="ate" defaultValue={filters.to ?? ""} className="campo-input" />
        </label>
        <label className="space-y-1 text-[0.8125rem] font-medium text-muted">
          Número ou título
          <input type="search" name="q" defaultValue={filters.q ?? ""} className="campo-input" placeholder="Ex.: 2026-000123" />
        </label>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
          <label className="flex min-h-11 items-center gap-2 font-medium">
            <input type="checkbox" name="atrasados" value="1" defaultChecked={filters.overdue} className="size-5 accent-acento" />
            Só com prazo vencido
          </label>
          <button type="submit" className={buttonClass("dark")}>
            Filtrar
          </button>
          {query && (
            <Link href="/admin/chamados" className="font-semibold text-info underline">
              Limpar filtros
            </Link>
          )}
        </div>
      </form>

      <p className="mb-2 text-sm text-muted" aria-live="polite">
        {total} chamado(s) encontrado(s){total > rows.length ? `; mostrando os ${rows.length} mais recentes` : ""}. Período considera a data de abertura.
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title="Nenhum chamado com esses filtros."
          text="Ajuste os filtros ou abra um chamado em nome do cliente."
          action={<ButtonLink href="/admin/chamados/novo">Abrir chamado</ButtonLink>}
        />
      ) : (
        <DataTable
          variant="ruler"
          minWidth="min-w-[60rem]"
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            {
              header: "Número",
              headerClassName: "whitespace-nowrap",
              className: "relative",
              cell: (r) => (
                <>
                  {r.overdue && <AlertEdge />}
                  <Link href={`/admin/chamados/${r.id}`} className="tipo-condensada whitespace-nowrap text-[1.0625rem] underline-offset-4 hover:underline">
                    {r.number}
                  </Link>
                </>
              ),
            },
            {
              header: "Chamado",
              cell: (r) => (
                <>
                  <Link href={`/admin/chamados/${r.id}`} className="text-[1.0625rem] font-semibold leading-snug hover:underline">
                    {r.title}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-[0.9375rem] text-muted">
                    <span>
                      {r.client?.display_name}, {r.site?.name}
                    </span>
                    {r.priority && <span>Prioridade {r.priority.name.toLowerCase()}</span>}
                    {r.is_internal && <span>Interna</span>}
                  </p>
                </>
              ),
            },
            {
              header: "Situação",
              className: "w-56 pt-[1.3rem]",
              cell: (r) => (
                <StatusRuler
                  status={r.status}
                  note={r.status === "pendente" && r.current_pending ? String((r.current_pending as Record<string, unknown>).pending_reason ?? "") || null : null}
                />
              ),
            },
            {
              header: "Responsáveis",
              className: "text-[0.9375rem]",
              cell: (r) => (r.activeAssigneeIds.length ? r.activeAssigneeIds.map((id) => profiles.name(id)).join(", ") : "—"),
            },
            { header: "Programado", className: "tipo-condensada text-[0.9375rem]", cell: (r) => formatDateBR(r.scheduled_date) },
            {
              header: "Prazo",
              className: "tipo-condensada text-[0.9375rem]",
              cell: (r) => (
                <>
                  <span className="block">{formatDateBR(r.due_date)}</span>
                  {r.overdue && <span className="block text-erro">Prazo vencido</span>}
                </>
              ),
            },
            { header: "Aberto em", className: "tipo-condensada text-[0.9375rem]", cell: (r) => formatDateTimeBR(r.opened_at) },
          ]}
        />
      )}
    </>
  );
}
