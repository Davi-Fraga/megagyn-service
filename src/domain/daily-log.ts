/**
 * Diário de obra = projeção dos lançamentos de atividade (work_entries) por data,
 * mais jornada (time_entries) e tarefas previstas. Não é uma segunda cópia do fato.
 */

export type WorkOutcome = "executado" | "parcial" | "nao_executado";

export type DailyLogPhoto = { id: string; caption: string | null; role: string };

export type DailyLogEntry = {
  id: string;
  activityDate: string;
  createdAt: string;
  siteId: string;
  authorName: string;
  participantNames: string[];
  description: string;
  solution: string | null;
  materials: string | null;
  hoursWorked: number | null;
  outcome: WorkOutcome;
  blockerReason: string | null;
  nextStep: string | null;
  requestNumber: string | null;
  taskTitle: string | null;
  photos: DailyLogPhoto[];
  areaName?: string | null;
};

export type DailyLogTime = { workDate: string; profileName: string; hours: number | null };
export type DailyLogPlanned = {
  date: string;
  title: string;
  status: string;
  assigneeNames: string[];
  noShowReason: string | null;
  /** B-38: observação e fotos do encerramento (só na visão da administração). */
  finishNotes?: string | null;
  photos?: DailyLogPhoto[];
};

export type DailyLogDay = {
  date: string;
  team: string[];
  hoursByPerson: Array<{ name: string; hours: number }>;
  totalHours: number;
  activities: DailyLogEntry[];
  planned: DailyLogPlanned[];
  counts: { activities: number; executed: number; partial: number; notDone: number };
};

export type DailyLog = {
  days: DailyLogDay[];
  totals: { days: number; activities: number; executed: number; partial: number; notDone: number };
};

const byName = (a: string, b: string) => a.localeCompare(b, "pt-BR");

export function groupDailyLog(input: { entries: DailyLogEntry[]; timeEntries: DailyLogTime[]; planned: DailyLogPlanned[] }): DailyLog {
  const unique = new Map<string, DailyLogEntry>();
  for (const e of input.entries) if (!unique.has(e.id)) unique.set(e.id, e);

  const days = new Map<string, DailyLogDay>();
  const day = (date: string) => {
    let d = days.get(date);
    if (!d) {
      d = {
        date,
        team: [],
        hoursByPerson: [],
        totalHours: 0,
        activities: [],
        planned: [],
        counts: { activities: 0, executed: 0, partial: 0, notDone: 0 },
      };
      days.set(date, d);
    }
    return d;
  };

  const teams = new Map<string, Set<string>>();
  const addTeam = (date: string, name: string) => {
    if (!teams.has(date)) teams.set(date, new Set());
    teams.get(date)!.add(name);
  };

  for (const e of unique.values()) {
    const d = day(e.activityDate);
    d.activities.push(e);
    addTeam(e.activityDate, e.authorName);
    for (const p of e.participantNames) addTeam(e.activityDate, p);
  }

  const hours = new Map<string, Map<string, number>>();
  for (const t of input.timeEntries) {
    day(t.workDate);
    addTeam(t.workDate, t.profileName);
    if (t.hours === null) continue;
    if (!hours.has(t.workDate)) hours.set(t.workDate, new Map());
    const m = hours.get(t.workDate)!;
    m.set(t.profileName, Math.round(((m.get(t.profileName) ?? 0) + t.hours) * 100) / 100);
  }

  for (const p of input.planned) day(p.date).planned.push(p);

  const result: DailyLogDay[] = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of result) {
    d.activities.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    d.team = [...(teams.get(d.date) ?? [])].sort(byName);
    d.hoursByPerson = [...(hours.get(d.date) ?? new Map()).entries()]
      .map(([name, h]) => ({ name, hours: h }))
      .sort((a, b) => byName(a.name, b.name));
    d.totalHours = Math.round(d.hoursByPerson.reduce((n, h) => n + h.hours, 0) * 100) / 100;
    d.counts = {
      activities: d.activities.length,
      executed: d.activities.filter((a) => a.outcome === "executado").length,
      partial: d.activities.filter((a) => a.outcome === "parcial").length,
      notDone: d.activities.filter((a) => a.outcome === "nao_executado").length,
    };
  }

  return {
    days: result,
    totals: {
      days: result.length,
      activities: result.reduce((n, d) => n + d.counts.activities, 0),
      executed: result.reduce((n, d) => n + d.counts.executed, 0),
      partial: result.reduce((n, d) => n + d.counts.partial, 0),
      notDone: result.reduce((n, d) => n + d.counts.notDone, 0),
    },
  };
}
