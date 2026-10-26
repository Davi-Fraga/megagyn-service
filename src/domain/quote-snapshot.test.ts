import { describe, expect, it } from "vitest";
import { buildQuoteSnapshot, companyFromSettings, quoteAddressee, type QuoteSnapshotInput } from "./quote-snapshot";

const input = (over: Partial<QuoteSnapshotInput> = {}): QuoteSnapshotInput => ({
  quote: {
    id: "q1",
    number: "ORC-2026-0001",
    status: "rascunho",
    title: "Reforma da cobertura",
    issued_at: "2026-10-25",
    valid_until: "2026-11-24",
    execution_deadline_text: "30 dias úteis",
    payment_terms: "50% na aprovação e 50% na entrega",
    warranty_text: "01 ano",
    inclusions_text: "Acompanhamento técnico incluso\nMaterial e mão de obra inclusos",
    intro_text: "Segue o orçamento conforme solicitado.",
    observations: null,
    technical_notes: null,
    declaration_text: "Declaramos que…",
    service_location_text: null,
    accepted_at: null,
    accepted_note: null,
  },
  client: { id: "c1", display_name: "Cliente Fictício", legal_name: "Cliente Fictício Ltda", document: null, address_text: "Rua A", phone: "(00) 1111-1111", email: null },
  contact: { id: "p1", name: "Pessoa Fictícia", email: "pessoa@example.com", phone: null, role_title: "Síndica" },
  site: { id: "s1", name: "Torre A", code: "T-A", address_text: "Rua da Obra, 1" },
  items: [
    { location_label: "Fachada", title: "Pintura", pricing_mode: "detalhado", quantity: 10, unit: "m²", unit_price_cents: 5000, subtotal_cents: 50000, lines: [], notes: null, sort_order: 1 },
    { location_label: "Cobertura", title: null, pricing_mode: "global", quantity: null, unit: null, unit_price_cents: null, subtotal_cents: 760000, lines: ["Rufos"], notes: "Garantia de 01 ano", sort_order: 0 },
  ],
  photos: [
    { id: "f1", caption: "Telhado", role: "local", revoked: false },
    { id: "f2", caption: null, role: "referencia", revoked: false },
    { id: "f3", caption: null, role: "local", revoked: true },
  ],
  company: companyFromSettings({ trade_name: "Empresa Demo", legal_name: "Empresa Demo Ltda", cnpj: "00.000.000/0000-00", report_city: "Goiânia" }),
  ...over,
});

describe("snapshot da versão do orçamento", () => {
  it("congela cabeçalho, itens em ordem, totais, extenso e fotos não removidas", () => {
    const s = buildQuoteSnapshot(input());
    expect(s.schema).toBe(1);
    expect(s.number).toBe("ORC-2026-0001");
    expect(s.items.map((i) => i.location_label)).toEqual(["Cobertura", "Fachada"]);
    expect(s.total_cents).toBe(810000);
    expect(s.total_in_words).toBe("oito mil e cem reais");
    expect(s.photos).toEqual({ local: [{ id: "f1", caption: "Telhado" }], referencia: [{ id: "f2", caption: null }] });
    expect(s.company).toMatchObject({ tradeName: "Empresa Demo", legalName: "Empresa Demo Ltda", city: "Goiânia" });
    expect(s.client.display_name).toBe("Cliente Fictício");
    expect(s.contact?.name).toBe("Pessoa Fictícia");
  });

  it("orçamento sem itens: total zero", () => {
    const s = buildQuoteSnapshot(input({ items: [] }));
    expect(s.total_cents).toBe(0);
    expect(s.total_in_words).toBe("zero real");
  });
});

describe("destinatário (Para/Att./End./Tel.)", () => {
  it("usa endereço da obra, contato e telefone do contato ou do cliente", () => {
    const s = buildQuoteSnapshot(input());
    expect(quoteAddressee(s)).toEqual({
      to: "Cliente Fictício",
      attention: "Pessoa Fictícia (Síndica) – pessoa@example.com",
      address: "Rua da Obra, 1",
      phone: "(00) 1111-1111",
      location: "Torre A",
    });
  });

  it("sem obra: local livre e endereço do cliente", () => {
    const s = buildQuoteSnapshot(input({ site: null, contact: null, quote: { ...input().quote, service_location_text: "Galpão 2, Rua B" } }));
    expect(quoteAddressee(s)).toEqual({ to: "Cliente Fictício", attention: null, address: "Galpão 2, Rua B", phone: "(00) 1111-1111", location: "Galpão 2, Rua B" });
  });
});
