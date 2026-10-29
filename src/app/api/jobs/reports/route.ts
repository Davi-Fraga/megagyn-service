import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { errorInfo, log } from "@/server/log";
import { runQueueTick } from "@/server/reports/queue";
import { createSupabaseAdmin } from "@/server/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Um PDF longo leva ~10 s; com o Gotenberg acordando, perto de 1 min.
export const maxDuration = 300;

/** Compara sem revelar, pelo tempo de resposta, em que posição o segredo difere. */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

/**
 * Uma passada da fila de PDFs, para agendadores externos (cron da Vercel envia
 * `Authorization: Bearer <CRON_SECRET>`). Substitui o worker onde não há processo contínuo.
 */
async function handle(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const raw = Number(new URL(request.url).searchParams.get("limit") ?? "3");
  const limit = Number.isFinite(raw) ? Math.max(0, Math.min(raw, 10)) : 3;
  try {
    const { processed } = await runQueueTick(createSupabaseAdmin(), { limit });
    log.info("jobs.reports", { processed: processed.length });
    return NextResponse.json({ ok: true, processed }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    log.error("jobs.reports_fail", errorInfo(error));
    return NextResponse.json({ ok: false, error: "Falha ao processar a fila." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
