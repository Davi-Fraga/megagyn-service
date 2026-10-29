import { NextResponse } from "next/server";
import { UUID_RE } from "@/domain/ids";
import { errorInfo, log } from "@/server/log";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { createSupabaseServer } from "@/server/supabase/server";

export const runtime = "nodejs";

/** Baixa o PDF com o nome sugerido (ex.: Relatorio_Park_dos_Alpes_Setembro_2026.pdf). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return new NextResponse("Não encontrado", { status: 404 });
  const supabase = await createSupabaseServer();
  const { data } = await supabase.from("report_artifacts").select("status, storage_key, file_name").eq("id", id).maybeSingle();
  if (!data || data.status !== "pronto" || !data.storage_key) return new NextResponse("Relatório indisponível", { status: 404 });

  const { data: blob, error } = await createSupabaseAdmin().storage.from("reports").download(data.storage_key);
  if (error || !blob) {
    log.error("report.download_fail", { id, ...errorInfo(error) });
    return new NextResponse("Arquivo indisponível", { status: 502 });
  }
  const inline = new URL(request.url).searchParams.get("ver") === "1";
  const ascii = data.file_name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new NextResponse(blob.stream(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(blob.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(data.file_name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
