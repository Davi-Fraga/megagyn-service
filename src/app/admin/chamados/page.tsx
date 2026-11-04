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
import { AlertTape } from "@/ui/status";
import { StatusRuler } from "@/ui/status-ruler";

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

      <form method="get" className="mb-5 grid gap-3 rounded-panel border border-linha bg-papel p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm font-semibold">
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
        <label className="space-y-1 text-sm font-semibold">
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
        <label className="space-y-1 text-sm font-semibold">
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
        <label className="space-y-1 text-sm font-semibold">
          Aberto de
          <input type="date" name="de" defaultValue={filters.from ?? ""} className="campo-input" />
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Aberto até
          <input type="date" name="ate" defaultValue={filters.to ?? ""} className="campo-input" />
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Número ou título
          <input type="search" name="q" defaultValue={filters.q ?? ""} className="campo-input" placeholder="Ex.: 2026-000123" />
        </label>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
          <label className="flex min-h-11 items-center gap-2 font-semibold">
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
        <div className="overflow-x-auto rounded-panel border border-linha bg-papel">
          <table className="w-full min-w-[56rem] text-left text-[0.95rem]">
            <thead className="border-b border-linha bg-concreto text-sm text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Número</th>
                <th className="px-3 py-2 font-semibold">Chamado</th>
                <th className="px-3 py-2 font-semibold">Situação</th>
                <th className="px-3 py-2 font-semibold">Responsáveis</th>
                <th className="px-3 py-2 font-semibold">Programado</th>
                <th className="px-3 py-2 font-semibold">Prazo</th>
                <th className="px-3 py-2 font-semibold">Aberto em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-concreto/60">
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/chamados/${r.id}`} className="tipo-condensada text-[1.0625rem] underline-offset-4 hover:underline">
                      {r.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/chamados/${r.id}`} className="font-semibold hover:underline">
                      {r.title}
                    </Link>
                    <p className="flex flex-wrap gap-x-3 text-sm text-muted">
                      <span>
                        {r.client?.display_name}, {r.site?.name}
                      </span>
                      {r.priority && <span>Prioridade {r.priority.name.toLowerCase()}</span>}
                      {r.is_internal && <span>Interna</span>}
                    </p>
                  </td>
                  <td className="space-y-2 px-3 py-2.5">
                    <StatusRuler
                      status={r.status}
                      note={r.status === "pendente" && r.current_pending ? String((r.current_pending as Record<string, unknown>).pending_reason ?? "") || null : null}
                    />
                    {r.overdue && (
                      <div>
                        <AlertTape>Prazo vencido</AlertTape>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-sm">
                    {r.activeAssigneeIds.length ? r.activeAssigneeIds.map((id) => profiles.name(id)).join(", ") : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-sm">{formatDateBR(r.scheduled_date)}</td>
                  <td className="px-3 py-2.5 text-sm">{formatDateBR(r.due_date)}</td>
                  <td className="px-3 py-2.5 text-sm">{formatDateTimeBR(r.opened_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
