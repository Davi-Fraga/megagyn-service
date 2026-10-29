import { formatDateBR, isValidIsoDate } from "./dates";
import { UUID_RE } from "./ids";
import { csvFileName, fileSlug } from "./report-naming";

/** Parâmetros do PDF "despesas_internas" (vêm de report_artifacts.params). */
export type ExpenseReportParams = { from: string; to: string; siteId: string | null };

export function parseExpenseReportParams(params: unknown): ExpenseReportParams | null {
  if (!params || typeof params !== "object") return null;
  const p = params as Record<string, unknown>;
  const from = typeof p.from === "string" && isValidIsoDate(p.from) ? p.from : null;
  const to = typeof p.to === "string" && isValidIsoDate(p.to) ? p.to : null;
  if (!from || !to || from > to) return null;
  const site = p.siteId ?? null;
  if (site !== null && (typeof site !== "string" || !UUID_RE.test(site))) return null;
  return { from, to, siteId: site };
}

/** Despesas_internas[_<Obra>]_01-09-2026_a_30-09-2026.pdf */
export function expensesReportFileName(p: ExpenseReportParams, siteName: string | null): string {
  const d = (iso: string) => formatDateBR(iso).replace(/\//g, "-");
  const parts = ["Despesas_internas"];
  if (p.siteId && siteName) parts.push(fileSlug(siteName));
  return `${parts.join("_")}_${d(p.from)}_a_${d(p.to)}.pdf`;
}

export function expenseCsvFileName(todayIso: string): string {
  return csvFileName("Despesas internas", todayIso);
}
