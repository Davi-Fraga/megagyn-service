import { NextResponse } from "next/server";
import { UUID_RE } from "@/domain/ids";
import { createSupabaseServer } from "@/server/supabase/server";

export const runtime = "nodejs";

/** Situação de um PDF pedido (RLS: somente administração enxerga report_artifacts). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("report_artifacts")
    .select("id, status, file_name, error_message, page_count, size_bytes")
    .eq("id", id)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
