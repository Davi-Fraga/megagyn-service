import { describe, expect, it } from "vitest";
import { groupDailyLog, type DailyLogEntry } from "./daily-log";

function entry(id: string, activityDate: string, extra: Partial<DailyLogEntry> = {}): DailyLogEntry {
  return {
    id,
    activityDate,
    createdAt: `${activityDate}T12:00:00Z`,
    siteId: "s1",
    authorName: "João",
    participantNames: ["João"],
    description: `Atividade ${id}`,
    solution: null,
    materials: null,
    hoursWorked: null,
    outcome: "executado",
    blockerReason: null,
    nextStep: null,
    requestNumber: null,
    taskTitle: null,
    photos: [],
    ...extra,
  };
}

describe("diário de obra como projeção dos lançamentos", () => {
  it("agrupa por data e ordena", () => {
    const log = groupDailyLog({
      entries: [entry("e2", "2026-09-03"), entry("e1", "2026-09-01"), entry("e3", "2026-09-03")],
      timeEntries: [],
      planned: [],
    });
    expect(log.days.map((d) => d.date)).toEqual(["2026-09-01", "2026-09-03"]);
    expect(log.days[1]!.activities.map((a) => a.id)).toEqual(["e2", "e3"]);
    expect(log.totals).toEqual({ days: 2, activities: 3, executed: 3, partial: 0, notDone: 0 });
  });

  it("lançamento ligado à OS e à tarefa aparece uma única vez", () => {
    const linked = entry("e1", "2026-09-01", { requestNumber: "2026-000123", taskTitle: "Vistoria" });
    const log = groupDailyLog({ entries: [linked, { ...linked }], timeEntries: [], planned: [] });
    expect(log.days[0]!.activities).toHaveLength(1);
    expect(log.totals.activities).toBe(1);
  });

  it("vários profissionais no mesmo trabalho não multiplicam a contagem", () => {
    const log = groupDailyLog({
      entries: [entry("e1", "2026-09-01", { participantNames: ["João", "Pedro", "Carlos"] })],
      timeEntries: [],
      planned: [],
    });
    expect(log.totals.activities).toBe(1);
    expect(log.days[0]!.team).toEqual(["Carlos", "João", "Pedro"]);
  });

  it("separa executadas, parciais e não executadas com motivo", () => {
    const log = groupDailyLog({
      entries: [
        entry("e1", "2026-09-01"),
        entry("e2", "2026-09-01", { outcome: "parcial", blockerReason: "Falta de material", nextStep: "Comprar luva" }),
        entry("e3", "2026-09-01", { outcome: "nao_executado", blockerReason: "Acesso" }),
      ],
      timeEntries: [],
      planned: [],
    });
    expect(log.days[0]!.counts).toEqual({ activities: 3, executed: 1, partial: 1, notDone: 1 });
  });

  it("horas vêm da jornada por profissional (não das atividades) e dias só com jornada também aparecem", () => {
    const log = groupDailyLog({
      entries: [entry("e1", "2026-09-01")],
      timeEntries: [
        { workDate: "2026-09-01", profileName: "João", hours: 9 },
        { workDate: "2026-09-01", profileName: "Pedro", hours: 4.5 },
        { workDate: "2026-09-02", profileName: "João", hours: 9 },
      ],
      planned: [],
    });
    expect(log.days[0]!.hoursByPerson).toEqual([
      { name: "João", hours: 9 },
      { name: "Pedro", hours: 4.5 },
    ]);
    expect(log.days[0]!.totalHours).toBe(13.5);
    expect(log.days[0]!.team).toEqual(["João", "Pedro"]);
    expect(log.days.map((d) => d.date)).toEqual(["2026-09-01", "2026-09-02"]);
  });

  it("inclui tarefas previstas do dia, inclusive não realizadas com justificativa", () => {
    const log = groupDailyLog({
      entries: [],
      timeEntries: [],
      planned: [{ date: "2026-09-04", title: "Vistoria cobertura", status: "nao_realizada", assigneeNames: ["Carlos"], noShowReason: "Chuva" }],
    });
    expect(log.days[0]!.planned[0]).toMatchObject({ title: "Vistoria cobertura", noShowReason: "Chuva" });
  });
});
