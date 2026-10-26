/**
 * Fechamento mensal: snapshot temporal (Word §8; docs/04 §9).
 * O estado de cada chamado é apurado pelos eventos registrados ANTES do corte
 * (primeiro instante do mês seguinte em America/Sao_Paulo). Nunca usa o estado atual.
 */
import type { RequestStatus } from "./request-status";

export type ClosingEvent = {
  eventType: string;
  toStatus: RequestStatus | null;
  occurredAt: string;
  reason?: string | null;
  payload?: Record<string, unknown> | null;
};

export type ClosingRequestInput = {
  id: string;
  number: string;
  title: string;
  openedAt: string;
  isInternal: boolean;
  events: ClosingEvent[];
  [extra: string]: unknown;
};

export type PendingInfo = {
  reason: string | null;
  explanation: string | null;
  nextAction: string | null;
  ownerName: string | null;
  expectedReturnDate: string | null;
  at: string;
};

export type ScheduleInfo = { scheduledDate: string | null; assigneeNames: string[] };

export type ClosingItem<R extends ClosingRequestInput = ClosingRequestInput> = {
  request: R;
  statusAtStart: RequestStatus | null;
  statusAtCutoff: RequestStatus;
  openedBeforePeriod: boolean;
  validatedAt: string | null;
  executedAt: string | null;
  cancelReason: string | null;
  canceledAt: string | null;
  reopenReason: string | null;
  reopenedAt: string | null;
  lastPending: PendingInfo | null;
  lastSchedule: ScheduleInfo | null;
};

type OpenBucket = "aberta" | "programada" | "em_execucao" | "pendente";
const OPEN_BUCKETS: OpenBucket[] = ["aberta", "programada", "em_execucao", "pendente"];

export type ClosingClassification<R extends ClosingRequestInput = ClosingRequestInput> = {
  herdados: ClosingItem<R>[];
  novos: ClosingItem<R>[];
  concluidos: ClosingItem<R>[];
  emAberto: Record<OpenBucket, ClosingItem<R>[]>;
  aguardandoValidacao: ClosingItem<R>[];
  cancelados: ClosingItem<R>[];
  reabertos: ClosingItem<R>[];
  summary: {
    herdados: number;
    novos: number;
    concluidos: number;
    emAberto: Record<OpenBucket, number>;
    emAbertoTotal: number;
    aguardandoValidacao: number;
    cancelados: number;
    reabertos: number;
  };
};

const ts = (iso: string) => new Date(iso).getTime();

function sortedEvents(events: ClosingEvent[]): ClosingEvent[] {
  // Ordenação estável por instante; empates mantêm a ordem de registro.
  return events.map((e, i) => ({ e, i })).sort((a, b) => ts(a.e.occurredAt) - ts(b.e.occurredAt) || a.i - b.i).map((x) => x.e);
}

/** Estado vigente antes do corte (exclusivo). Null = o chamado ainda não existia. */
export function statusAt(events: ClosingEvent[], cutoff: Date): RequestStatus | null {
  let status: RequestStatus | null = null;
  const limit = cutoff.getTime();
  for (const e of sortedEvents(events)) {
    if (ts(e.occurredAt) >= limit) break;
    if (e.toStatus) status = e.toStatus;
  }
  return status;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

function lastBefore(events: ClosingEvent[], cutoff: Date, predicate: (e: ClosingEvent) => boolean): ClosingEvent | null {
  let found: ClosingEvent | null = null;
  for (const e of sortedEvents(events)) {
    if (ts(e.occurredAt) >= cutoff.getTime()) break;
    if (predicate(e)) found = e;
  }
  return found;
}

function lastInPeriod(events: ClosingEvent[], start: Date, end: Date, type: string): ClosingEvent | null {
  let found: ClosingEvent | null = null;
  for (const e of sortedEvents(events)) {
    const t = ts(e.occurredAt);
    if (e.eventType === type && t >= start.getTime() && t < end.getTime()) found = e;
  }
  return found;
}

export function classifyForPeriod<R extends ClosingRequestInput>(
  requests: R[],
  period: { start: Date; end: Date },
  options: { includeInternal?: boolean } = {},
): ClosingClassification<R> {
  const out: ClosingClassification<R> = {
    herdados: [],
    novos: [],
    concluidos: [],
    emAberto: { aberta: [], programada: [], em_execucao: [], pendente: [] },
    aguardandoValidacao: [],
    cancelados: [],
    reabertos: [],
    summary: {
      herdados: 0,
      novos: 0,
      concluidos: 0,
      emAberto: { aberta: 0, programada: 0, em_execucao: 0, pendente: 0 },
      emAbertoTotal: 0,
      aguardandoValidacao: 0,
      cancelados: 0,
      reabertos: 0,
    },
  };

  const byNumber = (a: ClosingItem<R>, b: ClosingItem<R>) => a.request.number.localeCompare(b.request.number);

  for (const request of requests) {
    if (request.isInternal && !options.includeInternal) continue;
    const statusAtCutoff = statusAt(request.events, period.end);
    if (!statusAtCutoff) continue; // aberto depois do corte

    const opening = lastBefore(request.events, period.end, (e) => e.eventType === "abertura");
    const openedAt = opening?.occurredAt ?? request.openedAt;
    const openedBeforePeriod = ts(openedAt) < period.start.getTime();
    const statusAtStart = statusAt(request.events, period.start);

    const validation = lastInPeriod(request.events, period.start, period.end, "validacao");
    const execution = lastBefore(request.events, period.end, (e) => e.eventType === "execucao_informada");
    const cancel = lastInPeriod(request.events, period.start, period.end, "cancelamento");
    const reopen = lastInPeriod(request.events, period.start, period.end, "reabertura");
    const pendingEvent = lastBefore(request.events, period.end, (e) => e.eventType === "pendencia");
    const scheduleEvent = lastBefore(request.events, period.end, (e) => !!e.payload && "scheduled_date" in e.payload);

    const item: ClosingItem<R> = {
      request,
      statusAtStart,
      statusAtCutoff,
      openedBeforePeriod,
      validatedAt: validation?.occurredAt ?? null,
      executedAt: execution?.occurredAt ?? null,
      cancelReason: cancel ? (cancel.reason ?? null) : null,
      canceledAt: cancel?.occurredAt ?? null,
      reopenReason: reopen ? (reopen.reason ?? null) : null,
      reopenedAt: reopen?.occurredAt ?? null,
      lastPending:
        statusAtCutoff === "pendente" && pendingEvent
          ? {
              reason: str(pendingEvent.payload?.pending_reason),
              explanation: str(pendingEvent.payload?.explanation),
              nextAction: str(pendingEvent.payload?.next_action),
              ownerName: str(pendingEvent.payload?.next_action_owner_name),
              expectedReturnDate: str(pendingEvent.payload?.expected_return_date),
              at: pendingEvent.occurredAt,
            }
          : null,
      lastSchedule: scheduleEvent
        ? {
            scheduledDate: str(scheduleEvent.payload?.scheduled_date),
            assigneeNames: Array.isArray(scheduleEvent.payload?.assignee_names)
              ? (scheduleEvent.payload!.assignee_names as unknown[]).filter((n): n is string => typeof n === "string")
              : [],
          }
        : null,
    };

    if (openedBeforePeriod && statusAtStart && statusAtStart !== "concluida" && statusAtStart !== "cancelada") {
      out.herdados.push(item);
    }
    if (!openedBeforePeriod) out.novos.push(item);
    if (validation && statusAtCutoff === "concluida") out.concluidos.push(item);
    if ((OPEN_BUCKETS as string[]).includes(statusAtCutoff)) out.emAberto[statusAtCutoff as OpenBucket].push(item);
    if (statusAtCutoff === "executada") out.aguardandoValidacao.push(item);
    if (cancel) out.cancelados.push(item);
    if (reopen) out.reabertos.push(item);
  }

  for (const list of [out.herdados, out.novos, out.concluidos, out.aguardandoValidacao, out.cancelados, out.reabertos]) {
    list.sort(byNumber);
  }
  for (const b of OPEN_BUCKETS) out.emAberto[b].sort(byNumber);

  out.summary = {
    herdados: out.herdados.length,
    novos: out.novos.length,
    concluidos: out.concluidos.length,
    emAberto: {
      aberta: out.emAberto.aberta.length,
      programada: out.emAberto.programada.length,
      em_execucao: out.emAberto.em_execucao.length,
      pendente: out.emAberto.pendente.length,
    },
    emAbertoTotal: OPEN_BUCKETS.reduce((n, b) => n + out.emAberto[b].length, 0),
    aguardandoValidacao: out.aguardandoValidacao.length,
    cancelados: out.cancelados.length,
    reabertos: out.reabertos.length,
  };
  return out;
}
