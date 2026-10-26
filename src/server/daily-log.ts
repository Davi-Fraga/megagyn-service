import { groupDailyLog, type DailyLogEntry } from "@/domain/daily-log";
import type { ClosingDay } from "./closings";
import { loadPhotos, loadProfiles, type ServerDb } from "./data";
import { fetchAll } from "./paginate";

export type DiaryActivity = ClosingDay["activities"][number] & {
  authorName: string;
  participantNames: string[];
  hoursWorked: number | null;
  clientVisible: boolean;
  requestId: string | null;
  reviewStatus: string;
  createdAt: string;
};
export type DiaryDay = Omit<ClosingDay, "activities"> & { activities: DiaryActivity[] };

type EntryRow = {
  id: string;
  site_id: string;
  activity_date: string;
  created_at: string;
  author_id: string;
  description: string;
  solution: string | null;
  materials: string | null;
  hours_worked: number | null;
  outcome: "executado" | "parcial" | "nao_executado";
  blocker_reason_id: string | null;
  next_step: string | null;
  client_visible: boolean;
  review_status: string;
  service_request_id: string | null;
  area: { name: string } | null;
  participants: Array<{ profile_id: string }> | null;
  request: { number: string; is_internal: boolean } | null;
};

/**
 * Diário = projeção dos lançamentos (work_entries) por local e data, com jornada e tarefas previstas.
 * Fonte única para a tela do diário, o PDF do diário e o fechamento mensal.
 */
export async function loadDiary(
  db: ServerDb,
  siteIds: string[],
  from: string,
  to: string,
  options: { clientView: boolean },
): Promise<Map<string, DiaryDay[]>> {
  const result = new Map<string, DiaryDay[]>();
  if (siteIds.length === 0) return result;

  const select =
    "id, site_id, activity_date, created_at, author_id, description, solution, materials, hours_worked, outcome, blocker_reason_id, next_step, client_visible, review_status, service_request_id, area:site_areas(name), participants:work_entry_participants(profile_id), request:service_requests(number, is_internal)";
  const [entriesRows, timeRows, occRows, reasonsRes, profiles] = await Promise.all([
    fetchAll((a, b) => {
      let q = db.from("work_entries").select(select).in("site_id", siteIds).gte("activity_date", from).lte("activity_date", to).order("id").range(a, b);
      if (options.clientView) q = q.eq("client_visible", true);
      return q;
    }),
    fetchAll((a, b) =>
      db.from("time_entries").select("profile_id, site_id, work_date, hours").in("site_id", siteIds).gte("work_date", from).lte("work_date", to).order("id").range(a, b),
    ),
    fetchAll((a, b) =>
      db
        .from("task_occurrences")
        .select("site_id, scheduled_date, status, no_show_reason, task:tasks(title, assignments:task_assignments(profile_id))")
        .in("site_id", siteIds)
        .gte("scheduled_date", from)
        .lte("scheduled_date", to)
        .order("id")
        .range(a, b),
    ),
    db.from("pending_reasons").select("id, name"),
    loadProfiles(db),
  ]);
  const entriesRes = { data: entriesRows };
  const timeRes = { data: timeRows };
  const occRes = { data: occRows };
  const reasons = new Map((reasonsRes.data ?? []).map((r) => [r.id, r.name]));
  const entries = ((entriesRes.data ?? []) as unknown as EntryRow[]).filter((e) => !(options.clientView && e.request?.is_internal));
  const photos = await loadPhotos(db, "work_entry", entries.map((e) => e.id));
  type OccRow = { site_id: string; scheduled_date: string; status: string; no_show_reason: string | null; task: { title: string; assignments: Array<{ profile_id: string }> | null } | null };
  const occurrences = (occRes.data ?? []) as unknown as OccRow[];
  const extra = new Map(entries.map((e) => [e.id, e]));

  for (const siteId of siteIds) {
    const siteEntries: DailyLogEntry[] = entries
      .filter((e) => e.site_id === siteId)
      .map((e) => ({
        id: e.id,
        activityDate: e.activity_date,
        createdAt: e.created_at,
        siteId: e.site_id,
        authorName: profiles.name(e.author_id),
        participantNames: (e.participants ?? []).map((pp) => profiles.name(pp.profile_id)),
        description: e.description,
        solution: e.solution,
        materials: e.materials,
        hoursWorked: e.hours_worked === null ? null : Number(e.hours_worked),
        outcome: e.outcome,
        blockerReason: e.blocker_reason_id ? (reasons.get(e.blocker_reason_id) ?? null) : null,
        nextStep: e.next_step,
        requestNumber: e.request && !(options.clientView && e.request.is_internal) ? e.request.number : null,
        taskTitle: null,
        areaName: e.area?.name ?? null,
        // Visão do cliente: só fotos de evidência liberadas (nunca comprovante interno).
        photos: (photos.get(e.id) ?? [])
          .filter((ph) => !ph.revoked && (!options.clientView || (ph.bucket === "evidence" && ph.visibility === "client")))
          .map((ph) => ({ id: ph.id, caption: ph.caption ?? null, role: ph.role ?? "" })),
      }));
    const log = groupDailyLog({
      entries: siteEntries,
      timeEntries: ((timeRes.data ?? []) as Array<{ profile_id: string; site_id: string; work_date: string; hours: number | null }>)
        .filter((t) => t.site_id === siteId)
        .map((t) => ({ workDate: t.work_date, profileName: profiles.name(t.profile_id), hours: t.hours === null ? null : Number(t.hours) })),
      planned: occurrences
        .filter((o) => o.site_id === siteId && o.status !== "cancelada")
        .map((o) => ({
          date: o.scheduled_date,
          title: o.task?.title ?? "Tarefa",
          status: o.status,
          assigneeNames: (o.task?.assignments ?? []).map((a) => profiles.name(a.profile_id)),
          noShowReason: o.no_show_reason,
        })),
    });
    result.set(
      siteId,
      log.days.map((d) => ({
        date: d.date,
        team: d.team,
        hoursByPerson: d.hoursByPerson,
        totalHours: d.totalHours,
        planned: d.planned.map((pl) => ({ title: pl.title, status: pl.status, assigneeNames: pl.assigneeNames, noShowReason: pl.noShowReason })),
        activities: d.activities.map((a) => {
          const row = extra.get(a.id)!;
          return {
            id: a.id,
            text: a.description,
            solution: a.solution && a.solution !== a.description ? a.solution : null,
            materials: a.materials,
            outcome: a.outcome,
            blockerReason: a.blockerReason,
            nextStep: a.nextStep,
            requestNumber: a.requestNumber,
            areaName: a.areaName ?? null,
            photos: a.photos.map((ph) => ({ id: ph.id, caption: ph.caption })),
            authorName: a.authorName,
            participantNames: a.participantNames,
            hoursWorked: a.hoursWorked,
            clientVisible: row.client_visible,
            requestId: row.service_request_id,
            reviewStatus: row.review_status,
            createdAt: row.created_at,
          };
        }),
      })),
    );
  }
  return result;
}

/** Remove campos internos antes de congelar no fechamento (lista branca). */
export function toClientDay(day: DiaryDay): ClosingDay {
  return {
    date: day.date,
    team: day.team,
    hoursByPerson: day.hoursByPerson,
    totalHours: day.totalHours,
    planned: day.planned.filter((p) => p.status === "nao_realizada" || p.status === "prevista"),
    activities: day.activities.map((a) => ({
      id: a.id,
      text: a.text,
      solution: a.solution,
      materials: a.materials,
      outcome: a.outcome,
      blockerReason: a.blockerReason,
      nextStep: a.nextStep,
      requestNumber: a.requestNumber,
      areaName: a.areaName,
      photos: a.photos,
    })),
  };
}
