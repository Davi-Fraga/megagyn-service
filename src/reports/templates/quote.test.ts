import { describe, expect, it } from "vitest";
import { buildQuoteSnapshot, companyFromSettings } from "@/domain/quote-snapshot";
import type { ReportHeader } from "../layout";
import { quoteBody } from "./quote";

const header: ReportHeader = {
  ...companyFromSettings({ trade_name: "Empresa Demo", legal_name: "Empresa Demo Ltda", cnpj: "00.000.000/0000-00", report_city: "Goiânia" }),
  technicalManagerName: "Responsável Demo",
  technicalManagerTitle: "Eng.",
  logoDataUri: null,
  signatureDataUri: null,
};

const snapshot = (photos = true) =>
  buildQuoteSnapshot({
    quote: {
      id: "q1",
      number: "ORC-2026-0007",
      status: "enviado",
      title: "Reforma <cobertura>",
      issued_at: "2026-10-25",
      valid_until: "2026-11-24",
      execution_deadline_text: "30 dias úteis",
      payment_terms: "À vista",
      warranty_text: null,
      inclusions_text: "Acompanhamento técnico incluso\nMaterial e mão de obra inclusos",
      intro_text: "Segue o orçamento de reforma conforme solicitado.",
      observations: null,
      technical_notes: null,
      declaration_text: "Declaração de teste.",
      service_location_text: null,
      accepted_at: null,
      accepted_note: null,
    },
    client: { id: "c", display_name: "Cliente Fictício", legal_name: null, document: null, address_text: "Rua X", phone: null, email: null },
    contact: null,
    site: null,
    items: [
      { location_label: "Cobertura", title: null, pricing_mode: "global", quantity: null, unit: null, unit_price_cents: null, subtotal_cents: 760000, lines: ["Troca de rufos"], notes: "Garantia de 01 ano", sort_order: 0 },
    ],
    photos: photos ? [{ id: "f1", caption: "Telhado", role: "local" }, { id: "f2", role: "referencia" }] : [],
    company: header,
  });

describe("PDF do orçamento", () => {
  it("tabela Local | Descrição | Valor, extenso correto, condições, fotos, declaração e assinatura", () => {
    const out = quoteBody({ snapshot: snapshot(), header, notice: null }, (id) => `${id}.jpg`).toString();
    expect(out).toContain("Proposta comercial");
    expect(out).toContain("Orçamento nº ORC-2026-0007");
    expect(out).toContain("<th>Local</th><th>Descrição</th>");
    expect(out).toContain("R$ 7.600,00 (sete mil e seiscentos reais).");
    expect(out).not.toContain("setembro mil");
    expect(out).toContain("<b>Obs:</b> Garantia de 01 ano");
    expect(out).toContain("30 dias (até 24/11/2026)");
    expect(out).toContain("<li>Material e mão de obra inclusos</li>");
    expect(out).toContain("Fotos do local:");
    expect(out).toContain("Fotos de serviços realizados:");
    expect(out).toContain('src="f1.jpg"');
    expect(out).toContain("Goiânia, 25 de outubro de 2026");
    expect(out).toContain("CNPJ: 00.000.000/0000-00");
    expect(out).toContain("Reforma &lt;cobertura&gt;");
    expect(out).not.toContain("RASCUNHO");
  });

  it("rascunho leva aviso visível; sem fotos não abre páginas de fotos", () => {
    const out = quoteBody({ snapshot: snapshot(false), header, notice: "RASCUNHO — teste" }, () => undefined).toString();
    expect(out).toContain('<div class="draft">RASCUNHO — teste</div>');
    expect(out).not.toContain("Fotos do local:");
    expect(out).not.toContain("page-break");
  });
});
