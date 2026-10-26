import { describe, expect, it } from "vitest";
import { buildBillingStatement, priceForDate, type BillingRuleInput, type BillingTimeEntry } from "./billing";
import { daysOfMonth } from "./dates";

const SEPT_WORKED = [
  "01", "02", "03", "04", "05", "08", "09", "10", "11", "14", "15", "16",
  "17", "18", "19", "21", "22", "23", "24", "25", "26", "28", "29", "30",
].map((d) => `2026-09-${d}`);

const rule: BillingRuleInput = { id: "r1", siteId: null, unitType: "diaria", unitPriceCents: 33300, validFrom: "2026-01-01", validTo: null };

function entries(dates: string[], extra: Partial<BillingTimeEntry> = {}): BillingTimeEntry[] {
  return dates.map((workDate) => ({ workDate, siteId: "s1", hours: 9, billable: true, billingUnitsCenti: 100, ...extra }));
}

describe("demonstrativo de diárias (referência: setembro/2026)", () => {
  it("24 diárias × R$ 333,00 = R$ 7.992,00", () => {
    expect(SEPT_WORKED).toHaveLength(24);
    const st = buildBillingStatement({ entries: entries(SEPT_WORKED), rules: [rule], siteId: "s1", unitType: "diaria" });
    expect(st.lines).toHaveLength(24);
    expect(st.unitsTotalCenti).toBe(2400);
    expect(st.totalCents).toBe(799200);
    expect(st.lines[0]).toEqual({ date: "2026-09-01", unitsCenti: 100, hours: 9, unitPriceCents: 33300, totalCents: 33300 });
    expect(st.missingRuleDates).toEqual([]);
  });

  it("dias não faturáveis ficam fora e meia diária é proporcional", () => {
    const st = buildBillingStatement({
      entries: [
        ...entries(["2026-09-01"]),
        ...entries(["2026-09-02"], { billable: false }),
        ...entries(["2026-09-03"], { billingUnitsCenti: 50 }),
      ],
      rules: [rule],
      siteId: "s1",
      unitType: "diaria",
    });
    expect(st.lines.map((l) => l.date)).toEqual(["2026-09-01", "2026-09-03"]);
    expect(st.totalCents).toBe(33300 + 16650);
  });

  it("dois profissionais no mesmo dia somam diárias naquele dia", () => {
    const st = buildBillingStatement({
      entries: [...entries(["2026-09-01"]), ...entries(["2026-09-01"])],
      rules: [rule],
      siteId: "s1",
      unitType: "diaria",
    });
    expect(st.lines).toHaveLength(1);
    expect(st.lines[0]!.unitsCenti).toBe(200);
    expect(st.lines[0]!.hours).toBe(18);
    expect(st.totalCents).toBe(66600);
  });

  it("aplica a regra vigente em cada data e prefere a regra da unidade", () => {
    const rules: BillingRuleInput[] = [
      { ...rule, validTo: "2026-09-15" },
      { id: "r2", siteId: null, unitType: "diaria", unitPriceCents: 35000, validFrom: "2026-09-16", validTo: null },
      { id: "r3", siteId: "s1", unitType: "diaria", unitPriceCents: 40000, validFrom: "2026-09-20", validTo: "2026-09-20" },
    ];
    expect(priceForDate(rules, "2026-09-15", "s1", "diaria")?.id).toBe("r1");
    expect(priceForDate(rules, "2026-09-16", "s1", "diaria")?.id).toBe("r2");
    expect(priceForDate(rules, "2026-09-20", "s1", "diaria")?.id).toBe("r3");
    expect(priceForDate(rules, "2026-09-20", "s2", "diaria")?.id).toBe("r2");
  });

  it("aponta datas sem regra de valor em vez de inventar preço", () => {
    const st = buildBillingStatement({
      entries: entries(["2025-12-31", "2026-01-01"]),
      rules: [rule],
      siteId: "s1",
      unitType: "diaria",
    });
    expect(st.missingRuleDates).toEqual(["2025-12-31"]);
    expect(st.totalCents).toBe(33300);
  });

  it("cobrança por hora usa as horas informadas", () => {
    const hourly: BillingRuleInput = { ...rule, unitType: "hora", unitPriceCents: 5000 };
    const st = buildBillingStatement({ entries: entries(["2026-09-01"], { hours: 7.5 }), rules: [hourly], siteId: "s1", unitType: "hora" });
    expect(st.totalCents).toBe(37500);
    expect(st.unitsTotalCenti).toBe(750);
  });

  it("sanidade: setembro tem 30 dias", () => {
    expect(daysOfMonth(2026, 9)).toHaveLength(30);
  });
});
