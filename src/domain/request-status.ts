/**
 * Ciclo de vida do chamado/OS (Word §4). Mesma tabela é imposta no banco
 * pelas funções RPC; aqui serve à interface e às validações antecipadas.
 */

export const REQUEST_STATUSES = [
  "aberta",
  "programada",
  "em_execucao",
  "pendente",
  "executada",
  "concluida",
  "cancelada",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const STATUS_LABEL: Record<RequestStatus, string> = {
  aberta: "Aberta",
  programada: "Programada",
  em_execucao: "Em execução",
  pendente: "Pendente",
  executada: "Executada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const STATUS_DESCRIPTION: Record<RequestStatus, string> = {
  aberta: "Solicitação recebida, aguardando triagem.",
  programada: "Responsável e data de atendimento definidos.",
  em_execucao: "Serviço iniciado, com possibilidade de várias atualizações.",
  pendente: "Atendimento impedido ou interrompido, com justificativa.",
  executada: "Execução informada pelo funcionário, aguardando validação.",
  concluida: "Resultado validado pela Megagyn e atendimento encerrado.",
  cancelada: "Encerramento sem execução, autorizado e justificado.",
};

export type ActorRole = "admin" | "worker" | "foreman" | "client";
const FIELD: ActorRole[] = ["admin", "worker", "foreman"];
const ADMIN: ActorRole[] = ["admin"];

type ActionDef = { from: RequestStatus[]; to: RequestStatus | "same"; roles: ActorRole[]; label: string };

/** Ordem das chaves define a ordem dos botões. */
export const REQUEST_ACTIONS = {
  programar: { from: ["aberta"], to: "programada", roles: ADMIN, label: "Programar" },
  reprogramar: { from: ["programada", "pendente"], to: "programada", roles: ADMIN, label: "Reprogramar" },
  iniciar: { from: ["programada"], to: "em_execucao", roles: FIELD, label: "Iniciar" },
  registrar_atividade: {
    from: ["programada", "em_execucao"],
    to: "em_execucao",
    roles: FIELD,
    label: "Registrar o que foi feito",
  },
  informar_pendencia: {
    from: ["programada", "em_execucao"],
    to: "pendente",
    roles: FIELD,
    label: "Não consegui concluir",
  },
  retomar: { from: ["pendente"], to: "em_execucao", roles: FIELD, label: "Retomar" },
  informar_execucao: { from: ["programada", "em_execucao"], to: "executada", roles: FIELD, label: "Concluí" },
  validar: { from: ["executada"], to: "concluida", roles: ADMIN, label: "Validar e concluir" },
  devolver: { from: ["executada"], to: "em_execucao", roles: ADMIN, label: "Devolver para correção" },
  cancelar: { from: ["aberta", "programada", "em_execucao", "pendente"], to: "cancelada", roles: ADMIN, label: "Cancelar" },
  reabrir: { from: ["concluida", "cancelada"], to: "aberta", roles: ADMIN, label: "Reabrir" },
} as const satisfies Record<string, ActionDef>;

export type RequestAction = keyof typeof REQUEST_ACTIONS;
const ACTION_KEYS = Object.keys(REQUEST_ACTIONS) as RequestAction[];

export function canPerform(action: RequestAction, status: RequestStatus, role: ActorRole): boolean {
  const def: ActionDef = REQUEST_ACTIONS[action];
  return def.from.includes(status) && def.roles.includes(role);
}

export function nextStatus(action: RequestAction, status: RequestStatus): RequestStatus {
  const def: ActionDef = REQUEST_ACTIONS[action];
  if (!def.from.includes(status)) {
    throw new Error(`Ação "${def.label}" não é permitida quando o chamado está "${STATUS_LABEL[status]}".`);
  }
  return def.to === "same" ? status : def.to;
}

export function availableActions(status: RequestStatus, role: ActorRole): RequestAction[] {
  return ACTION_KEYS.filter((a) => canPerform(a, status, role));
}

export const TERMINAL_STATUSES: RequestStatus[] = ["concluida", "cancelada"];
export const OPEN_STATUSES: RequestStatus[] = ["aberta", "programada", "em_execucao", "pendente", "executada"];

type Input = Record<string, unknown>;
const blank = (v: unknown) => typeof v !== "string" || v.trim() === "";
const emptyList = (v: unknown) => !Array.isArray(v) || v.length === 0;

/** Campos obrigatórios por ação. Retorna { campo: mensagem }; vazio = válido. */
export function validateActionInput(action: RequestAction, input: Input): Record<string, string> {
  const e: Record<string, string> = {};
  switch (action) {
    case "programar":
      if (emptyList(input.assigneeIds)) e.assigneeIds = "Escolha ao menos 1 responsável.";
      if (blank(input.scheduledDate)) e.scheduledDate = "Informe a data programada.";
      break;
    case "reprogramar":
      if (blank(input.scheduledDate)) e.scheduledDate = "Informe a nova data programada.";
      break;
    case "registrar_atividade":
      if (blank(input.description)) e.description = "Descreva o que foi feito.";
      break;
    case "informar_pendencia":
      if (blank(input.pendingReasonId)) e.pendingReasonId = "Escolha o motivo.";
      if (blank(input.explanation)) e.explanation = "Explique o que aconteceu.";
      if (blank(input.nextAction)) e.nextAction = "Informe a providência necessária.";
      if (blank(input.nextActionOwnerId)) e.nextActionOwnerId = "Indique quem faz a próxima ação.";
      if (blank(input.expectedReturnDate)) e.expectedReturnDate = "Informe a previsão de retorno.";
      break;
    case "informar_execucao":
      if (blank(input.solution)) e.solution = "Descreva a solução aplicada.";
      if (emptyList(input.resultPhotoIds)) e.resultPhotoIds = "Envie ao menos 1 foto do resultado.";
      break;
    case "devolver":
    case "cancelar":
    case "reabrir":
      if (blank(input.reason)) e.reason = "Informe o motivo.";
      break;
    default:
      break;
  }
  return e;
}

/** Prazo vencido é indicador separado, nunca um status (Word §4). */
export function isOverdue(dueDate: string | null | undefined, status: RequestStatus, todayIso: string): boolean {
  if (!dueDate) return false;
  if (TERMINAL_STATUSES.includes(status)) return false;
  return dueDate < todayIso;
}
