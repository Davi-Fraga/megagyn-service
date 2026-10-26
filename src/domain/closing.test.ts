import { describe, expect, it } from "vitest";
import { classifyForPeriod, statusAt, type ClosingRequestInput } from "./closing";
import { monthRangeUtc } from "./dates";

// Instantes em horário de São Paulo (-03:00) para legibilidade.
const sp = (s: string) => new Date(`${s}-03:00`).toISOString();

function req(id: string, events: ClosingRequestInput["events"], extra: Partial<ClosingRequestInput> = {}): ClosingRequestInput {
  const opening = events.find((e) => e.eventType === "abertura");
  return {
    id,
    number: `2026-${id}`,
    title: `Chamado ${id}`,
    openedAt: opening?.occurredAt ?? events[0]!.occurredAt,
    isInternal: false,
    events,
    ...extra,
  };
}

const sep = monthRangeUtc(2026, 9);
const oct = monthRangeUtc(2026, 10);

// A: aberto em setembro, pendente em setembro, concluído em outubro.
const A = req("A", [
  { eventType: "abertura", toStatus: "aberta", occurredAt: sp("2026-09-10T09:00:00") },
  {
    eventType: "classificacao",
    toStatus: "programada",
    occurredAt: sp("2026-09-10T10:00:00"),
    payload: { scheduled_date: "2026-09-12", assignee_names: ["João"] },
  },
  { eventType: "inicio", toStatus: "em_execucao", occurredAt: sp("2026-09-12T08:00:00") },
  {
    eventType: "pendencia",
    toStatus: "pendente",
    occurredAt: sp("2026-09-20T16:00:00"),
    payload: {
      pending_reason: "Falta de material",
      explanation: "Faltou luva de 50 mm",
      next_action: "Comprar luva",
      next_action_owner_name: "Carlos",
      expected_return_date: "2026-10-02",
    },
  },
  { eventType: "retomada", toStatus: "em_execucao", occurredAt: sp("2026-10-02T08:00:00") },
  { eventType: "execucao_informada", toStatus: "executada", occurredAt: sp("2026-10-03T11:00:00") },
  { eventType: "validacao", toStatus: "concluida", occurredAt: sp("2026-10-05T09:00:00") },
]);

// B: antigo (julho), concluído em setembro.
const B = req("B", [
  { eventType: "abertura", toStatus: "aberta", occurredAt: sp("2026-07-01T09:00:00") },
  { eventType: "classificacao", toStatus: "programada", occurredAt: sp("2026-07-02T09:00:00") },
  { eventType: "execucao_informada", toStatus: "executada", occurredAt: sp("2026-09-14T09:00:00") },
  { eventType: "validacao", toStatus: "concluida", occurredAt: sp("2026-09-15T09:00:00") },
]);

// C: concluído em agosto e reaberto em setembro.
const C = req("C", [
  { eventType: "abertura", toStatus: "aberta", occurredAt: sp("2026-08-01T09:00:00") },
  { eventType: "validacao", toStatus: "concluida", occurredAt: sp("2026-08-20T09:00:00") },
  { eventType: "reabertura", toStatus: "aberta", occurredAt: sp("2026-09-05T09:00:00"), reason: "Vazamento voltou" },
]);

// D: aberto e cancelado em setembro.
const D = req("D", [
  { eventType: "abertura", toStatus: "aberta", occurredAt: sp("2026-09-03T09:00:00") },
  { eventType: "cancelamento", toStatus: "cancelada", occurredAt: sp("2026-09-04T09:00:00"), reason: "Duplicado" },
]);

// E: aberto em outubro (não existe no fechamento de setembro).
const E = req("E", [{ eventType: "abertura", toStatus: "aberta", occurredAt: sp("2026-10-02T09:00:00") }]);

// F: executado em setembro, aguardando validação no corte.
const F = req("F", [
  { eventType: "abertura", toStatus: "aberta", occurredAt: sp("2026-09-01T09:00:00") },
  { eventType: "execucao_informada", toStatus: "executada", occurredAt: sp("2026-09-30T23:59:59") },
]);

// G: demanda interna, oculta no relatório do cliente.
const G = req("G", [{ eventType: "abertura", toStatus: "aberta", occurredAt: sp("2026-09-02T09:00:00") }], { isInternal: true });

const all = [A, B, C, D, E, F, G];
const ids = (items: Array<{ request: { id: string } }>) => items.map((i) => i.request.id).sort();

describe("statusAt", () => {
  it("apura o estado pelos eventos anteriores ao corte", () => {
    expect(statusAt(A.events, sep.end)).toBe("pendente");
    expect(statusAt(A.events, oct.end)).toBe("concluida");
    expect(statusAt(E.events, sep.end)).toBeNull();
  });

  it("evento às 23:59:59 do último dia pertence ao mês; 00:00 do dia 1 não", () => {
    expect(statusAt(F.events, sep.end)).toBe("executada");
    const late = req("L", [
      { eventType: "abertura", toStatus: "aberta", occurredAt: sp("2026-09-29T09:00:00") },
      { eventType: "validacao", toStatus: "concluida", occurredAt: sp("2026-10-01T00:00:00") },
    ]);
    expect(statusAt(late.events, sep.end)).toBe("aberta");
  });
});

describe("classifyForPeriod — fechamento de setembro/2026", () => {
  const result = classifyForPeriod(all, sep);

  it("chamado resolvido em outubro continua pendente em setembro, com motivo e providência", () => {
    expect(ids(result.emAberto.pendente)).toEqual(["A"]);
    const a = result.emAberto.pendente[0]!;
    expect(a.lastPending).toMatchObject({
      reason: "Falta de material",
      nextAction: "Comprar luva",
      ownerName: "Carlos",
      expectedReturnDate: "2026-10-02",
    });
    expect(ids(result.concluidos)).not.toContain("A");
  });

  it("chamado antigo concluído no mês aparece entre as conclusões e entre os herdados", () => {
    expect(ids(result.concluidos)).toEqual(["B"]);
    expect(result.concluidos[0]!.openedBeforePeriod).toBe(true);
    expect(ids(result.herdados)).toContain("B");
  });

  it("reabertura e cancelamento não contam como novas aberturas", () => {
    expect(ids(result.novos)).toEqual(["A", "D", "F"]);
    expect(ids(result.reabertos)).toEqual(["C"]);
    expect(result.reabertos[0]!.reopenReason).toBe("Vazamento voltou");
    expect(ids(result.cancelados)).toEqual(["D"]);
    expect(result.cancelados[0]!.cancelReason).toBe("Duplicado");
  });

  it("separa executados aguardando validação e itens em aberto por situação", () => {
    expect(ids(result.aguardandoValidacao)).toEqual(["F"]);
    expect(ids(result.emAberto.aberta)).toEqual(["C"]);
  });

  it("não inclui chamado aberto depois do corte nem demanda interna por padrão", () => {
    const every = [
      ...result.herdados, ...result.novos, ...result.concluidos, ...result.aguardandoValidacao,
      ...result.cancelados, ...result.reabertos, ...Object.values(result.emAberto).flat(),
    ];
    expect(every.map((i) => i.request.id)).not.toContain("E");
    expect(every.map((i) => i.request.id)).not.toContain("G");
  });

  it("inclui demanda interna quando solicitado (relatório interno)", () => {
    const internal = classifyForPeriod(all, sep, { includeInternal: true });
    expect(ids(internal.novos)).toContain("G");
  });

  it("resumo conta cada seção separadamente", () => {
    expect(result.summary).toEqual({
      herdados: 1,
      novos: 3,
      concluidos: 1,
      emAberto: { aberta: 1, programada: 0, em_execucao: 0, pendente: 1 },
      emAbertoTotal: 2,
      aguardandoValidacao: 1,
      cancelados: 1,
      reabertos: 1,
    });
  });
});

describe("classifyForPeriod — fechamento de outubro/2026", () => {
  const result = classifyForPeriod(all, oct);

  it("o mesmo chamado A agora é herdado e concluído", () => {
    expect(ids(result.herdados)).toEqual(["A", "C", "F"]);
    expect(ids(result.concluidos)).toEqual(["A"]);
    expect(ids(result.novos)).toEqual(["E"]);
  });

  it("guarda a última programação conhecida antes do corte", () => {
    const sepResult = classifyForPeriod(all, sep);
    expect(sepResult.emAberto.pendente[0]!.lastSchedule).toEqual({ scheduledDate: "2026-09-12", assigneeNames: ["João"] });
  });
});
