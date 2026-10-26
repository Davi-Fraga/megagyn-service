import { formatDateBR, formatDateTimeBR } from "@/domain/dates";
import type { BucketTotals } from "@/domain/expense-totals";
import { formatBRL } from "@/domain/money";
import { html, join, type SafeHtml } from "../html";

/**
 * PDF de despesas INTERNAS (uso exclusivo da Megagyn; nunca entregue a cliente).
 * Totais por obra vêm das parcelas do rateio; o consolidado vem do total de cada compra.
 * Aprovadas e em conferência aparecem sempre separadas.
 */
export type ExpensesReportData = {
  from: string;
  to: string;
  siteName: string | null;
  scope: "empresa" | "obra";
  headline: BucketTotals;
  counts: BucketTotals;
  bySite: Array<{ siteName: string; clientName: string; approved: number; inReview: number; returned: number }>;
  expenses: Array<{
    date: string;
    supplier: string;
    description: string;
    category: string | null;
    purchaser: string;
    paidBy: string;
    totalCents: number;
    attributedCents: number | null;
    statusLabel: string;
    reimbursementLabel: string | null;
    allocations: Array<{ siteName: string; amountCents: number; purpose: string; highlighted: boolean }>;
  }>;
  issuedAt: string;
  issuedBy: string;
};

export function expensesReportBody(d: ExpensesReportData): SafeHtml {
  const scopeLabel =
    d.scope === "obra"
      ? `Valor atribuído a ${d.siteName ?? "esta obra"} (somente as parcelas do rateio desta obra)`
      : "Consolidado da empresa (cada compra conta uma vez pelo valor total da nota)";
  const sum = (k: "approved" | "inReview" | "returned") => d.bySite.reduce((n, s) => n + s[k], 0);

  return html`
    <div class="title-block">
      <div class="doc-kind">Uso interno — não enviar ao cliente</div>
      <h1>Despesas internas</h1>
      <p>Período da compra: <b>${formatDateBR(d.from)} a ${formatDateBR(d.to)}</b></p>
      <p class="muted small">Filtros: ${d.siteName ? `obra ${d.siteName}` : "todas as obras"}; compras enviadas (rascunhos não entram).</p>
    </div>

    <h2>Totais</h2>
    <p class="small muted">${scopeLabel}. Aprovadas, em conferência e devolvidas não se somam entre si.</p>
    <div class="summary">
      <div><span>Aprovadas</span><b>${formatBRL(d.headline.approved)}</b><span>${d.counts.approved} compra(s)</span></div>
      <div><span>Em conferência</span><b>${formatBRL(d.headline.inReview)}</b><span>${d.counts.inReview} compra(s)</span></div>
      <div><span>Devolvidas para correção</span><b>${formatBRL(d.headline.returned)}</b><span>${d.counts.returned} compra(s)</span></div>
    </div>
    <p class="small muted">Custos internos: não incluem orçamentos nem diárias/horas faturáveis.</p>

    <h2>Por obra (parcelas do rateio)</h2>
    ${d.bySite.length === 0
      ? html`<p class="muted">Nenhuma compra no período.</p>`
      : html`<table>
          <thead><tr><th>Obra</th><th>Cliente</th><th class="num">Aprovadas</th><th class="num">Em conferência</th><th class="num">Devolvidas</th></tr></thead>
          <tbody>${join(
            d.bySite.map(
              (s) =>
                html`<tr><td>${s.siteName}</td><td>${s.clientName}</td><td class="num">${formatBRL(s.approved)}</td><td class="num">${formatBRL(s.inReview)}</td><td class="num">${formatBRL(s.returned)}</td></tr>`,
            ),
          )}</tbody>
          ${d.scope === "empresa"
            ? html`<tfoot><tr><td colspan="2">Soma das obras (= consolidado da empresa)</td><td class="num">${formatBRL(sum("approved"))}</td><td class="num">${formatBRL(sum("inReview"))}</td><td class="num">${formatBRL(sum("returned"))}</td></tr></tfoot>`
            : ""}
        </table>`}

    <h2>Compras</h2>
    ${d.expenses.length === 0
      ? html`<p class="muted">Nenhuma compra no período.</p>`
      : html`<table>
          <thead><tr>
            <th style="width:18mm">Data</th><th>Compra</th><th>Rateio</th>
            <th class="num" style="width:24mm">Total da compra</th>
            ${d.scope === "obra" ? html`<th class="num" style="width:24mm">Atribuído à obra</th>` : ""}
            <th style="width:28mm">Situação</th>
          </tr></thead>
          <tbody>${join(
            d.expenses.map(
              (e) => html`<tr>
                <td class="small">${formatDateBR(e.date)}</td>
                <td><b>${e.description}</b><br><span class="small muted">${[e.supplier, e.category, `comprador: ${e.purchaser}`, `pagou: ${e.paidBy}`].filter(Boolean).join(" · ")}</span></td>
                <td class="small">${join(
                  e.allocations.map(
                    (a) => html`<div>${a.highlighted ? html`<b>${a.siteName}: ${formatBRL(a.amountCents)}</b>` : html`${a.siteName}: ${formatBRL(a.amountCents)}`} <span class="muted">— ${a.purpose}</span></div>`,
                  ),
                )}</td>
                <td class="num">${formatBRL(e.totalCents)}</td>
                ${d.scope === "obra" ? html`<td class="num"><b>${formatBRL(e.attributedCents ?? 0)}</b></td>` : ""}
                <td class="small">${e.statusLabel}${e.reimbursementLabel ? html`<br>${e.reimbursementLabel}` : ""}</td>
              </tr>`,
            ),
          )}</tbody>
        </table>`}
    <p class="small muted" style="margin-top:4mm">Emitido em ${formatDateTimeBR(d.issuedAt)} por ${d.issuedBy}. Documento interno.</p>
  `;
}
