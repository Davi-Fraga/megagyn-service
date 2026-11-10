import type { TaskAuditRow } from "@/domain/task-history";
import type { ServerDb } from "./data";
import { fetchAll } from "./paginate";
import { orThrow } from "./query";

const AUDIT_COLUMNS = "id, entity_type, entity_id, action, actor_id, reason, before, after, created_at";

/**
 * B-39: trilha da tarefa (só a administração lê audit_events). Tarefa pelo id; locais pelos ids das
 * ocorrências; responsáveis pela chave composta "tarefa:pessoa" que o gatilho grava.
 */
export async function loadTaskAuditRows(db: ServerDb, taskId: string, occurrenceIds: string[]): Promise<TaskAuditRow[]> {
  const [task, occurrences, assignments] = await Promise.all([
    db.from("audit_events").select(AUDIT_COLUMNS).eq("entity_type", "tasks").eq("entity_id", taskId),
    occurrenceIds.length > 0
      ? db.from("audit_events").select(AUDIT_COLUMNS).eq("entity_type", "task_occurrences").in("entity_id", occurrenceIds)
      : Promise.resolve({ data: [], error: null }),
    db.from("audit_events").select(AUDIT_COLUMNS).eq("entity_type", "task_assignments").like("entity_id", `${taskId}:%`),
  ]);
  return [...(orThrow(task) ?? []), ...(orThrow(occurrences) ?? []), ...(orThrow(assignments) ?? [])];
}

export type OccurrenceFilters = { from: string; to: string; siteId: string | null; clientId: string | null; personId: string | null };

/**
 * Ocorrências de tarefa da agenda e do cartão "Tarefas e visitas de hoje" do painel: a mesma
 * consulta e o mesmo critério nos dois, para o número do cartão ser o total da agenda.
 * Profissional = responsável da tarefa; cliente = dono do local da ocorrência.
 */
export async function listOccurrences(db: ServerDb, f: OccurrenceFilters) {
  // Com cliente: o embed "inner" filtra as ocorrências pelos locais dele.
  const siteEmbed = f.clientId ? "site:sites!inner(name, client_id)" : "site:sites(name, client_id)";
  const rows = await fetchAll((a, b) => {
    let q = db
      .from("task_occurrences")
      .select(
        `id, scheduled_date, status, no_show_reason, site_id, ${siteEmbed}, task:tasks(id, title, status, service_request_id, kind:task_kinds(name), priority:priority_definitions(name), assignments:task_assignments(profile_id))`,
      )
      .gte("scheduled_date", f.from)
      .lte("scheduled_date", f.to)
      .order("scheduled_date")
      .order("sort_order")
      .order("id")
      .range(a, b);
    if (f.siteId) q = q.eq("site_id", f.siteId);
    if (f.clientId) q = q.eq("site.client_id", f.clientId);
    return q;
  });
  return f.personId ? rows.filter((o) => (o.task?.assignments ?? []).some((a) => a.profile_id === f.personId)) : rows;
}
