/**
 * Consultas da tela de tarefa do campo, compartilhadas com os testes de banco.
 * tasks↔service_requests têm duas FKs (tasks.service_request_id e service_requests.task_id):
 * todo embed entre as duas precisa nomear a FK, senão a API responde PGRST201.
 */
export const FIELD_OCCURRENCE_SELECT =
  "id, task_id, scheduled_date, status, no_show_reason, notes, started_at, finished_at, site_id, site:sites(name), area:site_areas(name), task:tasks(id, title, description, due_date, service_request_id, kind:task_kinds(name), request:service_requests!tasks_service_request_id_fkey(id, number, title))";
