import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { addDaysIso, longDatePt, todayIso } from "@/domain/dates";
import { requireProfile } from "@/server/auth";
import { createSupabaseServer } from "@/server/supabase/server";
import { cn } from "@/ui/cn";
import { OccurrenceBadge } from "@/ui/occurrence-status";
import { EmptyState } from "@/ui/page";
import { AlertTape } from "@/ui/status";

export const metadata: Metadata = { title: "Agenda" };

/** Agenda consolidada: tarefas de várias obras, agrupadas por dia e por local. */
export default async function FieldAgendaPage() {
  await requireProfile(["worker", "foreman", "admin"]);
  const db = await createSupabaseServer();
  const today = todayIso();
  const until = addDaysIso(today, 6);
  const { data } = await db
    .from("task_occurrences")
    .select("id, scheduled_date, status, site_id, site:sites(name), area:site_areas(name), task:tasks(title, kind:task_kinds(name))")
    .lte("scheduled_date", until)
    .or(`scheduled_date.gte.${today},status.in.(prevista,iniciada)`)
    .neq("status", "cancelada")
    .order("scheduled_date")
    .order("sort_order");
  const rows = data ?? [];
  const late = rows.filter((o) => o.scheduled_date < today);
  const dates = [...new Set(rows.filter((o) => o.scheduled_date >= today).map((o) => o.scheduled_date))];

  const block = (list: typeof rows) => {
    const bySite = new Map<string, typeof rows>();
    for (const o of list) bySite.set(o.site?.name ?? "—", [...(bySite.get(o.site?.name ?? "—") ?? []), o]);
    return [...bySite.entries()].map(([site, items]) => (
      <div key={site} className="space-y-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-muted">
          <MapPin aria-hidden className="size-4" /> {site}
        </p>
        <ul className="divide-y divide-linha overflow-hidden rounded-panel border border-linha bg-papel">
          {items.map((o) => (
            <li key={o.id}>
              <Link href={`/campo/tarefas/${o.id}`} className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-concreto">
                <span>
                  <span className="block font-semibold">{o.task?.title}</span>
                  <span className="text-sm text-muted">
                    {o.task?.kind?.name ?? "Tarefa"}
                    {o.area ? ` · ${o.area.name}` : ""}
                  </span>
                </span>
                <OccurrenceBadge status={o.status} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    ));
  };

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">Agenda</h1>
      <p className="mb-4 text-muted">Próximos 7 dias, separados por obra.</p>
      {rows.length === 0 && <EmptyState title="Nenhuma tarefa na agenda." text="Quando a administração programar tarefas para você, elas aparecem aqui." />}
      {late.length > 0 && (
        <section className="mb-6 space-y-2">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <AlertTape>Atrasadas</AlertTape>
          </h2>
          {block(late)}
        </section>
      )}
      {dates.map((d) => (
        <section key={d} className="mb-6 space-y-2">
          <h2 className={cn("text-lg font-bold", d === today && "text-laranja-escuro")}>{d === today ? `Hoje — ${longDatePt(d)}` : longDatePt(d)}</h2>
          {block(rows.filter((o) => o.scheduled_date === d))}
        </section>
      ))}
    </>
  );
}
