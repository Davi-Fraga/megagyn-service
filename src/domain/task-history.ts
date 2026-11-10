import { formatDateBR } from "./dates";

/** Linha de audit_events de uma tarefa, dos seus locais (task_occurrences) ou dos responsáveis (task_assignments). */
export type TaskAuditRow = {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string | null;
  reason: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
};

export type TaskHistoryEntry = {
  id: number;
  at: string;
  actorId: string | null;
  /** O que aconteceu, em uma frase. */
  what: string;
  reason: string | null;
  /** Observação do encerramento no local. */
  note: string | null;
};

type Names = { site: (id: string) => string; person: (id: string) => string };
type Rec = Record<string, unknown>;

export const TASK_STATUS_LABEL: Record<string, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
const OCCURRENCE_STATUS: Record<string, string> = {
  prevista: "Voltou para prevista",
  iniciada: "Iniciada",
  concluida: "Finalizada",
  nao_realizada: "Não realizada",
  cancelada: "Cancelada",
};
const TASK_FIELD: Record<string, string> = {
  title: "descrição curta",
  description: "detalhes",
  kind_id: "tipo",
  priority_id: "prioridade",
  scheduled_date: "dia",
  due_date: "prazo",
  service_request_id: "chamado ligado",
  status: "situação",
};
const IGNORED = new Set(["updated_at", "version", "created_at"]);

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const changed = (b: Rec, a: Rec) =>
  [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => !IGNORED.has(k) && JSON.stringify(b[k]) !== JSON.stringify(a[k]));

function describeTask(r: TaskAuditRow, b: Rec, a: Rec): Pick<TaskHistoryEntry, "what" | "reason"> {
  if (r.action === "insert") {
    const due = str(a.due_date);
    return { what: `Tarefa criada para ${formatDateBR(str(a.scheduled_date))}${due ? `, com prazo em ${formatDateBR(due)}` : ""}`, reason: null };
  }
  if (!b.cancelled_at && a.cancelled_at) return { what: "Tarefa cancelada", reason: str(r.reason) ?? str(a.cancel_reason) };
  const keys = changed(b, a);
  if (keys.length === 1 && keys[0] === "status") {
    const label = (s: unknown) => TASK_STATUS_LABEL[String(s)] ?? String(s);
    return { what: `Situação da tarefa: ${label(b.status)} → ${label(a.status)}`, reason: str(r.reason) };
  }
  return { what: `Dados da tarefa alterados: ${keys.map((k) => TASK_FIELD[k] ?? k).join(", ")}`, reason: str(r.reason) };
}

function describeOccurrence(r: TaskAuditRow, b: Rec, a: Rec, names: Names): Pick<TaskHistoryEntry, "what" | "reason" | "note"> {
  const site = names.site(String(a.site_id ?? b.site_id ?? ""));
  const reason = str(r.reason);
  if (r.action === "insert") return { what: `Local incluído: ${site}, para ${formatDateBR(str(a.scheduled_date))}`, reason, note: null };
  if (b.scheduled_date !== a.scheduled_date) {
    return { what: `Remarcada em ${site}: de ${formatDateBR(str(b.scheduled_date))} para ${formatDateBR(str(a.scheduled_date))}`, reason, note: null };
  }
  if (b.status !== a.status) {
    const status = String(a.status);
    return {
      what: `${OCCURRENCE_STATUS[status] ?? status} em ${site}`,
      reason: status === "nao_realizada" ? (reason ?? str(a.no_show_reason)) : reason,
      note: status === "concluida" ? str(a.notes) : null,
    };
  }
  return { what: `Dados alterados em ${site}`, reason, note: null };
}

function describeAssignment(r: TaskAuditRow, b: Rec, a: Rec, names: Names): Pick<TaskHistoryEntry, "what" | "reason"> {
  const person = names.person(String(a.profile_id ?? b.profile_id ?? ""));
  if (r.action === "insert") return { what: `Responsável incluído: ${person}`, reason: str(r.reason) };
  if (r.action === "delete") return { what: `Responsável retirado: ${person}`, reason: str(r.reason) };
  return { what: `Atribuição alterada: ${person}`, reason: str(r.reason) };
}

/**
 * B-39: histórico da tarefa em palavras, montado da trilha (audit_events) da tarefa, dos locais e dos
 * responsáveis. Ordem cronológica; no mesmo instante, a ordem de gravação.
 */
export function taskHistory(rows: TaskAuditRow[], names: Names): TaskHistoryEntry[] {
  return [...rows]
    .sort((x, y) => Date.parse(x.created_at) - Date.parse(y.created_at) || x.id - y.id)
    .map((r) => {
      const b = (r.before ?? {}) as Rec;
      const a = (r.after ?? {}) as Rec;
      const base = { id: r.id, at: r.created_at, actorId: r.actor_id, note: null };
      if (r.entity_type === "task_occurrences") return { ...base, ...describeOccurrence(r, b, a, names) };
      if (r.entity_type === "task_assignments") return { ...base, ...describeAssignment(r, b, a, names) };
      return { ...base, ...describeTask(r, b, a) };
    });
}
