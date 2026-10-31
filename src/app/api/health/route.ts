import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { gotenbergAuthHeaders } from "@/server/reports/gotenberg-auth";
import { createSupabaseAdmin } from "@/server/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Saúde do app para monitoramento e para o "despertador" da hospedagem gratuita:
 * toca o banco (evita a pausa do Supabase por inatividade) e o serviço de PDF (acorda
 * o Gotenberg). Não expõe endereços nem chaves.
 */
export async function GET() {
  const { error } = await createSupabaseAdmin().from("company_settings").select("id").eq("id", 1).maybeSingle();
  const db = !error;

  let rendererUp: boolean | null = null;
  if (env.pdfRenderer === "gotenberg" && env.gotenbergUrl) {
    try {
      const res = await fetch(`${env.gotenbergUrl.replace(/\/$/, "")}/health`, {
        signal: AbortSignal.timeout(3_000),
        cache: "no-store",
        headers: gotenbergAuthHeaders(env.gotenbergUser, env.gotenbergPassword),
      });
      rendererUp = res.ok;
    } catch {
      // Dormindo ou acordando: o próprio pedido já dispara a subida.
      rendererUp = false;
    }
  }

  return NextResponse.json(
    { ok: db, db, renderer: env.pdfRenderer, rendererUp, time: new Date().toISOString() },
    { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
