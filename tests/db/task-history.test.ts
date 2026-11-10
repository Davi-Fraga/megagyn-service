import { beforeAll, describe, expect, it } from "vitest";
import { taskHistory } from "@/domain/task-history";
import { loadTaskAuditRows } from "@/server/agenda";
import { addMembership, createClientWithSite, createSite, createUser, today, uid, type TestUser } from "./helpers";

let admin: TestUser;
let foreman: TestUser;
let siteA: { id: string; name: string };
let siteB: { id: string; name: string };

beforeAll(async () => {
  [admin, foreman] = await Promise.all([createUser("admin", "Admin Histórico"), createUser("foreman", "Encarregado Histórico")]);
  const { client, site } = await createClientWithSite("Histórico");
  siteA = site;
  siteB = await createSite(client.id, `${site.name} B`);
  await Promise.all([addMembership(foreman.id, siteA.id), addMembership(foreman.id, siteB.id)]);
});

async function newTask(title: string) {
  const { data, error } = await admin.db.rpc("task_create", {
    p_client_request_id: uid(),
    p_title: title,
    p_scheduled_date: today(),
    p_assignee_ids: [foreman.id],
    p_occurrences: [{ site_id: siteA.id }, { site_id: siteB.id }],
  });
  if (error) throw error;
  const { data: occ, error: occErr } = await admin.db.from("task_occurrences").select("id, site_id").eq("task_id", data!.id).order("sort_order");
  if (occErr) throw occErr;
  return { task: data!, occA: occ![0]!.id, occB: occ![1]!.id };
}

describe("B-39: trilha da tarefa para o histórico", () => {
  it("junta tarefa, locais e responsáveis, com autor e motivo, sem eventos de outra tarefa", async () => {
    const { task, occA, occB } = await newTask("Vistoria histórico (fictícia)");
    // Outra tarefa com o mesmo responsável e os mesmos locais: nada dela pode entrar no histórico.
    const other = await newTask("Outra tarefa (fictícia)");
    await admin.db.rpc("task_cancel", { p_task_id: other.task.id, p_reason: "Não pertence ao histórico" });

    const next = new Date(Date.parse(`${today()}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const moved = await admin.db.rpc("task_occurrence_reschedule", { p_occurrence_id: occA, p_scheduled_date: next, p_reason: "Chuva forte" });
    expect(moved.error).toBeNull();
    const notDone = await foreman.db.rpc("task_occurrence_not_done", { p_occurrence_id: occB, p_reason: "Portão fechado" });
    expect(notDone.error).toBeNull();
    const cancelled = await admin.db.rpc("task_cancel", { p_task_id: task.id, p_reason: "Cliente desistiu" });
    expect(cancelled.error).toBeNull();

    const rows = await loadTaskAuditRows(admin.db, task.id, [occA, occB]);
    const names = { site: (id: string) => (id === siteA.id ? "A" : id === siteB.id ? "B" : "?"), person: (id: string) => (id === foreman.id ? "Encarregado" : "?") };
    const history = taskHistory(rows, names).map((e) => [e.what, e.actorId, e.reason]);
    const br = (iso: string) => iso.split("-").reverse().join("/");

    expect(history).toEqual([
      [`Tarefa criada para ${br(today())}`, admin.id, null],
      ["Responsável incluído: Encarregado", admin.id, null],
      [`Local incluído: A, para ${br(today())}`, admin.id, null],
      [`Local incluído: B, para ${br(today())}`, admin.id, null],
      [`Remarcada em A: de ${br(today())} para ${br(next)}`, admin.id, "Chuva forte"],
      ["Não realizada em B", foreman.id, "Portão fechado"],
      ["Tarefa cancelada", admin.id, "Cliente desistiu"],
      ["Cancelada em A", admin.id, "Cliente desistiu"],
    ]);
  });

  it("sem locais informados, ainda traz a tarefa e os responsáveis", async () => {
    const { task } = await newTask("Tarefa sem locais na consulta (fictícia)");
    const rows = await loadTaskAuditRows(admin.db, task.id, []);
    expect(rows.map((r) => r.entity_type).sort()).toEqual(["task_assignments", "tasks"]);
  });
});
