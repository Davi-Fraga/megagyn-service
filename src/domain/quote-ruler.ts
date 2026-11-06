import { QUOTE_STATUS_LABEL, type QuoteStatus } from "./quote";
import type { RulerStepState, RulerView } from "./status-ruler";

/**
 * Régua da situação do orçamento, no mesmo desenho da régua da O.S.: Rascunho → Enviado → Aprovado.
 * Expirado é uma pausa em "Enviado" (renovar a validade retoma); recusado e cancelado riscam a régua.
 * Recebe a situação efetiva (com "expirado" já calculado na leitura).
 */
export const QUOTE_RULER_STAGES = ["rascunho", "enviado", "aprovado"] as const;

const STAGE_INDEX: Record<QuoteStatus, number> = {
  rascunho: 0,
  enviado: 1,
  expirado: 1,
  aprovado: 2,
  rejeitado: -1,
  cancelado: -1,
};

export function quoteRuler(status: QuoteStatus): RulerView {
  const current = STAGE_INDEX[status];
  const paused = status === "expirado";
  const cancelled = current === -1;
  const steps = QUOTE_RULER_STAGES.map((stage, i) => {
    let state: RulerStepState = "futura";
    if (i < current || (i === current && status === "aprovado")) state = "feita";
    else if (i === current) state = paused ? "pausada" : "atual";
    return { stage, label: QUOTE_STATUS_LABEL[stage], state };
  });
  return { label: QUOTE_STATUS_LABEL[status], steps, paused, cancelled };
}
