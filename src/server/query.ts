import { notFound } from "next/navigation";

type QueryResult = { data: unknown; error: { message: string; code?: string } | null };

/**
 * Erro de consulta nunca pode ser lido como "não encontrado": esconderia defeito
 * (ex.: embed ambíguo deixou a tela de tarefa do campo em 404 para todos).
 * O erro sobe para o error.tsx e para o log do servidor.
 */
export function orThrow<R extends QueryResult>(res: R): R["data"] {
  if (res.error) {
    throw new Error(`Falha na consulta${res.error.code ? ` (${res.error.code})` : ""}: ${res.error.message}`);
  }
  return res.data;
}

/** Linha única: erro de consulta é lançado; ausência (inclusive por RLS) vira 404. */
export function rowOrNotFound<R extends QueryResult>(res: R): NonNullable<R["data"]> {
  const row = orThrow(res);
  if (row === null || row === undefined) notFound();
  return row as NonNullable<R["data"]>;
}
