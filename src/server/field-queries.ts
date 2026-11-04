import type { RequestStatus } from "@/domain/request-status";
import type { ServerDb } from "./data";

/**
 * Chamados das telas Hoje e Chamados do campo. Com `assignedTo`, só os que têm atribuição
 * ativa da pessoa, e o filtro fica no banco: filtrar depois de um `limit` fazia o chamado
 * atribuído sumir em local com muitos chamados ativos. Sem `assignedTo`, todos os visíveis.
 */
export function fieldRequestsQuery(db: ServerDb, statuses: RequestStatus[], assignedTo: string | null) {
  const query = db
    .from("service_requests")
    .select("id, number, title, status, scheduled_date, due_date, site:sites(name), area:site_areas(name), mine:request_assignments(profile_id)")
    .in("status", statuses);
  if (!assignedTo) return query;
  return query.eq("mine.profile_id", assignedTo).is("mine.unassigned_at", null).not("mine", "is", null);
}

/**
 * Consultas da tela de tarefa do campo, compartilhadas com os testes de banco.
 * tasks↔service_requests têm duas FKs (tasks.service_request_id e service_requests.task_id):
 * todo embed entre as duas precisa nomear a FK, senão a API responde PGRST201.
 */
export const FIELD_OCCURRENCE_SELECT =
  "id, task_id, scheduled_date, status, no_show_reason, notes, started_at, finished_at, site_id, site:sites(name), area:site_areas(name), task:tasks(id, title, description, due_date, service_request_id, kind:task_kinds(name), request:service_requests!tasks_service_request_id_fkey(id, number, title))";
