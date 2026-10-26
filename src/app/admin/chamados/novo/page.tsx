import type { Metadata } from "next";
import { loadCatalogs, loadMemberships, loadProfiles, loadSites } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import type { Option } from "@/ui/form";
import { EmptyState, PageHeader } from "@/ui/page";
import { ButtonLink } from "@/ui/button";
import { NewRequestForm } from "./new-request-form";

export const metadata: Metadata = { title: "Abrir chamado" };

export default async function NewRequestPage() {
  const db = await createSupabaseServer();
  const [sites, catalogs, profiles, members, areas, contacts] = await Promise.all([
    loadSites(db, { onlyActive: true }),
    loadCatalogs(db),
    loadProfiles(db),
    loadMemberships(db),
    db.from("site_areas").select("id, name, site_id").eq("is_active", true).order("sort_order").order("name"),
    db.from("client_contacts").select("id, name, client_id, role_title").eq("is_active", true).order("name"),
  ]);

  const areasBySite: Record<string, Option[]> = {};
  for (const a of areas.data ?? []) (areasBySite[a.site_id] ??= []).push({ value: a.id, label: a.name });
  const contactsByClient: Record<string, Option[]> = {};
  for (const c of contacts.data ?? []) {
    (contactsByClient[c.client_id] ??= []).push({ value: c.id, label: c.role_title ? `${c.name} (${c.role_title})` : c.name });
  }
  const admins = profiles.list.filter((p) => p.role === "admin" && p.is_active);
  const membersBySite: Record<string, Option[]> = {};
  for (const s of sites) {
    const ids = members.get(s.id) ?? [];
    const people = [...profiles.list.filter((p) => ids.includes(p.id) && p.is_active), ...admins];
    membersBySite[s.id] = people.map((p) => ({ value: p.id, label: p.role === "admin" ? `${p.full_name} (administração)` : p.full_name }));
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        back={{ href: "/admin/chamados", label: "Chamados" }}
        title="Abrir chamado"
        description="Registre o pedido recebido do cliente (ou uma demanda interna). O número é gerado automaticamente."
      />
      {sites.length === 0 ? (
        <EmptyState
          title="Nenhuma obra ou unidade ativa."
          text="Cadastre um cliente e um local antes de abrir chamados."
          action={<ButtonLink href="/admin/clientes">Cadastrar cliente</ButtonLink>}
        />
      ) : (
        <NewRequestForm
          sites={sites.map((s) => ({ id: s.id, name: s.name, clientId: s.client_id, clientName: s.clientName }))}
          areasBySite={areasBySite}
          contactsByClient={contactsByClient}
          membersBySite={membersBySite}
          priorities={catalogs.priorities.map((p) => ({ value: p.id, label: p.name }))}
          categories={catalogs.categories.map((c) => ({ value: c.id, label: c.name }))}
        />
      )}
    </div>
  );
}
