import { describe, expect, it } from "vitest";
import { taskHistory, type TaskAuditRow } from "./task-history";

const TASK = "11111111-1111-4111-8111-111111111111";
const OCC_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OCC_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SITE_A = "a0000000-0000-4000-8000-000000000001";
const SITE_B = "b0000000-0000-4000-8000-000000000002";
const ADMIN = "d0000000-0000-4000-8000-00000000000a";
const CARLOS = "c0000000-0000-4000-8000-00000000000c";

const names = {
  site: (id: string) => ({ [SITE_A]: "Torre A", [SITE_B]: "Torre B" })[id] ?? "Local removido",
  person: (id: string) => ({ [CARLOS]: "Carlos Encarregado" })[id] ?? "Usuário removido",
};

const task = { id: TASK, title: "Vistoria", scheduled_date: "2026-11-10", due_date: null, status: "planejada", cancelled_at: null, cancel_reason: null };
const occA = { id: OCC_A, task_id: TASK, site_id: SITE_A, scheduled_date: "2026-11-10", status: "prevista", notes: null, no_show_reason: null };
const occB = { ...occA, id: OCC_B, site_id: SITE_B };

let seq = 0;
function row(p: Partial<TaskAuditRow> & Pick<TaskAuditRow, "entity_type" | "entity_id" | "action">): TaskAuditRow {
  seq += 1;
  return { id: seq, actor_id: ADMIN, reason: null, before: null, after: null, created_at: "2026-11-10T12:00:00Z", ...p };
}

describe("histórico da tarefa a partir da trilha", () => {
  it("criação: a tarefa, cada local e cada responsável, na ordem em que foram gravados", () => {
    const rows = [
      row({ entity_type: "tasks", entity_id: TASK, action: "insert", after: { ...task, due_date: "2026-11-14" } }),
      row({ entity_type: "task_assignments", entity_id: `${TASK}:${CARLOS}`, action: "insert", after: { task_id: TASK, profile_id: CARLOS } }),
      row({ entity_type: "task_occurrences", entity_id: OCC_A, action: "insert", after: occA }),
      row({ entity_type: "task_occurrences", entity_id: OCC_B, action: "insert", after: { ...occB, scheduled_date: "2026-11-11" } }),
    ];
    expect(taskHistory(rows, names).map((e) => e.what)).toEqual([
      "Tarefa criada para 10/11/2026, com prazo em 14/11/2026",
      "Responsável incluído: Carlos Encarregado",
      "Local incluído: Torre A, para 10/11/2026",
      "Local incluído: Torre B, para 11/11/2026",
    ]);
  });

  it("remarcação: local, data antiga e nova, autor e motivo", () => {
    const [entry] = taskHistory(
      [
        row({
          id: 7,
          entity_type: "task_occurrences",
          entity_id: OCC_A,
          action: "update",
          reason: "Chuva forte",
          before: occA,
          after: { ...occA, scheduled_date: "2026-11-12" },
          created_at: "2026-11-10T15:30:00Z",
        }),
      ],
      names,
    );
    expect(entry).toEqual({
      id: 7,
      at: "2026-11-10T15:30:00Z",
      actorId: ADMIN,
      what: "Remarcada em Torre A: de 10/11/2026 para 12/11/2026",
      reason: "Chuva forte",
      note: null,
    });
  });

  it("remarcar o dia não realizado conta como remarcação, não como volta à situação prevista", () => {
    const before = { ...occA, status: "nao_realizada", no_show_reason: "Portão fechado" };
    const [entry] = taskHistory(
      [row({ entity_type: "task_occurrences", entity_id: OCC_A, action: "update", reason: "Síndico liberou", before, after: { ...before, status: "prevista", scheduled_date: "2026-11-13" } })],
      names,
    );
    expect(entry).toMatchObject({ what: "Remarcada em Torre A: de 10/11/2026 para 13/11/2026", reason: "Síndico liberou" });
  });

  it("não realizada: o motivo vem da justificativa gravada na ocorrência", () => {
    const [entry] = taskHistory(
      [
        row({
          entity_type: "task_occurrences",
          entity_id: OCC_B,
          action: "update",
          actor_id: CARLOS,
          before: occB,
          after: { ...occB, status: "nao_realizada", no_show_reason: "Portão fechado" },
        }),
      ],
      names,
    );
    expect(entry).toMatchObject({ actorId: CARLOS, what: "Não realizada em Torre B", reason: "Portão fechado", note: null });
  });

  it("início e finalização no local; a observação do encerramento acompanha a finalização", () => {
    const started = { ...occA, status: "iniciada" };
    const entries = taskHistory(
      [
        row({ entity_type: "task_occurrences", entity_id: OCC_A, action: "update", before: occA, after: started }),
        row({ entity_type: "task_occurrences", entity_id: OCC_A, action: "update", before: started, after: { ...started, status: "concluida", notes: "Disjuntor trocado" } }),
      ],
      names,
    );
    expect(entries.map((e) => [e.what, e.note])).toEqual([
      ["Iniciada em Torre A", null],
      ["Finalizada em Torre A", "Disjuntor trocado"],
    ]);
  });

  it("cancelamento da tarefa usa o motivo do evento; a mudança de situação dos locais vem junto", () => {
    const entries = taskHistory(
      [
        row({
          entity_type: "tasks",
          entity_id: TASK,
          action: "update",
          reason: "Cliente desistiu",
          before: task,
          after: { ...task, status: "cancelada", cancelled_at: "2026-11-10T16:00:00Z", cancel_reason: "Cliente desistiu" },
        }),
        row({ entity_type: "task_occurrences", entity_id: OCC_A, action: "update", reason: "Cliente desistiu", before: occA, after: { ...occA, status: "cancelada" } }),
      ],
      names,
    );
    expect(entries.map((e) => [e.what, e.reason])).toEqual([
      ["Tarefa cancelada", "Cliente desistiu"],
      ["Cancelada em Torre A", "Cliente desistiu"],
    ]);
  });

  it("cancelamento sem motivo no evento (correção de dados) recorre ao motivo gravado na tarefa", () => {
    const [entry] = taskHistory(
      [row({ entity_type: "tasks", entity_id: TASK, action: "update", before: task, after: { ...task, status: "cancelada", cancelled_at: "2026-11-10T16:00:00Z", cancel_reason: "Duplicada" } })],
      names,
    );
    expect(entry).toMatchObject({ what: "Tarefa cancelada", reason: "Duplicada" });
  });

  it("situação da tarefa recalculada pelos locais aparece com o nome da situação", () => {
    const [entry] = taskHistory([row({ entity_type: "tasks", entity_id: TASK, action: "update", before: task, after: { ...task, status: "em_andamento" } })], names);
    expect(entry!.what).toBe("Situação da tarefa: Planejada → Em andamento");
  });

  it("outras alterações da tarefa listam os campos com nome legível", () => {
    const [entry] = taskHistory(
      [
        row({
          entity_type: "tasks",
          entity_id: TASK,
          action: "update",
          before: { ...task, updated_at: "2026-11-10T12:00:00Z" },
          after: { ...task, title: "Vistoria geral", due_date: "2026-11-20", updated_at: "2026-11-10T13:00:00Z" },
        }),
      ],
      names,
    );
    expect(entry!.what).toBe("Dados da tarefa alterados: descrição curta, prazo");
  });

  it("responsável retirado", () => {
    const [entry] = taskHistory(
      [row({ entity_type: "task_assignments", entity_id: `${TASK}:${CARLOS}`, action: "delete", before: { task_id: TASK, profile_id: CARLOS } })],
      names,
    );
    expect(entry!.what).toBe("Responsável retirado: Carlos Encarregado");
  });

  it("ordena por data do registro e, no mesmo instante, pela ordem de gravação", () => {
    const later = row({ id: 3, entity_type: "task_occurrences", entity_id: OCC_A, action: "insert", after: occA, created_at: "2026-11-10T12:00:01Z" });
    const first = row({ id: 1, entity_type: "tasks", entity_id: TASK, action: "insert", after: task, created_at: "2026-11-10T12:00:00Z" });
    const second = row({ id: 2, entity_type: "task_occurrences", entity_id: OCC_B, action: "insert", after: occB, created_at: "2026-11-10T12:00:00Z" });
    expect(taskHistory([later, second, first], names).map((e) => e.id)).toEqual([1, 2, 3]);
  });

  it("motivo em branco não aparece", () => {
    const [entry] = taskHistory(
      [row({ entity_type: "task_occurrences", entity_id: OCC_A, action: "update", reason: "  ", before: occA, after: { ...occA, scheduled_date: "2026-11-12" } })],
      names,
    );
    expect(entry!.reason).toBeNull();
  });
});
