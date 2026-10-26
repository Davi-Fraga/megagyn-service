import type { Metadata } from "next";
import Link from "next/link";
import { SITE_STATUS_LABEL, SITE_TYPE_LABEL, sanitizeSearch, type SiteStatus } from "@/domain/registry";
import { createSupabaseServer } from "@/server/supabase/server";
import { buttonClass } from "@/ui/button";
import { EmptyState, PageHeader } from "@/ui/page";
import { SiteStatusBadge } from "../clientes/_shared/fields";

export const metadata: Metadata = { title: "Locais" };

export default async function SitesPage({ searchParams }: { searchParams: Promise<{ q?: string; situacao?: string }> }) {
  const params = await searchParams;
  const q = sanitizeSearch(params.q);
  const status = params.situacao && params.situacao in SITE_STATUS_LABEL ? (params.situacao as SiteStatus) : null;
  const db = await createSupabaseServer();

  let query = db
    .from("sites")
    .select("id, name, code, site_type, status, client:clients(id, display_name)")
    .order("name")
    .limit(500);
  if (status) query = query.eq("status", status);
  if (q) query = query.or(`name.ilike.*${q}*,code.ilike.*${q}*`);
  const [{ data }, members] = await Promise.all([query, db.from("site_memberships").select("site_id").is("active_to", null)]);
  const sites = data ?? [];
  const teamSize = new Map<string, number>();
  for (const m of members.data ?? []) teamSize.set(m.site_id, (teamSize.get(m.site_id) ?? 0) + 1);
  const filtered = !!q || !!status;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/clientes", label: "Clientes" }}
        title="Obras e unidades"
        description="Para cadastrar um local novo, abra o cliente correspondente."
      />

      <form method="get" className="mb-4 grid gap-3 rounded-panel border border-linha bg-papel p-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
        <label className="space-y-1 text-sm font-semibold">
          Nome ou código
          <input type="search" name="q" defaultValue={q ?? ""} className="campo-input" placeholder="Ex.: JEX-TA" />
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Situação
          <select name="situacao" defaultValue={status ?? ""} className="campo-input">
            <option value="">Todas</option>
            {Object.entries(SITE_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" className={buttonClass("dark")}>
            Filtrar
          </button>
          {filtered && (
            <Link href="/admin/locais" className="font-semibold text-info underline">
              Limpar
            </Link>
          )}
        </div>
      </form>

      {sites.length === 0 ? (
        <EmptyState title={filtered ? "Nenhum local com esses filtros." : "Nenhum local cadastrado."} />
      ) : (
        <div className="overflow-x-auto rounded-panel border border-linha bg-papel">
          <table className="w-full min-w-[44rem] text-left text-[0.95rem]">
            <thead className="border-b border-linha bg-concreto text-sm text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Código</th>
                <th className="px-3 py-2 font-semibold">Local</th>
                <th className="px-3 py-2 font-semibold">Tipo</th>
                <th className="px-3 py-2 text-right font-semibold">Equipe</th>
                <th className="px-3 py-2 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {sites.map((s) => (
                <tr key={s.id} className="align-top hover:bg-concreto/60">
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/locais/${s.id}`} className="tipo-placa text-laranja-escuro hover:underline">
                      {s.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/locais/${s.id}`} className="font-semibold hover:underline">
                      {s.name}
                    </Link>
                    <p className="text-sm text-muted">{s.client?.display_name}</p>
                  </td>
                  <td className="px-3 py-2.5 text-sm">{SITE_TYPE_LABEL[s.site_type]}</td>
                  <td className="px-3 py-2.5 text-right">{teamSize.get(s.id) ?? 0}</td>
                  <td className="px-3 py-2.5">
                    <SiteStatusBadge status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
