import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CLIENT_KIND_LABEL, sanitizeSearch } from "@/domain/registry";
import { createClientAction } from "@/server/actions/registry";
import { listClients, type ClientSituation } from "@/server/client-list";
import { createSupabaseServer } from "@/server/supabase/server";
import { ButtonLink, buttonClass } from "@/ui/button";
import { ActionForm } from "@/ui/form";
import { EmptyState, PageHeader, Panel } from "@/ui/page";
import { DataTable } from "@/ui/data-table";
import { ActiveBadge, ClientFields } from "./_shared/fields";

export const metadata: Metadata = { title: "Clientes" };

const SITUATIONS = [
  { value: "ativos", label: "Ativos" },
  { value: "inativos", label: "Desativados" },
  { value: "todos", label: "Todos" },
];

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; situacao?: string }> }) {
  const params = await searchParams;
  const q = sanitizeSearch(params.q);
  const situation = (SITUATIONS.some((s) => s.value === params.situacao) ? params.situacao! : "ativos") as ClientSituation;
  const db = await createSupabaseServer();
  const clients = await listClients(db, { q, situation });
  const filtered = !!q || situation !== "ativos";

  return (
    <>
      <PageHeader
        title="Clientes e locais"
        description="Clientes, responsáveis do lado do cliente e as obras ou unidades atendidas."
        actions={
          <ButtonLink href="/admin/locais" variant="secondary" icon={<MapPin aria-hidden className="size-4" />}>
            Todos os locais
          </ButtonLink>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <form method="get" className="grid gap-3 rounded-panel border border-linha bg-papel p-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
            <label className="space-y-1 text-sm font-semibold">
              Buscar por nome
              <input type="search" name="q" defaultValue={q ?? ""} className="campo-input" placeholder="Ex.: Condomínio" />
            </label>
            <label className="space-y-1 text-sm font-semibold">
              Situação
              <select name="situacao" defaultValue={situation} className="campo-input">
                {SITUATIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-3">
              <button type="submit" className={buttonClass("dark")}>
                Filtrar
              </button>
              {filtered && (
                <Link href="/admin/clientes" className="font-semibold text-info underline">
                  Limpar
                </Link>
              )}
            </div>
          </form>

          <p className="text-sm text-muted" aria-live="polite">
            {clients.length} cliente(s) encontrado(s).
          </p>

          {clients.length === 0 ? (
            <EmptyState
              title={filtered ? "Nenhum cliente com esses filtros." : "Nenhum cliente cadastrado."}
              text={filtered ? "Ajuste a busca ou a situação." : "Cadastre o primeiro cliente no formulário ao lado."}
            />
          ) : (
            <DataTable
              variant="boxed"
              minWidth="min-w-[40rem]"
              rows={clients}
              rowKey={(c) => c.id}
              columns={[
                {
                  header: "Cliente",
                  cell: (c) => (
                    <>
                      <Link href={`/admin/clientes/${c.id}`} className="font-semibold hover:underline">
                        {c.display_name}
                      </Link>
                      <p className="text-sm text-muted">
                        {c.legal_name !== c.display_name ? `${c.legal_name} · ` : ""}
                        {CLIENT_KIND_LABEL[c.kind]}
                        {c.document ? ` · ${c.document}` : ""}
                      </p>
                    </>
                  ),
                },
                {
                  header: "Contato",
                  className: "text-sm",
                  cell: (c) => (
                    <>
                      {c.phone && <p>{c.phone}</p>}
                      {c.email && <p className="break-all">{c.email}</p>}
                      {!c.phone && !c.email && "—"}
                    </>
                  ),
                },
                { header: "Locais", align: "right", cell: (c) => c.siteCount },
                { header: "Situação", cell: (c) => <ActiveBadge active={c.is_active} /> },
              ]}
            />
          )}
        </div>

        <Panel title="Novo cliente" className="h-fit">
          <ActionForm action={createClientAction} submitLabel="Cadastrar cliente" pendingLabel="Cadastrando…">
            <ClientFields />
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
