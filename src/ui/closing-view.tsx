import { formatUnits } from "@/domain/billing";
import { formatDateBR, formatDateTimeBR, weekdayPt } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import type { ClosingPayload, ClosingRequestItem } from "@/server/closings";
import { Panel } from "./page";
import { PhotoGrid } from "./photo-grid";

function RequestTable({ title, note, items, detail }: { title: string; note?: string; items: ClosingRequestItem[]; detail: (i: ClosingRequestItem) => React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="font-bold">
        {title} <span className="font-normal text-muted">({items.length})</span>
      </h3>
      {note && <p className="text-sm text-muted">{note}</p>}
      {items.length === 0 ? (
        <p className="text-sm text-muted">Nenhum.</p>
      ) : (
        <ul className="divide-y divide-linha border-y border-linha">
          {items.map((i) => (
            <li key={i.id} className="space-y-0.5 py-2.5">
              <p>
                <span className="tipo-condensada mr-2">{i.number}</span>
                <span className="font-semibold">{i.title}</span>
              </p>
              <p className="flex flex-wrap gap-x-4 text-sm text-muted">
                <span>{[i.siteName, i.areaName].filter(Boolean).join(", ")}</span>
                <span>Situação no fim do mês: {i.statusLabel}</span>
              </p>
              <div className="text-sm">{detail(i)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function pending(i: ClosingRequestItem) {
  if (i.pending) {
    return (
      <span className="flex flex-wrap gap-x-4">
        <span>Motivo: {i.pending.reason ?? "—"}</span>
        <span>{i.pending.explanation}</span>
        <span>
          Providência: {i.pending.nextAction} ({i.pending.ownerName})
        </span>
        <span>Previsão: {formatDateBR(i.pending.expectedReturnDate)}</span>
      </span>
    );
  }
  if (i.schedule?.scheduledDate) {
    return (
      <span>
        Programado para {formatDateBR(i.schedule.scheduledDate)}
        {i.schedule.assigneeNames.length ? `, com ${i.schedule.assigneeNames.join(", ")}` : ""}
      </span>
    );
  }
  return <span>Aguardando triagem.</span>;
}

/** Visualização na tela do mesmo payload usado no PDF (prévia ou versão emitida). */
export function ClosingView({ payload }: { payload: ClosingPayload }) {
  const r = payload.requests;
  const s = payload.summary;
  const tiles: Array<[number, string]> = [
    [s.herdados, "pendências de meses anteriores"],
    [s.novos, "abertos no mês"],
    [s.concluidos, "concluídos no mês"],
    [s.emAbertoTotal, "em aberto no fim do mês"],
    [s.aguardandoValidacao, "aguardando validação"],
    [s.cancelados, "cancelados"],
    [s.reabertos, "reabertos"],
    [s.dias, "dias com serviço"],
  ];
  const open = [...r.emAberto.pendente, ...r.emAberto.em_execucao, ...r.emAberto.programada, ...r.emAberto.aberta];

  return (
    <div className="space-y-10">
      <Panel title="Resumo do mês">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {tiles.map(([n, label]) => (
            <div key={label} className="border-t border-linha pt-2">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="tipo-placa text-2xl">{n}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-muted">
          Situação apurada pelos registros até {formatDateBR(payload.period.lastDay)} às 23:59:59 (horário de Brasília). Um chamado pode aparecer em mais de uma
          seção. Reaberturas e cancelamentos não contam como novas solicitações. Atividades e chamados são contados separadamente.
        </p>
      </Panel>

      <Panel title="Chamados">
        <div className="space-y-5">
          <RequestTable title="Pendências de meses anteriores" items={r.herdados} detail={(i) => `Aberto em ${formatDateBR(i.openedAt.slice(0, 10))}`} />
          <RequestTable title="Abertos no mês" items={r.novos} detail={(i) => `Aberto em ${formatDateTimeBR(i.openedAt)}`} />
          <RequestTable
            title="Concluídos no mês"
            note="Inclui chamados solicitados antes do mês."
            items={r.concluidos}
            detail={(i) => (
              <div className="space-y-2">
                <p className="flex flex-wrap gap-x-4">
                  <span>Concluído em {i.validatedAt ? formatDateTimeBR(i.validatedAt) : "—"}</span>
                  {i.openedBeforePeriod && <span>Aberto em mês anterior</span>}
                  <span>Solução: {i.solution ?? "—"}</span>
                </p>
                {i.resultPhotos.length > 0 && <PhotoGrid photos={i.resultPhotos.map((p) => ({ ...p, role: "resultado" }))} />}
              </div>
            )}
          />
          <RequestTable title="Em aberto no fim do mês" note="Motivo, providência, responsável e previsão." items={open} detail={pending} />
          <RequestTable title="Executados aguardando validação" items={r.aguardandoValidacao} detail={(i) => `Execução informada em ${i.executedAt ? formatDateTimeBR(i.executedAt) : "—"}`} />
          <RequestTable title="Cancelados no mês" items={r.cancelados} detail={(i) => `Motivo: ${i.cancelReason ?? "—"}`} />
          <RequestTable title="Reabertos no mês" items={r.reabertos} detail={(i) => `Motivo: ${i.reopenReason ?? "—"}`} />
        </div>
      </Panel>

      {payload.sites.map((site) => (
        <Panel key={site.id} title={`Diário de serviços: ${site.name}`}>
          {site.days.length === 0 ? (
            <p className="text-muted">Nenhum serviço registrado no período.</p>
          ) : (
            <ol className="space-y-5">
              {site.days.map((d, idx) => (
                <li key={d.date} className="space-y-2">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-grafite pb-1.5">
                    <span className="tipo-condensada text-[1.0625rem]">
                      {idx + 1}. {formatDateBR(d.date)}
                      <span className="ml-2 text-[0.9375rem] font-medium text-muted">{weekdayPt(d.date.slice(0, 10))}</span>
                    </span>
                    {d.hoursByPerson.length > 0 && (
                      <span className="text-sm font-semibold">
                        {d.hoursByPerson.map((h) => `${h.name.split(" ")[0]} ${String(h.hours).replace(".", ",")} h`).join(", ")}
                      </span>
                    )}
                  </p>
                  <ul className="list-disc space-y-1 pl-6">
                    {d.activities.map((a) => (
                      <li key={a.id}>
                        {a.text}
                        {a.areaName && <span className="text-muted"> ({a.areaName})</span>}
                        {a.requestNumber && <span className="text-muted">, chamado {a.requestNumber}</span>}
                        {a.outcome !== "executado" && (
                          <span className="text-alerta">
                            , {a.outcome === "parcial" ? "feito em parte" : "não realizado"}
                            {a.blockerReason ? `: ${a.blockerReason}` : ""}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <PhotoGrid photos={d.activities.flatMap((a) => a.photos.map((p) => ({ ...p, caption: p.caption ?? a.text })))} emptyText="Sem fotos neste dia." />
                </li>
              ))}
            </ol>
          )}
        </Panel>
      ))}

      {payload.billing && (
        <Panel title="Demonstrativo de diárias/horas (valor de serviço)">
          {payload.billing.statements.length === 0 ? (
            <p className="text-muted">Sem regra de valor ou sem jornada faturável no período.</p>
          ) : (
            payload.billing.statements.map((st) => (
              <div key={st.siteName} className="mb-4 overflow-x-auto">
                <h3 className="mb-2 font-bold">{st.siteName}</h3>
                <table className="w-full min-w-[32rem] text-left text-[0.95rem]">
                  <thead className="border-b border-linha text-sm text-muted">
                    <tr>
                      <th className="py-1">Data</th>
                      <th className="py-1 text-right">{st.unitType === "diaria" ? "Diárias" : "Horas"}</th>
                      <th className="py-1 text-right">Valor unitário</th>
                      <th className="py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-linha">
                    {st.lines.map((l) => (
                      <tr key={l.date}>
                        <td className="py-1">{formatDateBR(l.date)}</td>
                        <td className="py-1 text-right">{formatUnits(l.unitsCenti)}</td>
                        <td className="py-1 text-right">{formatBRL(l.unitPriceCents)}</td>
                        <td className="py-1 text-right">{formatBRL(l.totalCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-grafite font-bold">
                    <tr>
                      <td className="py-1">Total</td>
                      <td className="py-1 text-right">{formatUnits(st.unitsTotalCenti)}</td>
                      <td />
                      <td className="py-1 text-right">{formatBRL(st.totalCents)}</td>
                    </tr>
                  </tfoot>
                </table>
                {st.missingRuleDates.length > 0 && (
                  <p className="mt-1 text-sm text-alerta">Dias sem regra de valor vigente (fora do total): {st.missingRuleDates.map(formatDateBR).join(", ")}.</p>
                )}
              </div>
            ))
          )}
        </Panel>
      )}
    </div>
  );
}
