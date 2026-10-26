import type { Option } from "@/ui/form";
import { loadCatalogs, loadMemberships, loadProfiles, loadSites, type ServerDb } from "./data";

/** Contexto da equipe de campo: locais com vínculo (RLS já restringe), ambientes e colegas por local. */
export async function loadFieldContext(db: ServerDb) {
  const [sites, members, profiles, catalogs, areas, settings] = await Promise.all([
    loadSites(db, { onlyActive: true }),
    loadMemberships(db),
    loadProfiles(db),
    loadCatalogs(db),
    db.from("site_areas").select("id, name, site_id").eq("is_active", true).order("sort_order").order("name"),
    db.from("company_settings").select("activity_backdate_limit_days").maybeSingle(),
  ]);
  const areasBySite = new Map<string, Option[]>();
  for (const a of areas.data ?? []) areasBySite.set(a.site_id, [...(areasBySite.get(a.site_id) ?? []), { value: a.id, label: a.name }]);

  const siteCtx = sites.map((s) => ({
    id: s.id,
    label: `${s.name} — ${s.clientName}`,
    areas: areasBySite.get(s.id) ?? [],
    members: profiles.list
      .filter((p) => p.is_active && (members.get(s.id) ?? []).includes(p.id))
      .map((p) => ({ value: p.id, label: p.full_name })),
  }));

  const owners: Option[] = profiles.list
    .filter((p) => p.is_active && p.role !== "client")
    .map((p) => ({ value: p.id, label: `${p.full_name}${p.role === "admin" ? " (administração)" : p.role === "foreman" ? " (encarregado)" : ""}` }));

  return {
    sites: siteCtx,
    profiles,
    catalogs,
    owners,
    pendingReasons: catalogs.pendingReasons.map((r) => ({ value: r.id, label: r.name })),
    backdateDays: settings.data?.activity_backdate_limit_days ?? 7,
  };
}
