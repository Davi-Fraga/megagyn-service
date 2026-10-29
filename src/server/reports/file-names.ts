import type { ServerDb } from "@/server/data";
import type { ReportKind } from "./builders";

export type ReportNameInput = { kind: ReportKind; sourceId?: string | null; params?: Record<string, string | number | boolean | null> };
type Namer = (db: ServerDb, input: ReportNameInput) => Promise<string | null>;

const NAMERS: Partial<Record<ReportKind, Namer>> = {};

/** Cada módulo registra como nomear o arquivo do seu relatório (ex.: Relatorio_Park_dos_Alpes_Setembro_2026.pdf). */
export function registerFileName(kind: ReportKind, namer: Namer) {
  NAMERS[kind] = namer;
}

/** Nome sugerido para download. A consulta usa a sessão do admin (RLS), validando que o documento existe. */
export async function reportFileName(db: ServerDb, input: ReportNameInput): Promise<string | null> {
  const namer = NAMERS[input.kind];
  return namer ? namer(db, input) : null;
}
