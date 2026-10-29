import { loadSites, type ServerDb } from "@/server/data";
import type { SiteGroup } from "@/ui/allocation-table";
import type { Option } from "@/ui/form";

/**
 * Opções do formulário de compra. A RLS já limita obras e chamados aos locais com vínculo
 * do encarregado (a administração vê todos). `extraSites` garante que obras de uma compra
 * antiga (ex.: obra encerrada) continuem aparecendo na edição.
 */
export async function loadExpenseFormOptions(db: ServerDb, extraSites: Array<{ id: string; name: string; clientName: string }> = []) {
  const [sites, suppliers, categories, payments, requests] = await Promise.all([
    loadSites(db, { onlyActive: true }),
    db.from("suppliers").select("id, name").eq("is_active", true).order("sort_order").order("name"),
    db.from("expense_categories").select("id, name").eq("is_active", true).order("sort_order"),
    db.from("payment_methods").select("id, name").eq("is_active", true).order("sort_order"),
    db
      .from("service_requests")
      .select("id, number, title, site:sites(name)")
      .not("status", "in", "(concluida,cancelada)")
      .order("opened_at", { ascending: false })
      .limit(200),
  ]);

  const all = [...sites.map((s) => ({ id: s.id, name: s.name, clientName: s.clientName }))];
  for (const s of extraSites) if (!all.some((x) => x.id === s.id)) all.push(s);
  const groups = new Map<string, SiteGroup>();
  for (const s of all) {
    const g = groups.get(s.clientName) ?? { clientName: s.clientName, sites: [] };
    g.sites.push({ id: s.id, name: s.name });
    groups.set(s.clientName, g);
  }

  const opt = (rows: Array<{ id: string; name: string }> | null): Option[] => (rows ?? []).map((r) => ({ value: r.id, label: r.name }));
  return {
    siteGroups: [...groups.values()].sort((a, b) => a.clientName.localeCompare(b.clientName, "pt-BR")),
    suppliers: opt(suppliers.data),
    categories: opt(categories.data),
    paymentMethods: opt(payments.data),
    requests: (requests.data ?? []).map((r) => ({ value: r.id, label: `${r.number} — ${r.title}${r.site ? ` (${r.site.name})` : ""}` })),
  };
}
