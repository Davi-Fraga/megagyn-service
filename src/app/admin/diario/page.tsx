import { FileDown, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDateBR, isValidIsoDate, longDatePt, todayIso, daysOfMonth } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { loadSites } from "@/server/data";
import { loadDiary } from "@/server/daily-log";
import { createSupabaseServer } from "@/server/supabase/server";
import { buttonClass } from "@/ui/button";
import { EmptyState, PageHeader, Panel } from "@/ui/page";
import { PhotoGrid } from "@/ui/photo-grid";
import { GenerateReportButton } from "@/ui/report-button";
import { Badge } from "@/ui/status";

// Esta página pede PDFs; a geração roda após a resposta e precisa caber no tempo da função (Vercel Hobby: até 300 s).
export const maxDuration = 300;

export const metadata: Metadata = { title: "Diário de obra" };

export default async function DiaryPage({ searchParams }: { searchParams: Promise<{ local?: string; de?: string; ate?: string }> }) {
  const sp = await searchParams;
  const db = await createSupabaseServer();
  const sites = await loadSites(db);
  const today = todayIso();
  const [y, m] = today.split("-").map(Number) as [number, number];
  const monthDays = daysOfMonth(y, m);
  const from = sp.de && isValidIsoDate(sp.de) ? sp.de : monthDays[0]!;
  const to = sp.ate && isValidIsoDate(sp.ate) && sp.ate >= from ? sp.ate : today;
  const siteId = sp.local && UUID_RE.test(sp.local) ? sp.local : null;
  const site = sites.find((s) => s.id === siteId);
  const days = siteId ? ((await loadDiary(db, [siteId], from, to, { clientView: false })).get(siteId) ?? []) : [];
  const totalActivities = days.reduce((n, d) => n + d.activities.length, 0);

  return (
    <>
      <PageHeader
        title="Diário de obra"
        description="Montado automaticamente a partir do que a equipe registra (chamados, tarefas e atividades avulsas). Cada registro aparece uma vez."
      />
      <form method="get" className="mb-5 grid gap-3 rounded-panel border border-linha bg-papel p-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <label className="space-y-1 text-sm font-semibold">
          Obra ou unidade
          <select name="local" defaultValue={siteId ?? ""} required className="campo-input">
            <option value="">Selecione…</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.clientName} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          De
          <input type="date" name="de" defaultValue={from} className="campo-input" />
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Até
          <input type="date" name="ate" defaultValue={to} className="campo-input" />
        </label>
        <button type="submit" className={buttonClass("dark")}>
          Ver diário
        </button>
      </form>

      {!site ? (
        <EmptyState title="Escolha uma obra ou unidade." text="O diário mostra, por dia, a equipe, o que foi previsto, o que foi feito, os motivos e as fotos." />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted">
              {site.clientName} — {site.name} · {formatDateBR(from)} a {formatDateBR(to)} · {days.length} dia(s), {totalActivities} atividade(s)
            </p>
            <div className="flex flex-wrap gap-2">
              <GenerateReportButton kind="diario" params={{ siteId: site.id, from, to, clientView: false }} label="PDF interno" icon={<FileDown aria-hidden className="size-4" />} />
              <GenerateReportButton kind="diario" params={{ siteId: site.id, from, to, clientView: true }} label="PDF para o cliente" icon={<FileDown aria-hidden className="size-4" />} />
            </div>
          </div>
          {days.length === 0 ? (
            <EmptyState title="Nenhum registro no período." />
          ) : (
            <div className="space-y-5">
              {days.map((d) => (
                <Panel
                  key={d.date}
                  title={longDatePt(d.date)}
                  actions={
                    <span className="text-sm text-muted">
                      {d.hoursByPerson.length ? d.hoursByPerson.map((h) => `${h.name} ${String(h.hours).replace(".", ",")} h`).join(" · ") : "Sem jornada registrada"}
                    </span>
                  }
                >
                  {d.team.length > 0 && <p className="mb-3 text-sm text-muted">Equipe: {d.team.join(", ")}</p>}
                  {d.planned.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm font-semibold">Previsto na agenda</p>
                      <ul className="text-sm">
                        {d.planned.map((pl, i) => (
                          <li key={i}>
                            {pl.title} — {pl.assigneeNames.join(", ")} · {pl.status === "nao_realizada" ? `não realizado (${pl.noShowReason ?? "sem motivo"})` : pl.status}
                            {/* B-38: observação e fotos do encerramento; não vão ao PDF (texto sem revisão). */}
                            {pl.finishNotes && <p className="text-muted">Encerramento: {pl.finishNotes}</p>}
                            {pl.photos.length > 0 && (
                              <div className="mt-1.5">
                                <PhotoGrid photos={pl.photos} />
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <ul className="space-y-4">
                    {d.activities.map((a) => (
                      <li key={a.id} className="space-y-1.5 border-l-4 border-linha pl-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{a.text}</p>
                          {a.outcome !== "executado" && <Badge tone="alerta">{a.outcome === "parcial" ? "Feito em parte" : "Não realizado"}</Badge>}
                          {!a.clientVisible && (
                            <Badge tone="neutral" icon={Lock}>
                              Interno
                            </Badge>
                          )}
                          {a.reviewStatus === "ajustado" && <Badge tone="info">Ajustado pela administração</Badge>}
                        </div>
                        <p className="text-sm text-muted">
                          {a.authorName}
                          {a.participantNames.length > 1 ? ` com ${a.participantNames.filter((n) => n !== a.authorName).join(", ")}` : ""}
                          {a.areaName ? ` · ${a.areaName}` : ""}
                          {a.requestNumber && a.requestId && (
                            <>
                              {" · "}
                              <Link href={`/admin/chamados/${a.requestId}`} className="text-info underline">
                                chamado {a.requestNumber}
                              </Link>
                            </>
                          )}
                        </p>
                        {a.solution && <p className="text-sm">Solução: {a.solution}</p>}
                        {a.materials && <p className="text-sm">Materiais: {a.materials}</p>}
                        {a.blockerReason && <p className="text-sm text-alerta">Motivo: {a.blockerReason}{a.nextStep ? ` · Próximo passo: ${a.nextStep}` : ""}</p>}
                        <PhotoGrid photos={a.photos} emptyText="Sem fotos." />
                        <Link href={`/admin/atividades/${a.id}`} className="text-sm font-semibold text-info underline">
                          Revisar ou ajustar
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
