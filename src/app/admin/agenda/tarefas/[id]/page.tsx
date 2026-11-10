import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateBR, formatDateTimeBR } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { TASK_STATUS_LABEL, taskHistory } from "@/domain/task-history";
import { loadTaskAuditRows } from "@/server/agenda";
import { loadProfiles } from "@/server/data";
import { orThrow, rowOrNotFound } from "@/server/query";
import { createSupabaseServer } from "@/server/supabase/server";
import { List } from "@/ui/list";
import { OccurrenceBadge } from "@/ui/occurrence-status";
import { DescriptionList, PageHeader, Panel } from "@/ui/page";

export const metadata: Metadata = { title: "Tarefa" };

/** B-39: a tarefa na administração, com os locais e o histórico de mudanças (autor, data e motivo). */
export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const db = await createSupabaseServer();
  const [taskRes, occurrencesRes, profiles] = await Promise.all([
    db
      .from("tasks")
      .select(
        "id, title, description, status, scheduled_date, due_date, created_by, created_at, kind:task_kinds(name), priority:priority_definitions(name), request:service_requests!tasks_service_request_id_fkey(id, number, title), assignments:task_assignments(profile_id)",
      )
      .eq("id", id)
      .maybeSingle(),
    db.from("task_occurrences").select("id, site_id, scheduled_date, status, no_show_reason, notes, site:sites(name)").eq("task_id", id).order("sort_order"),
    loadProfiles(db),
  ]);
  const task = rowOrNotFound(taskRes);
  const occurrences = orThrow(occurrencesRes) ?? [];
  const siteName = new Map(occurrences.map((o) => [o.site_id, o.site?.name ?? "Local"]));
  const history = taskHistory(await loadTaskAuditRows(db, id, occurrences.map((o) => o.id)), {
    site: (siteId) => siteName.get(siteId) ?? "Local",
    person: (profileId) => profiles.name(profileId),
  });

  return (
    <div className="max-w-5xl">
      <PageHeader
        back={{ href: `/admin/agenda?data=${task.scheduled_date}`, label: "Agenda" }}
        eyebrow={[task.kind?.name ?? "Tarefa", task.priority?.name].filter(Boolean).join(" · ")}
        title={task.title}
        description={TASK_STATUS_LABEL[task.status] ?? task.status}
      />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          <Panel title="Tarefa">
            <DescriptionList
              items={[
                { label: "Dia previsto na criação", value: formatDateBR(task.scheduled_date) },
                { label: "Prazo", value: formatDateBR(task.due_date) },
                { label: "Responsáveis", value: (task.assignments ?? []).map((a) => profiles.name(a.profile_id)).join(", ") || "—" },
                { label: "Criada por", value: `${profiles.name(task.created_by)} em ${formatDateTimeBR(task.created_at)}` },
                {
                  label: "Chamado",
                  value: task.request ? (
                    <Link href={`/admin/chamados/${task.request.id}`} className="text-info underline">
                      {task.request.number} — {task.request.title}
                    </Link>
                  ) : (
                    "—"
                  ),
                },
                { label: "Detalhes", value: task.description ?? "—" },
              ]}
            />
          </Panel>
          <Panel title="Locais">
            <List variant="boxed">
              {occurrences.map((o) => (
                <li key={o.id} className="space-y-1 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {o.site?.name} · {formatDateBR(o.scheduled_date)}
                    </span>
                    <OccurrenceBadge status={o.status} />
                  </div>
                  {o.no_show_reason && <p className="text-sm text-alerta">Não realizada: {o.no_show_reason}</p>}
                  {o.notes && <p className="text-sm">Observação: {o.notes}</p>}
                </li>
              ))}
            </List>
          </Panel>
        </div>
        <Panel title="Histórico">
          {history.length === 0 ? (
            <p className="text-sm text-muted">Nada registrado ainda.</p>
          ) : (
            <ul className="divide-y divide-linha border-y border-linha">
              {history.map((h) => (
                <li key={h.id} className="py-3 text-sm">
                  <p className="font-semibold">{h.what}</p>
                  <p className="text-muted">
                    {formatDateTimeBR(h.at)} · {h.actorId ? profiles.name(h.actorId) : "Sistema"}
                  </p>
                  {h.reason && <p className="mt-1">Motivo: {h.reason}</p>}
                  {h.note && <p className="mt-1">Observação: {h.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
