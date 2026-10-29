/**
 * Datas de negócio. Instantes são guardados em UTC; datas (activity_date etc.)
 * são "YYYY-MM-DD" interpretadas no fuso da empresa. Fronteiras de mês nunca
 * presumem -03:00: o deslocamento é calculado pelo Intl (inclui horário de verão histórico).
 */

export const APP_TIMEZONE = "America/Sao_Paulo";

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

function partsInTz(date: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Deslocamento do fuso em ms (ex.: São Paulo = -3h). */
function tzOffsetMs(date: Date, tz: string): number {
  const p = partsInTz(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instante UTC correspondente a 00:00 do dia (y, m, d) no fuso informado. */
export function zonedMidnightUtc(year: number, month: number, day: number, tz: string = APP_TIMEZONE): Date {
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const first = guess - tzOffsetMs(new Date(guess), tz);
  const second = guess - tzOffsetMs(new Date(first), tz);
  return new Date(second);
}

/** Primeiro instante do mês seguinte (corte exclusivo): eventos com occurred_at < corte pertencem ao mês. */
export function monthCutoffUtc(year: number, month: number, tz: string = APP_TIMEZONE): Date {
  return month === 12 ? zonedMidnightUtc(year + 1, 1, 1, tz) : zonedMidnightUtc(year, month + 1, 1, tz);
}

export function monthRangeUtc(year: number, month: number, tz: string = APP_TIMEZONE): { start: Date; end: Date } {
  return { start: zonedMidnightUtc(year, month, 1, tz), end: monthCutoffUtc(year, month, tz) };
}

/** "YYYY-MM-DD" da data do instante no fuso. */
export function isoDateInTz(date: Date, tz: string = APP_TIMEZONE): string {
  const p = partsInTz(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function todayIso(now: Date = new Date()): string {
  return isoDateInTz(now);
}

/** "2026-09-03" → "03/09/2026". */
export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Instante → "24/10/2026 14:02" no fuso da empresa. */
export function formatDateTimeBR(value: string | Date | null | undefined, tz: string = APP_TIMEZONE): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const p = partsInTz(date, tz);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(p.day)}/${two(p.month)}/${p.year} ${two(p.hour)}:${two(p.minute)}`;
}

/** "25/10/2026" → "2026-10-25"; null se inválida. */
export function parseDateBR(input: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function isValidIsoDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  return parseDateBR(`${m[3]}/${m[2]}/${m[1]}`) !== null;
}

export function monthName(month: number): string {
  const name = MONTHS[month - 1];
  if (!name) throw new Error(`Mês inválido: ${month}`);
  return name;
}

/** "SETEMBRO / 2026" — título/cabeçalho do fechamento mensal. */
export function monthTitle(year: number, month: number): string {
  return `${monthName(month).toLocaleUpperCase("pt-BR")} / ${year}`;
}

/** "2026-09-01" → "terça-feira, 1 de setembro de 2026". */
export function longDatePt(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Data inválida: ${iso}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const weekday = WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  return `${weekday}, ${d} de ${monthName(mo)} de ${y}`;
}

export function addDaysIso(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Data inválida: ${iso}`);
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return date.toISOString().slice(0, 10);
}

/** Lista de datas ISO do mês (para planilhas e filtros). */
export function daysOfMonth(year: number, month: number): string[] {
  const days: string[] = [];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= last; d++) {
    days.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return days;
}
