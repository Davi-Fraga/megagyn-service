import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/database.types";
import { processReport } from "./jobs";

type Admin = SupabaseClient<Database>;
type Result = Awaited<ReturnType<typeof processReport>>;

export type QueueTickOptions = {
  /** Máximo de PDFs por passada (cada um leva alguns segundos). */
  limit?: number;
  /** Processador (injetável nos testes). */
  process?: (id: string) => Promise<Result>;
  /** Interrompe entre um PDF e outro (desligamento do worker). */
  shouldStop?: () => boolean;
  /** Restringe a pedidos cujo `params` contenha estes campos (usado nos testes). */
  onlyParams?: Record<string, unknown>;
};

/** Pedidos de PDF que ficaram para trás: na fila, com falha e tentativas restantes, ou travados em "processando". */
export const STALE_AFTER_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 3;

/**
 * Uma passada da fila de PDFs. Usada pelo worker (`npm run worker`) e pela rota
 * `/api/jobs/reports` (cron em hospedagem sem processo contínuo). O app já gera cada
 * PDF logo após o pedido; isto só retoma o que ficou pendente.
 */
export async function runQueueTick(admin: Admin, options: QueueTickOptions = {}) {
  const limit = Math.max(0, Math.min(options.limit ?? 5, 20));
  const process = options.process ?? processReport;
  const processed: Array<{ id: string; result: Result }> = [];
  if (limit === 0) return { processed };

  const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  let query = admin
    .from("report_artifacts")
    .select("id")
    .or(`status.eq.na_fila,and(status.eq.falhou,attempts.lt.${MAX_ATTEMPTS}),and(status.eq.processando,started_at.lt.${staleBefore})`)
    .order("requested_at")
    .limit(limit);
  if (options.onlyParams) query = query.contains("params", options.onlyParams);
  const { data, error } = await query;
  if (error) throw new Error(`Falha ao ler a fila de PDFs: ${error.message}`);

  for (const job of data ?? []) {
    if (options.shouldStop?.()) break;
    processed.push({ id: job.id, result: await process(job.id) });
  }
  return { processed };
}
