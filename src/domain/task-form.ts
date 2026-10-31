import { UUID_RE } from "./ids";

export type TaskOccurrenceInput = { site_id: string; scheduled_date: string | null; site_area_id?: string };

/**
 * Ocorrências de uma tarefa nova. `areaChoice` vem no formato `<siteId>:<areaId>`, porque a
 * tarefa pode ter vários locais e o setor pertence a um só. O banco não confere esse vínculo.
 */
export function buildOccurrences(
  siteIds: string[],
  date: string | null,
  areaChoice: string | null,
): { occurrences: TaskOccurrenceInput[]; error?: string } {
  const occurrences: TaskOccurrenceInput[] = siteIds.map((site_id) => ({ site_id, scheduled_date: date }));
  if (!areaChoice) return { occurrences };
  const [siteId, areaId] = areaChoice.split(":");
  if (!siteId || !areaId || !UUID_RE.test(siteId) || !UUID_RE.test(areaId)) return { occurrences, error: "Escolha um setor da lista." };
  const target = occurrences.find((o) => o.site_id === siteId);
  if (!target) return { occurrences, error: "Esse setor é de um local que não foi marcado." };
  target.site_area_id = areaId;
  return { occurrences };
}
