import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  formatDateBR,
  formatDateTimeBR,
  isoDateInTz,
  longDatePt,
  monthCutoffUtc,
  monthName,
  monthRangeUtc,
  monthTitle,
  parseDateBR,
  zonedMidnightUtc,
} from "./dates";

describe("fronteiras de mês em America/Sao_Paulo", () => {
  it("o corte de setembro/2026 é 01/10/2026 00:00 em São Paulo (03:00 UTC)", () => {
    expect(monthCutoffUtc(2026, 9).toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });

  it("dezembro vira o ano", () => {
    expect(monthCutoffUtc(2026, 12).toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("respeita horário de verão histórico (não fixa -03:00)", () => {
    // Em 01/12/2018 São Paulo estava em UTC-2.
    expect(zonedMidnightUtc(2018, 12, 1).toISOString()).toBe("2018-12-01T02:00:00.000Z");
  });

  it("intervalo do mês é [início, corte)", () => {
    const { start, end } = monthRangeUtc(2026, 9);
    expect(start.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });

  it("data de negócio de um instante UTC é a data em São Paulo", () => {
    expect(isoDateInTz(new Date("2026-10-01T02:59:59Z"))).toBe("2026-09-30");
    expect(isoDateInTz(new Date("2026-10-01T03:00:00Z"))).toBe("2026-10-01");
  });
});

describe("formatação pt-BR", () => {
  it("formata data dd/MM/yyyy", () => {
    expect(formatDateBR("2026-09-03")).toBe("03/09/2026");
    expect(formatDateBR(null)).toBe("—");
  });

  it("formata data e hora no fuso de São Paulo", () => {
    expect(formatDateTimeBR("2026-10-24T17:02:00Z")).toBe("24/10/2026 14:02");
  });

  it("interpreta dd/MM/yyyy digitado", () => {
    expect(parseDateBR("25/10/2026")).toBe("2026-10-25");
    expect(parseDateBR("31/02/2026")).toBeNull();
    expect(parseDateBR("2026-10-25")).toBeNull();
  });

  it("nomes de mês e título do fechamento", () => {
    expect(monthName(9)).toBe("setembro");
    expect(monthName(3)).toBe("março");
    expect(monthTitle(2026, 9)).toBe("SETEMBRO / 2026");
  });

  it("data por extenso como na planilha de diárias", () => {
    expect(longDatePt("2026-09-01")).toBe("terça-feira, 1 de setembro de 2026");
    expect(longDatePt("2026-09-05")).toBe("sábado, 5 de setembro de 2026");
  });

  it("soma dias em datas ISO", () => {
    expect(addDaysIso("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDaysIso("2026-10-01", -1)).toBe("2026-09-30");
  });
});
