import { STATUS_LABEL, type RequestStatus } from "./request-status";

/**
 * Régua da situação da O.S.: o ciclo do chamado (Word §4) desenhado como uma trena.
 * Pendente não é etapa: é uma pausa em "Em execução". Cancelada risca a régua inteira.
 * O nome da situação vai sempre em texto; a régua só reforça.
 */
export const RULER_STAGES = ["aberta", "programada", "em_execucao", "executada", "concluida"] as const;
export type RulerStage = (typeof RULER_STAGES)[number];
export type RulerStepState = "feita" | "atual" | "pausada" | "futura";
export type RulerStep = { stage: RulerStage; label: string; state: RulerStepState };
export type StatusRulerView = { label: string; steps: RulerStep[]; paused: boolean; cancelled: boolean };
/** Régua genérica: o mesmo desenho serve à O.S. e ao orçamento. */
export type RulerView = { label: string; steps: Array<{ stage: string; label: string; state: RulerStepState }>; paused: boolean; cancelled: boolean };

/** Etapa em que cada situação está (-1: fora da régua). */
const STAGE_INDEX: Record<RequestStatus, number> = {
  aberta: 0,
  programada: 1,
  em_execucao: 2,
  pendente: 2,
  executada: 3,
  concluida: 4,
  cancelada: -1,
};

export function statusRuler(status: RequestStatus): StatusRulerView {
  const current = STAGE_INDEX[status];
  const paused = status === "pendente";
  const cancelled = status === "cancelada";
  const steps = RULER_STAGES.map((stage, i): RulerStep => {
    let state: RulerStepState = "futura";
    if (i < current || (i === current && status === "concluida")) state = "feita";
    else if (i === current) state = paused ? "pausada" : "atual";
    return { stage, label: STATUS_LABEL[stage], state };
  });
  return { label: STATUS_LABEL[status], steps, paused, cancelled };
}

type StatusEvent = { from_status: string | null; to_status: string | null; occurred_at: string };

/**
 * Quando cada etapa começou, pela ordem do histórico. Voltar a uma etapa anterior
 * (devolução, reprogramação, reabertura) apaga as datas das etapas seguintes;
 * pausa, retomada e cancelamento não mudam as datas já registradas.
 */
export function rulerStageDates(events: StatusEvent[]): Partial<Record<RulerStage, string>> {
  const dates: Partial<Record<RulerStage, string>> = {};
  for (const ev of events) {
    if (!ev.to_status || ev.to_status === ev.from_status) continue;
    const index = STAGE_INDEX[ev.to_status as RequestStatus] ?? -1;
    if (index < 0) continue;
    for (const later of RULER_STAGES.slice(index + 1)) delete dates[later];
    dates[RULER_STAGES[index]!] ??= ev.occurred_at;
  }
  return dates;
}
