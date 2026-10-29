import { formatUnits } from "@/domain/billing";
import { formatDateBR, formatDateTimeBR, isoDateInTz, longDatePt, monthName } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import type { ClosingDay, ClosingHeaderSnapshot, ClosingPayload, ClosingRequestItem } from "@/server/closings";
import { html, join, multiline, type SafeHtml } from "../html";
import { photoGrid, signatureBlock, type ReportHeader } from "../layout";

export type ClosingRenderOptions = {
  kind: "detalhado" | "resumo";
  versionNo: number | null;
  versionReason: string | null;
  generatedAt: string;
  draft: boolean;
};

function hoursText(h: number): string {
  if (Number.isInteger(h)) return `${String(h).padStart(2, "0")} horas`;
  return `${String(h).replace(".", ",")} horas`;
}

function dayHours(day: ClosingDay): string | null {
  if (day.hoursByPerson.length === 0) return null;
  if (day.hoursByPerson.length === 1) return `Carga horária: ${hoursText(day.hoursByPerson[0]!.hours)}`;
  return `Carga horária: ${day.hoursByPerson.map((p) => `${p.name} ${String(p.hours).replace(".", ",")} h`).join(" · ")}`;
}

function emptyRow(cols: number): SafeHtml {
  return html`<tr><td colspan="${String(cols)}" class="muted">Nenhum.</td></tr>`;
}

function section(title: string, note: string | null, head: string[], rows: SafeHtml[]): SafeHtml {
  return html`
    <h3>${title} (${rows.length})</h3>
    ${note ? html`<p class="small muted">${note}</p>` : ""}
    <table>
      <thead><tr>${join(head.map((h) => html`<th>${h}</th>`))}</tr></thead>
      <tbody>${rows.length ? join(rows) : emptyRow(head.length)}</tbody>
    </table>`;
}

const where = (i: ClosingRequestItem) => [i.siteName, i.areaName].filter(Boolean).join(" · ");

function pendingText(i: ClosingRequestItem): string {
  if (i.pending) {
    return [
      i.pending.reason ? `Motivo: ${i.pending.reason}` : null,
      i.pending.explanation,
      i.pending.nextAction ? `Providência: ${i.pending.nextAction}` : null,
      i.pending.ownerName ? `Responsável: ${i.pending.ownerName}` : null,
      i.pending.expectedReturnDate ? `Previsão: ${formatDateBR(i.pending.expectedReturnDate)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (i.schedule?.scheduledDate) {
    return [`Programado para ${formatDateBR(i.schedule.scheduledDate)}`, i.schedule.assigneeNames.length ? `Responsável: ${i.schedule.assigneeNames.join(", ")}` : null]
      .filter(Boolean)
      .join(" · ");
  }
  return "Aguardando triagem da Megagyn.";
}

export function headerFromSnapshot(h: ClosingHeaderSnapshot, logo: string | null, signature: string | null): ReportHeader {
  const c = h.company;
  return {
    tradeName: c.tradeName,
    legalName: c.legalName,
    cnpj: c.cnpj,
    addressText: c.addressText,
    phone: c.phone,
    email: c.email,
    website: c.website,
    technicalManagerName: c.technicalManagerName,
    technicalManagerTitle: c.technicalManagerTitle,
    crea: c.crea,
    footerText: c.footerText,
    city: c.city,
    logoDataUri: logo,
    signatureDataUri: signature,
  };
}

export function diaryHtml(
  sites: Array<{ name: string; days: ClosingDay[] }>,
  detailed: boolean,
  src: (id: string) => string | undefined,
): SafeHtml {
  let dayCounter = 0;
  const parts = sites.map(
    (site) => html`
      ${sites.length > 1 ? html`<h3>${site.name}</h3>` : ""}
      ${site.days.length === 0
        ? html`<p class="muted">Nenhum serviço registrado no período.</p>`
        : detailed
          ? join(
              site.days.map((d) => {
                dayCounter += 1;
                const photos = d.activities.flatMap((a) => a.photos.map((ph) => ({ id: ph.id, caption: ph.caption ?? a.text })));
                const done = d.activities.filter((a) => a.outcome === "executado");
                const notDone = d.activities.filter((a) => a.outcome !== "executado");
                const hours = dayHours(d);
                return html`<div class="day">
                  <div class="day-head">${dayCounter}. Data: ${formatDateBR(d.date)}${hours ? html`<span class="hours">${hours}</span>` : ""}</div>
                  ${d.team.length ? html`<p class="small muted">Equipe: ${d.team.join(", ")}</p>` : ""}
                  ${done.length
                    ? html`<p><b>Serviços realizados:</b></p><ul class="services">${join(
                        done.map(
                          (a) => html`<li>${a.text}${a.areaName ? html` <span class="muted">(${a.areaName})</span>` : ""}${a.requestNumber ? html` <span class="muted">— chamado ${a.requestNumber}</span>` : ""}${a.solution ? html`<br><span class="small">Solução: ${a.solution}</span>` : ""}${a.materials ? html`<br><span class="small">Materiais: ${a.materials}</span>` : ""}</li>`,
                        ),
                      )}</ul>`
                    : ""}
                  ${notDone.length
                    ? html`<p><b>Parcial ou não realizado:</b></p><ul class="services">${join(
                        notDone.map(
                          (a) => html`<li>${a.text} — ${a.outcome === "parcial" ? "feito em parte" : "não realizado"}${a.blockerReason ? `; motivo: ${a.blockerReason}` : ""}${a.nextStep ? `; próximo passo: ${a.nextStep}` : ""}</li>`,
                        ),
                      )}</ul>`
                    : ""}
                  ${d.planned.filter((pl) => pl.status === "nao_realizada").length
                    ? html`<p class="small"><b>Programado e não realizado:</b> ${d.planned
                        .filter((pl) => pl.status === "nao_realizada")
                        .map((pl) => `${pl.title}${pl.noShowReason ? ` (${pl.noShowReason})` : ""}`)
                        .join("; ")}</p>`
                    : ""}
                  ${photoGrid(photos, src)}
                </div>`;
              }),
            )
          : html`<table>
              <thead><tr><th style="width:24mm">Data</th><th>Serviços realizados</th><th style="width:30mm">Horas</th></tr></thead>
              <tbody>${join(
                site.days.map(
                  (d) => html`<tr><td>${formatDateBR(d.date)}</td><td>${multiline(d.activities.map((a) => `• ${a.text}${a.outcome !== "executado" ? " (parcial/não realizado)" : ""}`).join("\n"))}</td><td class="small">${d.hoursByPerson.map((x) => `${x.name.split(" ")[0]} ${String(x.hours).replace(".", ",")} h`).join(", ") || "—"}</td></tr>`,
                ),
              )}</tbody>
            </table>`}`,
  );
  return join(parts);
}

/** Relatório de serviços prestados do mês (fechamento). Renderiza SOMENTE o payload congelado. */
export function closingBody(
  p: ClosingPayload,
  h: ClosingHeaderSnapshot,
  header: ReportHeader,
  o: ClosingRenderOptions,
  src: (id: string) => string | undefined,
): SafeHtml {
  const detailed = o.kind === "detalhado";
  const company = h.company;
  const siteNames = p.sites.map((s) => s.name).join(", ");
  const addresses = [...new Set(p.sites.map((s) => s.address).filter(Boolean))].join(" · ");
  const r = p.requests;
  const [iy, im, id] = isoDateInTz(new Date(o.generatedAt)).split("-").map(Number) as [number, number, number];

  const ident: Array<[string, string]> = [
    ["Contratado", company.legalName || company.tradeName],
    ["Responsável técnico", company.technicalManagerName ? `${[company.technicalManagerTitle, company.technicalManagerName].filter(Boolean).join(" ")}${company.crea ? ` (CREA ${company.crea})` : ""}` : "—"],
    ["Cliente", p.client.legalName || p.client.displayName],
    ["Obra ou unidade", siteNames || "—"],
    ["Objetivo do relatório", company.objective],
    ["Localização", addresses || "—"],
    ["Período", `${formatDateBR(p.period.firstDay)} a ${formatDateBR(p.period.lastDay)}`],
    ["Situação apurada em", `${formatDateBR(p.period.lastDay)} às 23:59:59 (horário de Brasília)`],
    ["Emissão", `${formatDateTimeBR(o.generatedAt)}${o.versionNo ? ` — versão ${o.versionNo}` : ""}`],
  ];

  const tiles: Array<[number, string]> = [
    [p.summary.herdados, "pendências de meses anteriores"],
    [p.summary.novos, "chamados abertos no mês"],
    [p.summary.concluidos, "concluídos no mês"],
    [p.summary.emAbertoTotal, "em aberto no fim do mês"],
    [p.summary.aguardandoValidacao, "executados aguardando validação"],
    [p.summary.cancelados, "cancelados no mês"],
    [p.summary.reabertos, "reabertos no mês"],
    [p.summary.dias, "dias com serviço registrado"],
  ];

  const concluded = r.concluidos.map(
    (i) => html`<tr>
      <td><b>${i.number}</b></td>
      <td>${i.title}<br><span class="small muted">${where(i)}${i.openedBeforePeriod ? " · aberto em mês anterior" : ""}</span></td>
      <td class="small">${formatDateBR(i.openedAt.slice(0, 10))}</td>
      <td class="small">${i.validatedAt ? formatDateTimeBR(i.validatedAt) : "—"}</td>
      <td>${i.solution ?? "—"}</td>
    </tr>${detailed && i.resultPhotos.length ? html`<tr><td colspan="5">${photoGrid(i.resultPhotos, src)}</td></tr>` : ""}`,
  );

  const openGroups: Array<[string, ClosingRequestItem[]]> = [
    ["Pendente", r.emAberto.pendente],
    ["Em execução", r.emAberto.em_execucao],
    ["Programada", r.emAberto.programada],
    ["Aberta (aguardando triagem)", r.emAberto.aberta],
  ];
  const openRows = openGroups.flatMap(([label, list]) =>
    list.map((i) => html`<tr><td><b>${i.number}</b></td><td>${i.title}<br><span class="small muted">${where(i)}</span></td><td>${label}</td><td class="small">${pendingText(i)}</td></tr>`),
  );

  const diary = [diaryHtml(p.sites, detailed, src)];

  const billing = p.billing?.statements.length
    ? join(
        p.billing.statements.map(
          (st) => html`
            <h2 class="page-break">Planilha de ${st.unitType === "diaria" ? "diárias" : "horas"} (${monthName(p.period.month).replace(/^./, (c) => c.toUpperCase())} / ${p.period.year})${p.billing!.statements.length > 1 ? ` — ${st.siteName}` : ""}</h2>
            <table>
              <thead><tr><th class="num" style="width:12mm">Item</th><th>Data</th><th class="num">${st.unitType === "diaria" ? "Diárias" : "Horas"}</th><th class="num">Valor por ${st.unitType === "diaria" ? "diária" : "hora"}</th><th class="num">Valor total</th></tr></thead>
              <tbody>${join(
                st.lines.map(
                  (l, idx) => html`<tr><td class="num">${idx + 1}</td><td>${longDatePt(l.date)}</td><td class="num">${formatUnits(l.unitsCenti)}</td><td class="num">${formatBRL(l.unitPriceCents)}</td><td class="num">${formatBRL(l.totalCents)}</td></tr>`,
                ),
              )}</tbody>
              <tfoot><tr><td></td><td>${st.unitType === "diaria" ? "Dias trabalhados" : "Total de horas"}</td><td class="num">${formatUnits(st.unitsTotalCenti)}</td><td class="num">Valor final</td><td class="num">${formatBRL(st.totalCents)}</td></tr></tfoot>
            </table>
            ${st.missingRuleDates.length ? html`<p class="small muted">Dias sem regra de valor vigente (fora do total): ${st.missingRuleDates.map(formatDateBR).join(", ")}.</p>` : ""}`,
        ),
      )
    : html``;

  return html`
    ${o.draft ? html`<div class="draft">PRÉVIA — fechamento ainda não emitido. Os números podem mudar até a emissão da versão.</div>` : ""}
    <div class="title-block" style="text-align:center">
      <div class="doc-kind">RELATÓRIO DE SERVIÇOS PRESTADOS${detailed ? "" : " — RESUMO GERENCIAL"}</div>
      <div class="month-title">${p.period.title}</div>
    </div>
    <div class="tape"></div>
    <h2>Elementos de identificação</h2>
    <table class="ident"><tbody>${join(ident.map(([k, v]) => html`<tr><th>${k}</th><td>${v}</td></tr>`))}</tbody></table>
    ${o.versionNo && o.versionNo > 1 && o.versionReason ? html`<p class="small" style="margin-top:2mm"><b>Versão ${o.versionNo}:</b> substitui a versão anterior. Motivo: ${o.versionReason}</p>` : ""}

    <h2>Resumo do mês</h2>
    <div class="summary">${join(tiles.map(([n, label]) => html`<div><b>${n}</b><span>${label}</span></div>`))}</div>
    <p class="small muted">Contagens por seção. Um mesmo chamado pode aparecer em mais de uma seção (por exemplo, pendente de mês anterior e concluído neste mês). Reaberturas e cancelamentos não contam como novas solicitações. Atividades do diário e chamados são contados separadamente e não se somam.</p>

    <h2>Chamados</h2>
    ${section(
      "Pendências trazidas de meses anteriores",
      "Chamados abertos antes do mês e não encerrados no início do período.",
      ["Nº", "Chamado", "Aberto em", "Situação no fim do mês"],
      r.herdados.map((i) => html`<tr><td><b>${i.number}</b></td><td>${i.title}<br><span class="small muted">${where(i)}</span></td><td class="small">${formatDateBR(i.openedAt.slice(0, 10))}</td><td>${i.statusLabel}</td></tr>`),
    )}
    ${section(
      "Chamados abertos no mês",
      null,
      ["Nº", "Chamado", "Aberto em", "Situação no fim do mês"],
      r.novos.map((i) => html`<tr><td><b>${i.number}</b></td><td>${i.title}<br><span class="small muted">${where(i)}</span></td><td class="small">${formatDateTimeBR(i.openedAt)}</td><td>${i.statusLabel}</td></tr>`),
    )}
    ${section("Serviços concluídos no mês", "Inclui chamados solicitados em meses anteriores.", ["Nº", "Chamado", "Aberto em", "Concluído em", "Solução"], concluded)}
    ${section("Em aberto no fim do mês", "Motivo, providência, responsável e próxima previsão de cada item não concluído.", ["Nº", "Chamado", "Situação", "Motivo e próxima ação"], openRows)}
    ${section(
      "Executados aguardando validação",
      null,
      ["Nº", "Chamado", "Execução informada em"],
      r.aguardandoValidacao.map((i) => html`<tr><td><b>${i.number}</b></td><td>${i.title}</td><td class="small">${i.executedAt ? formatDateTimeBR(i.executedAt) : "—"}</td></tr>`),
    )}
    ${section(
      "Cancelados no mês",
      null,
      ["Nº", "Chamado", "Motivo"],
      r.cancelados.map((i) => html`<tr><td><b>${i.number}</b></td><td>${i.title}</td><td>${i.cancelReason ?? "—"}</td></tr>`),
    )}
    ${section(
      "Reabertos no mês",
      null,
      ["Nº", "Chamado", "Motivo"],
      r.reabertos.map((i) => html`<tr><td><b>${i.number}</b></td><td>${i.title}</td><td>${i.reopenReason ?? "—"}</td></tr>`),
    )}

    <h2 class="${detailed ? "page-break" : ""}">Diário de serviços</h2>
    ${join(diary)}

    ${billing}

    <div style="margin-top:10mm">
      <p>Atenciosamente,</p>
      ${signatureBlock(header, `${company.city ? `${company.city}, ` : ""}${id} de ${monthName(im)} de ${iy}.`)}
    </div>
  `;
}
