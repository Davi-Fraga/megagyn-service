import { formatDateBR, monthName } from "./dates";

/** Texto seguro para nome de arquivo: sem acentos, só letras/números e "_". */
export function fileSlug(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "Sem_nome";
}

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1);
}

export type ClosingFileNameInput = {
  clientName: string;
  unitName?: string | null;
  year: number;
  month: number;
  kind?: "detalhado" | "resumo";
  version?: number;
};

/** Relatorio_<Cliente>[_<Unidade>]_<Mês>_<Ano>[_Resumo][_vN].pdf — ex.: Relatorio_Park_dos_Alpes_Setembro_2026.pdf */
export function closingFileName(input: ClosingFileNameInput): string {
  const parts = ["Relatorio", fileSlug(input.clientName)];
  if (input.unitName) parts.push(fileSlug(input.unitName));
  parts.push(fileSlug(capitalize(monthName(input.month))), String(input.year));
  if (input.kind === "resumo") parts.push("Resumo");
  if (input.version && input.version > 1) parts.push(`v${input.version}`);
  return `${parts.join("_")}.pdf`;
}

export function serviceOrderFileName(number: string): string {
  return `OS_${number.replace(/[^A-Za-z0-9-]/g, "")}.pdf`;
}

export function quoteFileName(number: string, clientName: string): string {
  return `Orcamento_${number.replace(/[^A-Za-z0-9-]/g, "")}_${fileSlug(clientName)}.pdf`;
}

export function dailyLogFileName(siteName: string, fromIso: string, toIso: string): string {
  const d = (iso: string) => formatDateBR(iso).replace(/\//g, "-");
  return `Diario_${fileSlug(siteName)}_${d(fromIso)}_a_${d(toIso)}.pdf`;
}

export function csvFileName(base: string, isoDate: string): string {
  return `${fileSlug(base)}_${formatDateBR(isoDate).replace(/\//g, "-")}.csv`;
}
