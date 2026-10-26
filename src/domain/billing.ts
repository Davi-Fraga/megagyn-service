/**
 * Demonstrativo de diárias/horas (COMPLEMENTO M8). Valor faturável de serviço,
 * nunca misturado a despesas internas nem a orçamentos.
 */
import { unitsTimesPriceCents } from "./money";

export type BillingUnitType = "diaria" | "hora";

export type BillingRuleInput = {
  id: string;
  siteId: string | null;
  unitType: BillingUnitType;
  unitPriceCents: number;
  validFrom: string;
  validTo: string | null;
};

export type BillingTimeEntry = {
  workDate: string;
  siteId: string;
  hours: number | null;
  billable: boolean;
  /** Diárias em centésimos: 1 diária = 100. */
  billingUnitsCenti: number;
};

export type BillingLine = { date: string; unitsCenti: number; hours: number; unitPriceCents: number; totalCents: number };

export type BillingStatement = {
  unitType: BillingUnitType;
  lines: BillingLine[];
  unitsTotalCenti: number;
  totalCents: number;
  missingRuleDates: string[];
};

/** Regra vigente na data; a regra específica da unidade prevalece sobre a regra geral do cliente. */
export function priceForDate(
  rules: BillingRuleInput[],
  date: string,
  siteId: string,
  unitType: BillingUnitType,
): BillingRuleInput | null {
  const valid = rules.filter(
    (r) => r.unitType === unitType && r.validFrom <= date && (r.validTo === null || date <= r.validTo) && (r.siteId === null || r.siteId === siteId),
  );
  return valid.find((r) => r.siteId === siteId) ?? valid.find((r) => r.siteId === null) ?? null;
}

const toCenti = (n: number) => Math.round(n * 100);

export function buildBillingStatement(input: {
  entries: BillingTimeEntry[];
  rules: BillingRuleInput[];
  siteId: string;
  unitType: BillingUnitType;
}): BillingStatement {
  const byDate = new Map<string, { unitsCenti: number; hoursCenti: number }>();
  for (const e of input.entries) {
    if (!e.billable || e.siteId !== input.siteId) continue;
    const acc = byDate.get(e.workDate) ?? { unitsCenti: 0, hoursCenti: 0 };
    const hoursCenti = e.hours === null ? 0 : toCenti(e.hours);
    acc.hoursCenti += hoursCenti;
    acc.unitsCenti += input.unitType === "diaria" ? e.billingUnitsCenti : hoursCenti;
    byDate.set(e.workDate, acc);
  }

  const lines: BillingLine[] = [];
  const missing: string[] = [];
  for (const date of [...byDate.keys()].sort()) {
    const acc = byDate.get(date)!;
    const rule = priceForDate(input.rules, date, input.siteId, input.unitType);
    if (!rule) {
      missing.push(date);
      continue;
    }
    lines.push({
      date,
      unitsCenti: acc.unitsCenti,
      hours: acc.hoursCenti / 100,
      unitPriceCents: rule.unitPriceCents,
      totalCents: unitsTimesPriceCents(acc.unitsCenti, rule.unitPriceCents),
    });
  }

  return {
    unitType: input.unitType,
    lines,
    unitsTotalCenti: lines.reduce((n, l) => n + l.unitsCenti, 0),
    totalCents: lines.reduce((n, l) => n + l.totalCents, 0),
    missingRuleDates: missing,
  };
}

/** 2400 → "24"; 250 → "2,5". */
export function formatUnits(unitsCenti: number): string {
  const integer = Math.floor(unitsCenti / 100);
  const frac = unitsCenti % 100;
  if (frac === 0) return String(integer);
  return `${integer},${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}
