import { formatDateBR } from "./dates";

/** B-37: abas da O.S. na administração (GPT p. 11), na ordem em que aparecem. */
export const REQUEST_TABS = [
  { key: "solicitacao", label: "Solicitação" },
  { key: "atendimentos", label: "Atendimentos" },
  { key: "fotos", label: "Fotos" },
  { key: "historico", label: "Histórico" },
] as const;

export type RequestTab = (typeof REQUEST_TABS)[number]["key"];

/** Aba pedida no endereço (?aba=); sem aba ou desconhecida, a Solicitação. */
export function parseRequestTab(value: string | undefined): RequestTab {
  return REQUEST_TABS.find((t) => t.key === value)?.key ?? "solicitacao";
}

type Entry = { id: string; activity_date: string; author_id: string };

/** Fotos da O.S. em grupos: a abertura e cada atendimento, na ordem dos registros. Grupo vazio não aparece. */
export function photoGroups<P>(opening: P[], entries: Entry[], entryPhotos: Map<string, P[]>, name: (id: string) => string) {
  const groups: Array<{ key: string; title: string; photos: P[] }> = [];
  if (opening.length > 0) groups.push({ key: "abertura", title: "Abertura do chamado", photos: opening });
  for (const e of entries) {
    const photos = entryPhotos.get(e.id) ?? [];
    if (photos.length > 0) groups.push({ key: e.id, title: `Atendimento de ${formatDateBR(e.activity_date)} · ${name(e.author_id)}`, photos });
  }
  return groups;
}
