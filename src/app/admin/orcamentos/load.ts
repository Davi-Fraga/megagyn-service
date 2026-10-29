import type { ServerDb } from "@/server/data";
import type { Option } from "@/ui/form";

/** Opções do formulário: clientes, contatos e locais ativos (mais os já escolhidos no orçamento). */
export async function loadQuoteFormOptions(db: ServerDb, keep: { clientId?: string | null; contactId?: string | null; siteId?: string | null } = {}) {
  const [clients, contacts, sites, settings] = await Promise.all([
    db.from("clients").select("id, display_name, is_active").order("display_name"),
    db.from("client_contacts").select("id, name, client_id, role_title, is_active").order("name"),
    db.from("sites").select("id, name, code, client_id, status").order("name"),
    db.from("company_settings").select("quote_intro_text, quote_declaration_text").eq("id", 1).maybeSingle(),
  ]);

  const contactsByClient: Record<string, Option[]> = {};
  for (const c of contacts.data ?? []) {
    if (!c.is_active && c.id !== keep.contactId) continue;
    (contactsByClient[c.client_id] ??= []).push({ value: c.id, label: c.role_title ? `${c.name} (${c.role_title})` : c.name });
  }
  const sitesByClient: Record<string, Option[]> = {};
  for (const s of sites.data ?? []) {
    if (s.status === "encerrada" && s.id !== keep.siteId) continue;
    (sitesByClient[s.client_id] ??= []).push({ value: s.id, label: `${s.name} (${s.code})` });
  }
  return {
    clients: (clients.data ?? [])
      .filter((c) => c.is_active || c.id === keep.clientId)
      .map((c) => ({ value: c.id, label: c.display_name })),
    contactsByClient,
    sitesByClient,
    introDefault: settings.data?.quote_intro_text ?? "",
    declarationDefault: settings.data?.quote_declaration_text ?? "",
  };
}

export type QuoteFormOptions = Awaited<ReturnType<typeof loadQuoteFormOptions>>;
