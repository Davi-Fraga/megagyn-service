import { NextResponse } from "next/server";
import { planFileResponse } from "@/domain/file-serving";
import { UUID_RE } from "@/domain/ids";
import { errorInfo, log } from "@/server/log";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { createSupabaseServer } from "@/server/supabase/server";

export const runtime = "nodejs";

/**
 * Entrega um anexo. A permissão é decidida pela RLS: se a linha não aparece para
 * a sessão do usuário, o arquivo não existe para ele (404, sem distinguir de inexistente).
 * Os bytes passam pelo servidor; o Storage nunca é exposto ao navegador.
 */
/** Todo 404 sai sem cache: "não visível" e "não existe" não se distinguem, nem no cabeçalho. */
function notFound() {
  return new NextResponse("Não encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return notFound();

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Sessão expirada", { status: 401 });

  const { data: att } = await supabase
    .from("attachments")
    .select("bucket, storage_key, derivatives, mime_type, original_name, revoked_at")
    .eq("id", id)
    .maybeSingle();
  // A RLS já esconde a foto removida de quem não é da administração: ela cai aqui.
  if (!att) return notFound();

  const { data: role } = await supabase.rpc("current_app_role");
  // Segunda barreira, caso a política mude: foto removida segue fora do alcance de quem não é admin.
  if (att.revoked_at && role !== "admin") return notFound();
  const plan = planFileResponse({
    mime: att.mime_type,
    storageKey: att.storage_key,
    derivatives: (att.derivatives ?? {}) as Record<string, string>,
    variant: new URL(request.url).searchParams.get("v"),
    isAdmin: role === "admin",
  });
  if (!plan) return notFound();

  const { data, error } = await createSupabaseAdmin().storage.from(att.bucket).download(plan.key);
  if (error || !data) {
    log.error("file.download_fail", { id, ...errorInfo(error) });
    return new NextResponse("Arquivo indisponível", { status: 502 });
  }
  const name = encodeURIComponent(att.original_name ?? `arquivo-${id}`);
  const headers: Record<string, string> = {
    "Content-Type": plan.contentType,
    "Content-Length": String(data.size),
    "Cache-Control": "private, max-age=3600",
    "Content-Disposition": `${plan.disposition}; filename*=UTF-8''${name}`,
    "X-Content-Type-Options": "nosniff",
  };
  if (plan.csp) headers["Content-Security-Policy"] = plan.csp;
  return new NextResponse(data.stream(), { headers });
}
