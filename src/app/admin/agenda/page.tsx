import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { addDaysIso, formatDateBR, isValidIsoDate, longDatePt, todayIso } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { STATUS_LABEL } from "@/domain/request-status";
import { cancelTaskAction, markOccurrenceNotDoneAction, rescheduleOccurrenceAction } from "@/server/actions/tasks";
import { listOccurrences } from "@/server/agenda";
import { loadProfiles, loadSites } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { ButtonLink, buttonClass } from "@/ui/button";
import { cn } from "@/ui/cn";
import { ActionForm, TextAreaField, TextField } from "@/ui/form";
import { OccurrenceBadge } from "@/ui/occurrence-status";
import { EmptyState, Notice, PageHeader } from "@/ui/page";
import { ReasonAction } from "@/ui/reason-action";
import { List } from "@/ui/list";

export const metadata: Metadata = { title: "Agenda" };

type Search = { data?: string; visao?: string; pessoa?: string; local?: string; cliente?: string; feito?: string };

export default async function AgendaPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const day = sp.data && isValidIsoDate(sp.data) ? sp.data : todayIso();
  const week = sp.visao !== "dia";
  const from = day;
  const to = week ? addDaysIso(day, 6) : day;
  const person = sp.pessoa && UUID_RE.test(sp.pessoa) ? sp.pessoa : null;
  const site = sp.local && UUID_RE.test(sp.local) ? sp.local : null;
  const client = sp.cliente && UUID_RE.test(sp.cliente) ? sp.cliente : null;

  const db = await createSupabaseServer();
  let reqQ = db
    .from("service_requests")
    .select("id, number, title, status, scheduled_date, site_id, site:sites(name), assignees:request_assignments(profile_id, unassigned_at)")
    .gte("scheduled_date", from)
    .lte("scheduled_date", to)
    .in("status", ["programada", "em_execucao", "pendente"]);
  if (site) reqQ = reqQ.eq("site_id", site);
  if (client) reqQ = reqQ.eq("client_id", client);
  const [occurrences, reqs, profiles, sites, clients] = await Promise.all([
    listOccurrences(db, { from, to, siteId: site, clientId: client, personId: person }),
    reqQ,
    loadProfiles(db),
    loadSites(db),
    db.from("clients").select("id, display_name").order("display_name"),
  ]);

  const requests = (reqs.data ?? []).filter((r) => !person || (r.assignees ?? []).some((a) => a.profile_id === person && a.unassigned_at === null));
  const days: string[] = [];
  for (let d = from; d <= to; d = addDaysIso(d, 1)) days.push(d);
  const staff = profiles.list.filter((p) => p.is_active && p.role !== "client");
  const qs = (patch: Partial<Search>) => {
    const q = new URLSearchParams();
    const merged = { data: day, visao: week ? "semana" : "dia", pessoa: person ?? undefined, local: site ?? undefined, cliente: client ?? undefined, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && k !== "feito" && q.set(k, String(v)));
    return `/admin/agenda?${q.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Tarefas por dia, pessoa e obra. Uma tarefa em vários locais aparece em cada local, ligada à mesma tarefa."
        actions={
          <ButtonLink href={`/admin/agenda/nova?data=${day}`} icon={<Plus aria-hidden className="size-4" />}>
            Nova tarefa
          </ButtonLink>
        }
      />
      {sp.feito === "tarefa" && (
        <div className="mb-4">
          <Notice tone="ok">Tarefa criada. Os responsáveis foram avisados no sistema.</Notice>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-panel border border-linha bg-papel p-3">
        <div className="flex items-center gap-1">
          <Link href={qs({ data: addDaysIso(day, week ? -7 : -1) })} className={buttonClass("secondary", "md")} aria-label="Período anterior">
            <ChevronLeft aria-hidden className="size-5" />
          </Link>
          <Link href={qs({ data: todayIso() })} className={buttonClass("secondary", "md")}>
            Hoje
          </Link>
          <Link href={qs({ data: addDaysIso(day, week ? 7 : 1) })} className={buttonClass("secondary", "md")} aria-label="Próximo período">
            <ChevronRight aria-hidden className="size-5" />
          </Link>
        </div>
        <div className="flex rounded-ctl border border-linha">
          <Link href={qs({ visao: "dia" })} className={cn("px-3 py-2 font-semibold", !week && "bg-grafite text-white")}>
            Dia
          </Link>
          <Link href={qs({ visao: "semana" })} className={cn("px-3 py-2 font-semibold", week && "bg-grafite text-white")}>
            Semana
          </Link>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="data" value={day} />
          <input type="hidden" name="visao" value={week ? "semana" : "dia"} />
          <label className="text-sm font-semibold">
            Pessoa
            <select name="pessoa" defaultValue={person ?? ""} className="campo-input">
              <option value="">Todas</option>
              {staff.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Cliente
            <select name="cliente" defaultValue={client ?? ""} className="campo-input">
              <option value="">Todos</option>
              {(clients.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Obra ou unidade
            <select name="local" defaultValue={site ?? ""} className="campo-input">
              <option value="">Todas</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.clientName} — {s.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={buttonClass("dark")}>
            Filtrar
          </button>
        </form>
      </div>

      <p className="mb-2 text-sm text-muted" aria-live="polite">
        {occurrences.length} tarefa(s) e {requests.length} chamado(s) programado(s) {week ? `de ${formatDateBR(from)} a ${formatDateBR(to)}` : `em ${formatDateBR(day)}`}.
      </p>

      <div className="space-y-6">
        {days.map((d) => {
          const dayOcc = occurrences.filter((o) => o.scheduled_date === d);
          const dayReq = requests.filter((r) => r.scheduled_date === d);
          return (
            <section key={d}>
              <h2 className={cn("mb-2 text-lg font-bold", d === todayIso() && "text-acento-escuro")}>{longDatePt(d)}</h2>
              {dayOcc.length === 0 && dayReq.length === 0 ? (
                <p className="text-sm text-muted">Nada programado.</p>
              ) : (
                <List variant="boxed">
                  {dayReq.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <span>
                        <Link href={`/admin/chamados/${r.id}`} className="font-semibold hover:underline">
                          <span className="tipo-condensada mr-2">{r.number}</span>
                          {r.title}
                        </Link>
                        <span className="block text-sm text-muted">
                          Chamado · {r.site?.name} ·{" "}
                          {(r.assignees ?? []).filter((a) => a.unassigned_at === null).map((a) => profiles.name(a.profile_id)).join(", ")}
                        </span>
                      </span>
                      <span className="text-sm font-semibold">{STATUS_LABEL[r.status]}</span>
                    </li>
                  ))}
                  {dayOcc.map((o) => (
                    <li key={o.id} className="space-y-2 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {o.task ? (
                            <Link href={`/admin/agenda/tarefas/${o.task.id}`} className="font-semibold hover:underline">
                              {o.task.title}
                            </Link>
                          ) : (
                            <span className="font-semibold">Tarefa</span>
                          )}
                          <span className="block text-sm text-muted">
                            {o.task?.kind?.name ?? "Tarefa"} · {o.site?.name} · {(o.task?.assignments ?? []).map((a) => profiles.name(a.profile_id)).join(", ")}
                            {o.task?.priority ? ` · ${o.task.priority.name}` : ""}
                          </span>
                          {o.no_show_reason && <span className="block text-sm text-alerta">Não realizada: {o.no_show_reason}</span>}
                        </span>
                        <OccurrenceBadge status={o.status} />
                      </div>
                      {(o.status === "prevista" || o.status === "iniciada") && (
                        <div className="mt-2">
                          <ReasonAction
                            action={markOccurrenceNotDoneAction}
                            hidden={{ occurrence_id: o.id }}
                            label="Não foi realizada"
                            confirmLabel="Registrar motivo"
                            reasonLabel="Por que não foi feito?"
                          />
                        </div>
                      )}
                      {(o.status === "prevista" || o.status === "nao_realizada") && (
                        <details>
                          <summary className="cursor-pointer text-sm font-semibold text-info">Remarcar ou cancelar</summary>
                          <div className="mt-2 grid gap-3 sm:grid-cols-2">
                            <ActionForm action={rescheduleOccurrenceAction} submitLabel="Remarcar" submitSize="sm">
                              <input type="hidden" name="occurrence_id" value={o.id} />
                              <TextField label="Nova data" name="scheduled_date" type="date" required defaultValue={addDaysIso(d, 1)} />
                              <TextAreaField label="Motivo" name="reason" required rows={2} />
                            </ActionForm>
                            {o.task && (
                              <ReasonAction
                                action={cancelTaskAction}
                                hidden={{ task_id: o.task.id }}
                                label="Cancelar a tarefa inteira"
                                confirmLabel="Cancelar tarefa"
                                variant="danger"
                              />
                            )}
                          </div>
                        </details>
                      )}
                    </li>
                  ))}
                </List>
              )}
            </section>
          );
        })}
      </div>
      {occurrences.length === 0 && requests.length === 0 && (
        <div className="mt-6">
          <EmptyState title={`Nada programado de ${formatDateBR(from)} a ${formatDateBR(to)}.`} action={<ButtonLink href={`/admin/agenda/nova?data=${day}`}>Nova tarefa</ButtonLink>} />
        </div>
      )}
    </>
  );
}
