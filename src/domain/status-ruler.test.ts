import { describe, expect, it } from "vitest";
import { REQUEST_STATUSES, STATUS_LABEL, type RequestStatus } from "./request-status";
import { RULER_STAGES, rulerStageDates, statusRuler } from "./status-ruler";

const states = (status: RequestStatus) => statusRuler(status).steps.map((s) => s.state);

describe("régua da situação: situação → etapas", () => {
  it("tem as cinco etapas do ciclo, na ordem, com o nome de cada uma", () => {
    expect(RULER_STAGES).toEqual(["aberta", "programada", "em_execucao", "executada", "concluida"]);
    expect(statusRuler("aberta").steps.map((s) => s.label)).toEqual(["Aberta", "Programada", "Em execução", "Executada", "Concluída"]);
  });

  it("marca as etapas passadas, a atual e as futuras", () => {
    expect(states("aberta")).toEqual(["atual", "futura", "futura", "futura", "futura"]);
    expect(states("programada")).toEqual(["feita", "atual", "futura", "futura", "futura"]);
    expect(states("em_execucao")).toEqual(["feita", "feita", "atual", "futura", "futura"]);
    expect(states("executada")).toEqual(["feita", "feita", "feita", "atual", "futura"]);
  });

  it("concluída preenche a régua inteira", () => {
    expect(states("concluida")).toEqual(["feita", "feita", "feita", "feita", "feita"]);
  });

  it("pendente é uma pausa na etapa Em execução, não uma etapa", () => {
    const r = statusRuler("pendente");
    expect(r.paused).toBe(true);
    expect(r.cancelled).toBe(false);
    expect(states("pendente")).toEqual(["feita", "feita", "pausada", "futura", "futura"]);
  });

  it("cancelada risca a régua e nenhuma etapa fica como atual", () => {
    const r = statusRuler("cancelada");
    expect(r.cancelled).toBe(true);
    expect(r.paused).toBe(false);
    expect(states("cancelada")).toEqual(["futura", "futura", "futura", "futura", "futura"]);
  });

  it("sempre traz o nome da situação em texto", () => {
    for (const status of REQUEST_STATUSES) expect(statusRuler(status).label).toBe(STATUS_LABEL[status]);
  });

  it("só pendente pausa e só cancelada risca", () => {
    for (const status of REQUEST_STATUSES) {
      expect(statusRuler(status).paused).toBe(status === "pendente");
      expect(statusRuler(status).cancelled).toBe(status === "cancelada");
    }
  });
});

describe("régua da situação: data de cada etapa pelo histórico", () => {
  const ev = (from: string | null, to: string | null, at: string) => ({ from_status: from, to_status: to, occurred_at: at });

  it("guarda quando cada etapa começou", () => {
    expect(
      rulerStageDates([
        ev(null, "aberta", "2026-10-28T12:12:00Z"),
        ev("aberta", "programada", "2026-10-29T17:05:00Z"),
        ev("programada", "em_execucao", "2026-10-30T11:40:00Z"),
        ev("em_execucao", "executada", "2026-11-03T19:42:00Z"),
      ]),
    ).toEqual({
      aberta: "2026-10-28T12:12:00Z",
      programada: "2026-10-29T17:05:00Z",
      em_execucao: "2026-10-30T11:40:00Z",
      executada: "2026-11-03T19:42:00Z",
    });
  });

  it("pendência e retomada não mudam a data de Em execução; eventos sem troca de situação são ignorados", () => {
    expect(
      rulerStageDates([
        ev(null, "aberta", "2026-10-01T10:00:00Z"),
        ev("aberta", "programada", "2026-10-02T10:00:00Z"),
        ev("programada", "em_execucao", "2026-10-03T10:00:00Z"),
        ev("em_execucao", "em_execucao", "2026-10-03T15:00:00Z"),
        ev("em_execucao", "pendente", "2026-10-04T10:00:00Z"),
        ev(null, null, "2026-10-04T11:00:00Z"),
        ev("pendente", "em_execucao", "2026-10-05T10:00:00Z"),
      ]),
    ).toEqual({ aberta: "2026-10-01T10:00:00Z", programada: "2026-10-02T10:00:00Z", em_execucao: "2026-10-03T10:00:00Z" });
  });

  it("voltar a uma etapa anterior apaga as datas das etapas seguintes", () => {
    expect(
      rulerStageDates([
        ev(null, "aberta", "2026-10-01T10:00:00Z"),
        ev("aberta", "programada", "2026-10-02T10:00:00Z"),
        ev("programada", "em_execucao", "2026-10-03T10:00:00Z"),
        ev("em_execucao", "executada", "2026-10-04T10:00:00Z"),
        ev("executada", "em_execucao", "2026-10-05T10:00:00Z"),
      ]),
    ).toEqual({ aberta: "2026-10-01T10:00:00Z", programada: "2026-10-02T10:00:00Z", em_execucao: "2026-10-03T10:00:00Z" });

    expect(
      rulerStageDates([
        ev(null, "aberta", "2026-10-01T10:00:00Z"),
        ev("aberta", "programada", "2026-10-02T10:00:00Z"),
        ev("programada", "em_execucao", "2026-10-03T10:00:00Z"),
        ev("em_execucao", "executada", "2026-10-04T10:00:00Z"),
        ev("executada", "concluida", "2026-10-05T10:00:00Z"),
        ev("concluida", "aberta", "2026-10-06T10:00:00Z"),
      ]),
    ).toEqual({ aberta: "2026-10-01T10:00:00Z" });
  });

  it("cancelamento não é etapa e não apaga as datas já registradas", () => {
    expect(
      rulerStageDates([
        ev(null, "aberta", "2026-10-01T10:00:00Z"),
        ev("aberta", "programada", "2026-10-02T10:00:00Z"),
        ev("programada", "cancelada", "2026-10-03T10:00:00Z"),
      ]),
    ).toEqual({ aberta: "2026-10-01T10:00:00Z", programada: "2026-10-02T10:00:00Z" });
  });
});
