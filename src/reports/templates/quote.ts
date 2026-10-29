import { formatDateBR, isoDateInTz } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import { formatQuantityBR, linesFromText } from "@/domain/quote-form";
import { placeAndDate, validityText } from "@/domain/quote-rules";
import { quoteAddressee, type QuoteSnapshot } from "@/domain/quote-snapshot";
import { html, join, multiline, raw, type SafeHtml } from "../html";
import { photoGrid, signatureBlock, type ReportHeader } from "../layout";

export type QuoteDocument = {
  snapshot: QuoteSnapshot;
  header: ReportHeader;
  /** Faixa de aviso (rascunho, cancelado, vencido). */
  notice: string | null;
};

const STYLE = raw(`<style>
  table.q-meta th { width: 24mm; }
  table.q-items { margin-top: 3mm; }
  table.q-items td.q-local { width: 34mm; font-weight: 700; }
  table.q-items .q-valor { width: 32mm; text-align: right; white-space: nowrap; }
  table.q-items ul { margin: 1mm 0 0 4.5mm; padding: 0; }
  table.q-items li { margin-bottom: 0.6mm; }
  table.q-items tfoot td { font-size: 11.5pt; }
  .q-calc { font-size: 9pt; color: #545e64; margin-top: 1mm; }
  .q-obs { font-size: 9.5pt; margin-top: 1.2mm; }
  ul.q-conditions { margin: 5mm 0 0 5mm; padding: 0; }
  ul.q-conditions li { margin-bottom: 1.6mm; }
  .q-closing { break-inside: avoid; margin-top: 8mm; }
  .q-closing p.q-declaration { text-align: justify; }
</style>`);

function itemRow(item: QuoteSnapshot["items"][number]): SafeHtml {
  const detailed = item.pricing_mode === "detalhado" && item.quantity !== null && item.unit_price_cents !== null;
  const qty = detailed ? formatQuantityBR(Math.round(Number(item.quantity) * 1000)) : "";
  return html`<tr>
    <td class="q-local">${item.location_label}</td>
    <td>
      ${item.title ? html`<b>${item.title}</b>` : ""}
      ${item.lines.length ? html`<ul>${item.lines.map((l) => html`<li>${l}</li>`)}</ul>` : ""}
      ${detailed ? html`<p class="q-calc">${qty}${item.unit ? ` ${item.unit}` : ""} × ${formatBRL(item.unit_price_cents!)}</p>` : ""}
      ${item.notes ? html`<p class="q-obs"><b>Obs:</b> ${item.notes}</p>` : ""}
    </td>
    <td class="q-valor">${formatBRL(item.subtotal_cents)}</td>
  </tr>`;
}

/** Proposta comercial A4: destinatário, itens por local, condições, fotos, declaração e assinatura. */
export function quoteBody(d: QuoteDocument, src: (id: string) => string | undefined): SafeHtml {
  const s = d.snapshot;
  const to = quoteAddressee(s);
  const meta: Array<[string, string | null]> = [
    ["Para:", to.to],
    ["Att.:", to.attention],
    ["End.:", to.address],
    ["Tel.:", to.phone],
    ["Obra/local:", s.site ? to.location : null],
    ["Data:", formatDateBR(s.issued_at)],
  ];

  const conditions: SafeHtml[] = [
    html`<li><b>Valor:</b> ${formatBRL(s.total_cents)} (${s.total_in_words}).</li>`,
    s.payment_terms ? html`<li><b>Forma de pagamento:</b> ${s.payment_terms}</li>` : null,
    ...linesFromText(s.inclusions_text ?? "").map((l) => html`<li>${l}</li>`),
    s.warranty_text ? html`<li><b>Garantia:</b> ${s.warranty_text}</li>` : null,
    html`<li><b>Validade da proposta:</b> ${validityText(s.issued_at, s.valid_until)}</li>`,
    s.execution_deadline_text ? html`<li><b>Prazo de execução:</b> ${s.execution_deadline_text}</li>` : null,
  ].filter((x): x is SafeHtml => x !== null);

  const accepted =
    s.status === "aprovado" && s.accepted_at
      ? html`<div class="block"><b>Proposta aprovada pelo cliente em ${formatDateBR(isoDateInTz(new Date(s.accepted_at)))}</b> (aceite registrado pela administração).</div>`
      : "";

  const photoSection = (title: string, photos: QuoteSnapshot["photos"]["local"]) =>
    photos.length ? html`<div class="page-break"></div><h2>${title}</h2>${photoGrid(photos, src)}` : "";

  return html`
    ${STYLE}
    ${d.notice ? html`<div class="draft">${d.notice}</div>` : ""}
    <div class="title-block">
      <div class="doc-kind">Proposta comercial</div>
      <h1>Orçamento nº ${s.number}</h1>
      ${s.title ? html`<p class="muted">${s.title}</p>` : ""}
    </div>
    <table class="ident q-meta">
      <tbody>${join(meta.filter(([, v]) => !!v).map(([k, v]) => html`<tr><th>${k}</th><td>${v}</td></tr>`))}</tbody>
    </table>

    ${s.intro_text ? html`<p style="margin-top:5mm">${multiline(s.intro_text)}</p>` : ""}

    <table class="q-items">
      <thead><tr><th>Local</th><th>Descrição</th><th class="q-valor">Valor</th></tr></thead>
      <tbody>${join(s.items.map(itemRow))}</tbody>
      <tfoot><tr><td colspan="2">Total</td><td class="q-valor">${formatBRL(s.total_cents)}</td></tr></tfoot>
    </table>

    <ul class="q-conditions">${join(conditions)}</ul>

    ${s.observations ? html`<h3>Observações</h3><p>${multiline(s.observations)}</p>` : ""}
    ${s.technical_notes ? html`<h3>Notas técnicas</h3><p>${multiline(s.technical_notes)}</p>` : ""}
    ${accepted}

    ${photoSection("Fotos do local:", s.photos.local)}
    ${photoSection("Fotos de serviços realizados:", s.photos.referencia)}

    <div class="q-closing">
      ${s.declaration_text ? html`<p class="q-declaration">${multiline(s.declaration_text)}</p>` : ""}
      ${signatureBlock(d.header, placeAndDate(d.header.city, s.issued_at))}
    </div>
  `;
}
