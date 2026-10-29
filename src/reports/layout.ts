import { escapeHtml, html, type SafeHtml } from "./html";

/** Dados da empresa congelados na emissão (configuráveis; nunca fixos no código). */
export type ReportHeader = {
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
  logoDataUri: string | null;
  signatureDataUri: string | null;
};

export const PDF_MARGINS = { top: "27mm", bottom: "17mm", left: "14mm", right: "14mm" };

const CSS = `
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: "Archivo", "Segoe UI", "Liberation Sans", Arial, sans-serif; font-size: 10.5pt;
         line-height: 1.45; color: #1e2326; font-variant-numeric: tabular-nums; }
  h1 { font-size: 17pt; margin: 0 0 2mm; font-weight: 800; }
  h2 { font-size: 13pt; margin: 7mm 0 3mm; padding-bottom: 1.5mm; border-bottom: 1.5pt solid #1e2326; break-after: avoid; }
  h3 { font-size: 11pt; margin: 5mm 0 2mm; break-after: avoid; }
  p { margin: 0 0 2mm; }
  .muted { color: #545e64; }
  .small { font-size: 9pt; }
  .title-block { margin-bottom: 6mm; }
  .doc-kind { font-size: 10pt; font-weight: 700; color: #9a3412; margin-bottom: 1mm; }
  .month-title { font-size: 26pt; font-weight: 800; font-stretch: 118%; letter-spacing: -0.01em; margin: 2mm 0 4mm; }
  .tape { height: 3mm; background: repeating-linear-gradient(-45deg, #f28c28 0 2.5mm, #1e2326 2.5mm 5mm); margin: 3mm 0 5mm; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th, td { text-align: left; vertical-align: top; padding: 1.6mm 2mm; border-bottom: 0.5pt solid #cbd1d4; }
  th { font-size: 9pt; color: #545e64; font-weight: 700; background: #eef0f1; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  td:first-child > b { white-space: nowrap; }
  table.ident th { width: 34%; background: #eef0f1; color: #1e2326; }
  tfoot td { font-weight: 800; border-top: 1.2pt solid #1e2326; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2.5mm; margin: 3mm 0; }
  .summary div { border: 0.8pt solid #cbd1d4; border-radius: 2mm; padding: 2mm 3mm; break-inside: avoid; }
  .summary b { display: block; font-size: 15pt; }
  .summary span { font-size: 8.5pt; color: #545e64; }
  .block { border: 0.8pt solid #cbd1d4; border-radius: 2mm; padding: 3mm 4mm; margin: 0 0 3.5mm; }
  .block.alert { border-color: #94530a; border-left: 3mm solid #f28c28; }
  .item-head { display: flex; justify-content: space-between; gap: 4mm; break-after: avoid; }
  .item-head b { font-size: 10.5pt; }
  .badge { display: inline-block; font-size: 8.5pt; font-weight: 700; border: 0.8pt solid #545e64; border-radius: 10mm; padding: 0.3mm 2.2mm; }
  .day { margin-bottom: 5mm; }
  .day-head { font-size: 12pt; font-weight: 800; background: #1e2326; color: #fff; padding: 2mm 3mm; border-radius: 1.5mm; break-after: avoid; margin: 5mm 0 3mm; }
  .day-head .hours { float: right; font-weight: 600; }
  ul.services { margin: 0 0 3mm 5mm; padding: 0; }
  ul.services li { margin-bottom: 1.2mm; }
  .photos { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin: 2mm 0 4mm; }
  figure { margin: 0; break-inside: avoid; }
  figure img { display: block; width: 100%; height: 72mm; object-fit: contain; background: #eef0f1; border-radius: 1.5mm; }
  figcaption { font-size: 8.5pt; color: #545e64; margin-top: 1mm; }
  .signature { margin-top: 18mm; text-align: center; break-inside: avoid; }
  .signature img { max-height: 22mm; }
  .signature .line { width: 70%; margin: 2mm auto; border-top: 0.8pt solid #1e2326; }
  .draft { border: 1.5pt dashed #b42318; color: #b42318; font-weight: 800; padding: 2mm 3mm; margin-bottom: 4mm; text-align: center; }
  .totals { font-size: 12pt; font-weight: 800; text-align: right; margin-top: 3mm; }
  .page-break { break-before: page; }
`;

export function documentShell(title: string, body: SafeHtml): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${CSS}</style></head><body>${body.toString()}</body></html>`;
}

/** Cabeçalho repetido em todas as páginas (template do Chromium: estilos inline). */
export function headerTemplate(h: ReportHeader): string {
  const contact = [h.addressText, h.phone ? `Fone: ${h.phone}` : null, h.website].filter(Boolean).map((s) => escapeHtml(s!));
  const logo = h.logoDataUri
    ? `<img src="${h.logoDataUri}" style="height:13mm;max-width:45mm;object-fit:contain">`
    : `<span style="font-size:13px;font-weight:800;color:#1e2326">${escapeHtml(h.tradeName)}</span>`;
  return `<div style="width:100%;padding:0 14mm;font-family:Arial,sans-serif;font-size:8px;color:#545e64;display:flex;justify-content:space-between;align-items:center;-webkit-print-color-adjust:exact">
    <div>${logo}</div>
    <div style="text-align:right;line-height:1.35;max-width:95mm">${contact.join("<br>")}</div>
  </div>`;
}

export function footerTemplate(h: ReportHeader, label: string): string {
  const left = [h.tradeName, h.website].filter(Boolean).map((s) => escapeHtml(s!)).join(" | ");
  return `<div style="width:100%;padding:0 14mm;font-family:Arial,sans-serif;font-size:8px;color:#545e64;display:flex;justify-content:space-between">
    <span>${left}${h.footerText ? ` — ${escapeHtml(h.footerText)}` : ""}</span>
    <span>${escapeHtml(label)} · Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
  </div>`;
}

export function signatureBlock(h: ReportHeader, placeAndDate: string): SafeHtml {
  return html`<div class="signature">
    <p>${placeAndDate}</p>
    ${h.signatureDataUri ? html`<img src="${h.signatureDataUri}" alt="">` : ""}
    <div class="line"></div>
    <p><b>${h.legalName || h.tradeName}</b></p>
    ${h.technicalManagerName
      ? html`<p>${[h.technicalManagerTitle, h.technicalManagerName].filter(Boolean).join(" ")}${h.crea ? ` (CREA: ${h.crea})` : ""}</p>`
      : ""}
    ${h.cnpj ? html`<p class="small">CNPJ: ${h.cnpj}</p>` : ""}
  </div>`;
}

export function photoGrid(photos: Array<{ id: string; caption?: string | null }>, src: (id: string) => string | undefined): SafeHtml {
  const figures = photos
    .map((p) => ({ p, s: src(p.id) }))
    .filter((x) => !!x.s)
    .map(({ p, s }) => html`<figure><img src="${s!}" alt="">${p.caption ? html`<figcaption>${p.caption}</figcaption>` : ""}</figure>`);
  if (figures.length === 0) return html``;
  return html`<div class="photos">${figures}</div>`;
}
