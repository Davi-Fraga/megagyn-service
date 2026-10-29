import type { QuoteStatus } from "@/domain/quote";
import { buildQuoteSnapshot, companyFromSettings, type QuoteSnapshot } from "@/domain/quote-snapshot";
import { loadPhotos, type ServerDb } from "@/server/data";
import { orThrow } from "@/server/query";

// Leitura do orçamento compartilhada pelas telas, pelas ações (snapshot da versão) e pelo PDF.
// Sem efeitos colaterais de registro: pode ser importado por server actions.

const QUOTE_SELECT =
  "*, client:clients(id, display_name, legal_name, document, address_text, phone, email), contact:client_contacts(id, name, email, phone, role_title), site:sites!quotes_site_id_fkey(id, name, code, address_text)";

/** Orçamento com cliente, contato, obra, itens e fotos (com a sessão do admin ou o cliente de serviço). */
export async function loadQuoteBundle(db: ServerDb, id: string) {
  const quote = orThrow(await db.from("quotes").select(QUOTE_SELECT).eq("id", id).maybeSingle());
  if (!quote) return null;
  const [items, photos] = await Promise.all([
    db.from("quote_items").select("*").eq("quote_id", id).order("sort_order").order("id"),
    loadPhotos(db, "quote", [id]),
  ]);
  return { quote: { ...quote, status: quote.status as QuoteStatus }, items: items.data ?? [], photos: photos.get(id) ?? [] };
}
export type QuoteBundle = NonNullable<Awaited<ReturnType<typeof loadQuoteBundle>>>;

/** Conteúdo atual no formato da versão congelada (usado ao enviar/aprovar/renovar e no PDF de rascunho). */
export async function currentQuoteSnapshot(db: ServerDb, bundle: QuoteBundle): Promise<QuoteSnapshot> {
  const { data: settings } = await db.from("company_settings").select("*").eq("id", 1).maybeSingle();
  const q = bundle.quote;
  return buildQuoteSnapshot({
    quote: {
      id: q.id,
      number: q.number,
      status: q.status,
      title: q.title,
      issued_at: q.issued_at,
      valid_until: q.valid_until,
      execution_deadline_text: q.execution_deadline_text,
      payment_terms: q.payment_terms,
      warranty_text: q.warranty_text,
      inclusions_text: q.inclusions_text,
      intro_text: q.intro_text,
      observations: q.observations,
      technical_notes: q.technical_notes,
      declaration_text: q.declaration_text,
      service_location_text: q.service_location_text,
      accepted_at: q.accepted_at,
      accepted_note: q.accepted_note,
    },
    client: q.client,
    contact: q.contact,
    site: q.site,
    items: bundle.items.map((i) => ({
      location_label: i.location_label,
      title: i.title,
      pricing_mode: i.pricing_mode,
      quantity: i.quantity === null ? null : Number(i.quantity),
      unit: i.unit,
      unit_price_cents: i.unit_price_cents,
      subtotal_cents: i.subtotal_cents,
      lines: i.lines ?? [],
      notes: i.notes,
      sort_order: i.sort_order,
    })),
    photos: bundle.photos,
    company: companyFromSettings(settings),
  });
}
