import { formatDateBR, formatDateTimeBR } from "@/domain/dates";
import { STATUS_LABEL, type RequestStatus } from "@/domain/request-status";
import { html, join, multiline, type SafeHtml } from "../html";
import { photoGrid } from "../layout";

export type ServiceOrderData = {
  number: string;
  title: string;
  description: string;
  status: RequestStatus;
  clientName: string;
  siteName: string;
  areaName: string | null;
  requesterName: string | null;
  originLabel: string;
  openedAt: string;
  closedAt: string | null;
  scheduledDate: string | null;
  dueDate: string | null;
  categoryName: string | null;
  priorityName: string | null;
  assignees: string[];
  initialPhotos: Array<{ id: string; caption: string | null }>;
  pending: Record<string, string> | null;
  events: Array<{ at: string; label: string; actor: string; detail: string }>;
  entries: Array<{
    date: string;
    author: string;
    participants: string[];
    description: string;
    solution: string | null;
    materials: string | null;
    hours: number | null;
    photos: Array<{ id: string; caption: string | null; role: string }>;
  }>;
  issuedAt: string;
  issuedBy: string;
};

export function serviceOrderBody(d: ServiceOrderData, src: (id: string) => string | undefined): SafeHtml {
  const ident: Array<[string, string]> = [
    ["Cliente", d.clientName],
    ["Obra ou unidade", d.siteName],
    ["Setor ou ambiente", d.areaName ?? "—"],
    ["Solicitante", d.requesterName ?? "—"],
    ["Origem", d.originLabel],
    ["Abertura", formatDateTimeBR(d.openedAt)],
    ["Situação na emissão", STATUS_LABEL[d.status]],
    ["Responsáveis", d.assignees.join(", ") || "—"],
    ["Data programada", formatDateBR(d.scheduledDate)],
    ["Prazo", formatDateBR(d.dueDate)],
    ["Categoria / prioridade", [d.categoryName, d.priorityName].filter(Boolean).join(" / ") || "—"],
    ["Encerramento", d.closedAt ? formatDateTimeBR(d.closedAt) : "—"],
  ];

  return html`
    <div class="title-block">
      <div class="doc-kind">Ordem de serviço</div>
      <h1>Nº ${d.number} — ${d.title}</h1>
    </div>
    <table class="ident">
      <tbody>${join(ident.map(([k, v]) => html`<tr><th>${k}</th><td>${v}</td></tr>`))}</tbody>
    </table>

    <h2>Solicitação</h2>
    <p>${multiline(d.description)}</p>
    ${photoGrid(d.initialPhotos, src)}

    ${d.pending
      ? html`<div class="block alert">
          <b>Pendência: ${d.pending.pending_reason ?? ""}</b>
          <p>${d.pending.explanation ?? ""}</p>
          <p>Providência: ${d.pending.next_action ?? ""} — responsável: ${d.pending.next_action_owner_name ?? ""}</p>
          <p>Previsão de retorno: ${formatDateBR(d.pending.expected_return_date ?? null)}</p>
        </div>`
      : ""}

    <h2>Atendimentos registrados</h2>
    ${d.entries.length === 0
      ? html`<p class="muted">Nenhum atendimento registrado.</p>`
      : join(
          d.entries.map(
            (e) => html`<div class="block">
              <div class="item-head"><b>${formatDateBR(e.date)} — ${e.author}</b><span class="small muted">${e.participants.join(", ")}</span></div>
              <p>${multiline(e.description)}</p>
              ${e.solution && e.solution !== e.description ? html`<p><b>Solução:</b> ${e.solution}</p>` : ""}
              ${e.materials ? html`<p><b>Materiais:</b> ${e.materials}</p>` : ""}
              ${e.hours !== null ? html`<p><b>Horas:</b> ${String(e.hours).replace(".", ",")}</p>` : ""}
              ${photoGrid(
                e.photos.map((p) => ({ id: p.id, caption: [p.role === "resultado" ? "Resultado" : null, p.caption].filter(Boolean).join(" — ") || null })),
                src,
              )}
            </div>`,
          ),
        )}

    <h2>Histórico</h2>
    <table>
      <thead><tr><th style="width:24mm">Data/hora</th><th style="width:48mm">Evento</th><th style="width:34mm">Autor</th><th>Detalhe</th></tr></thead>
      <tbody>${join(d.events.map((e) => html`<tr><td class="small">${formatDateTimeBR(e.at)}</td><td>${e.label}</td><td>${e.actor}</td><td class="small">${e.detail}</td></tr>`))}</tbody>
    </table>
    <p class="small muted" style="margin-top:4mm">Emitido em ${formatDateTimeBR(d.issuedAt)} por ${d.issuedBy}.</p>
  `;
}
