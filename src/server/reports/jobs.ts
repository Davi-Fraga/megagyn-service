import { documentShell, footerTemplate, headerTemplate } from "@/reports/layout";
import { errorInfo, log } from "@/server/log";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { loadImageAssets, loadReportHeader } from "./assets";
import { buildReport, type ReportJob } from "./builders";
import "./register-builders";
import { countPdfPages, renderPdf } from "./render";

/**
 * Processa um PDF da fila (report_artifacts). Chamado logo após o pedido (next/server `after`)
 * e também pelo worker (`npm run worker`), que retoma pedidos pendentes ou interrompidos.
 * A atualização condicional de status impede que dois processos gerem o mesmo arquivo.
 */
export async function processReport(artifactId: string): Promise<"pronto" | "falhou" | "ignorado"> {
  const admin = createSupabaseAdmin();
  const { data: current } = await admin.from("report_artifacts").select("*").eq("id", artifactId).maybeSingle();
  if (!current || current.status === "pronto") return "ignorado";
  if (current.status === "processando" && current.started_at && Date.now() - new Date(current.started_at).getTime() < 10 * 60_000) {
    return "ignorado";
  }

  const { data: claimed } = await admin
    .from("report_artifacts")
    .update({ status: "processando", started_at: new Date().toISOString(), attempts: current.attempts + 1, error_message: null })
    .eq("id", artifactId)
    .eq("status", current.status)
    .select("*")
    .maybeSingle();
  if (!claimed) return "ignorado";

  const started = Date.now();
  try {
    const job: ReportJob = claimed;
    const built = await buildReport(admin, job);
    const header = { ...(await loadReportHeader(admin)), ...(built.header ?? {}) };
    const images = await loadImageAssets(admin, built.photoIds);
    const pdf = await renderPdf({
      html: documentShell(built.title, built.body(images.src)),
      assets: images.assets,
      headerHtml: headerTemplate(header),
      footerHtml: footerTemplate(header, built.footerLabel),
    });
    const d = new Date();
    const key = `${claimed.kind}/${d.getUTCFullYear()}/${claimed.id}.pdf`;
    const { error: upErr } = await admin.storage.from("reports").upload(key, pdf, { contentType: "application/pdf", upsert: true });
    if (upErr) throw upErr;
    await admin
      .from("report_artifacts")
      .update({
        status: "pronto",
        storage_key: key,
        size_bytes: pdf.length,
        page_count: countPdfPages(pdf),
        finished_at: new Date().toISOString(),
      })
      .eq("id", claimed.id);
    log.info("report.ready", { id: claimed.id, kind: claimed.kind, ms: Date.now() - started, bytes: pdf.length });
    return "pronto";
  } catch (error) {
    log.error("report.fail", { id: claimed.id, kind: claimed.kind, ...errorInfo(error) });
    const message = error instanceof Error && /não encontrado|não disponível|GOTENBERG/i.test(error.message) ? error.message : null;
    await admin
      .from("report_artifacts")
      .update({
        status: "falhou",
        finished_at: new Date().toISOString(),
        error_message: message ?? "Falha ao gerar o PDF. Tente novamente; se persistir, avise o suporte.",
      })
      .eq("id", claimed.id);
    return "falhou";
  }
}
