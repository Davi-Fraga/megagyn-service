import { addDaysIso, isValidIsoDate } from "./dates";
import { UUID_RE } from "./ids";

export type ActivityFilters = { siteId: string | null; from: string; to: string };

/** Filtros de "Minhas atividades" vindos da URL. Valor inválido volta para o padrão: últimos 30 dias. */
export function parseActivityFilters(params: { local?: string; de?: string; ate?: string }, today: string): ActivityFilters {
  const siteId = params.local && UUID_RE.test(params.local) ? params.local : null;
  const from = params.de && isValidIsoDate(params.de) ? params.de : addDaysIso(today, -30);
  const to = params.ate && isValidIsoDate(params.ate) ? params.ate : today;
  return from <= to ? { siteId, from, to } : { siteId, from: to, to: from };
}
