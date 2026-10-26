/**
 * Conteúdo congelado de uma versão do orçamento (quote_versions.snapshot): cabeçalho,
 * cliente, itens, totais, valor por extenso, fotos e dados da empresa na emissão.
 * O PDF de um orçamento enviado/aprovado é gerado a partir deste conteúdo.
 */
import { centsToWords } from "./amount-in-words";
import { sumCents } from "./money";
import type { QuoteStatus } from "./quote";

/** Dados textuais da empresa (logo/assinatura continuam vindo das Configurações). */
export type QuoteCompany = {
  tradeName: string;
  legalName: string;
  cnpj: string | null;
  addressText: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  technicalManagerName: string | null;
  technicalManagerTitle: string | null;
  crea: string | null;
  footerText: string | null;
  city: string | null;
};

type SettingsLike = Partial<{
  trade_name: string | null;
  legal_name: string | null;
  cnpj: string | null;
  address_text: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  technical_manager_name: string | null;
  technical_manager_title: string | null;
  crea: string | null;
  report_footer_text: string | null;
  report_city: string | null;
}>;

export function companyFromSettings(s: SettingsLike | null | undefined): QuoteCompany {
  return {
    tradeName: s?.trade_name || "Megagyn",
    legalName: s?.legal_name ?? "",
    cnpj: s?.cnpj ?? null,
    addressText: s?.address_text ?? null,
    phone: s?.phone ?? null,
    email: s?.email ?? null,
    website: s?.website ?? null,
    technicalManagerName: s?.technical_manager_name ?? null,
    technicalManagerTitle: s?.technical_manager_title ?? null,
    crea: s?.crea ?? null,
    footerText: s?.report_footer_text ?? null,
    city: s?.report_city ?? null,
  };
}

export type QuoteSnapshotItem = {
  location_label: string;
  title: string | null;
  pricing_mode: string;
  quantity: number | null;
  unit: string | null;
  unit_price_cents: number | null;
  subtotal_cents: number;
  lines: string[];
  notes: string | null;
};

export type QuoteSnapshotPhoto = { id: string; caption: string | null };

export type QuoteSnapshot = {
  schema: 1;
  quote_id: string;
  number: string;
  /** Situação/versão gravadas pelo banco no momento da versão. */
  status: QuoteStatus;
  version_no?: number;
  title: string | null;
  issued_at: string;
  valid_until: string | null;
  execution_deadline_text: string | null;
  payment_terms: string | null;
  warranty_text: string | null;
  inclusions_text: string | null;
  intro_text: string | null;
  observations: string | null;
  technical_notes: string | null;
  declaration_text: string | null;
  service_location_text: string | null;
  accepted_at: string | null;
  accepted_note: string | null;
  client: { id: string; display_name: string; legal_name: string | null; document: string | null; address_text: string | null; phone: string | null; email: string | null };
  contact: { id: string; name: string; email: string | null; phone: string | null; role_title: string | null } | null;
  site: { id: string; name: string; code: string | null; address_text: string | null } | null;
  items: QuoteSnapshotItem[];
  total_cents: number;
  total_in_words: string;
  photos: { local: QuoteSnapshotPhoto[]; referencia: QuoteSnapshotPhoto[] };
  company: QuoteCompany;
};

export type QuoteSnapshotInput = {
  quote: Pick<
    QuoteSnapshot,
    | "number"
    | "status"
    | "title"
    | "issued_at"
    | "valid_until"
    | "execution_deadline_text"
    | "payment_terms"
    | "warranty_text"
    | "inclusions_text"
    | "intro_text"
    | "observations"
    | "technical_notes"
    | "declaration_text"
    | "service_location_text"
    | "accepted_at"
    | "accepted_note"
  > & { id: string };
  client: QuoteSnapshot["client"];
  contact: QuoteSnapshot["contact"];
  site: QuoteSnapshot["site"];
  items: Array<QuoteSnapshotItem & { sort_order: number }>;
  photos: Array<{ id: string; caption?: string | null; role?: string | null; revoked?: boolean }>;
  company: QuoteCompany;
};

export function buildQuoteSnapshot(input: QuoteSnapshotInput): QuoteSnapshot {
  const { id, ...quote } = input.quote;
  const items = [...input.items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => ({
      location_label: i.location_label,
      title: i.title,
      pricing_mode: i.pricing_mode,
      quantity: i.quantity,
      unit: i.unit,
      unit_price_cents: i.unit_price_cents,
      subtotal_cents: i.subtotal_cents,
      lines: [...i.lines],
      notes: i.notes,
    }));
  const total = sumCents(items.map((i) => i.subtotal_cents));
  const visible = input.photos.filter((p) => !p.revoked);
  const pick = (role: string) => visible.filter((p) => p.role === role).map((p) => ({ id: p.id, caption: p.caption ?? null }));
  return {
    schema: 1,
    quote_id: id,
    ...quote,
    client: input.client,
    contact: input.contact,
    site: input.site,
    items,
    total_cents: total,
    total_in_words: centsToWords(total),
    photos: { local: pick("local"), referencia: pick("referencia") },
    company: input.company,
  };
}

/** Linhas "Para / Att. / End. / Tel." da proposta. */
export function quoteAddressee(s: QuoteSnapshot) {
  const c = s.contact;
  const attention = c
    ? [c.role_title ? `${c.name} (${c.role_title})` : c.name, c.email].filter(Boolean).join(" – ")
    : null;
  return {
    to: s.client.display_name,
    attention,
    address: s.site?.address_text || s.service_location_text || s.client.address_text || null,
    phone: c?.phone || s.client.phone || null,
    location: s.site?.name || s.service_location_text || null,
  };
}
