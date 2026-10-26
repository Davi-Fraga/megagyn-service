// Construtor de PDF e nome de arquivo do orçamento (kind "orcamento", sourceId = id do orçamento).
// Enviado/aprovado/etc.: imprime a última versão congelada (quote_versions). Rascunho: dados atuais + aviso.
import { currentQuoteSnapshot, loadQuoteBundle } from "@/app/admin/orcamentos/data";
import { formatDateBR, todayIso } from "@/domain/dates";
import type { QuoteStatus } from "@/domain/quote";
import { effectiveQuoteStatus } from "@/domain/quote-rules";
import type { QuoteSnapshot } from "@/domain/quote-snapshot";
import { quoteFileName } from "@/domain/report-naming";
import type { ServerDb } from "@/server/data";
import { quoteBody } from "@/reports/templates/quote";
import { loadReportHeader } from "../assets";
import { registerBuilder, type BuiltReport, type ReportJob } from "../builders";
import { registerFileName } from "../file-names";

function isCompleteSnapshot(s: unknown): s is QuoteSnapshot {
  const v = s as Partial<QuoteSnapshot> | null;
  return !!v && v.schema === 1 && !!v.client && Array.isArray(v.items) && !!v.company && !!v.photos && typeof v.number === "string";
}

const STATUS_NOTICE: Partial<Record<QuoteStatus, string>> = {
  rascunho: "RASCUNHO — documento para conferência interna, ainda não enviado ao cliente.",
  cancelado: "ORÇAMENTO CANCELADO — sem validade como proposta.",
  rejeitado: "PROPOSTA RECUSADA PELO CLIENTE.",
};

async function buildQuote(admin: ServerDb, job: ReportJob): Promise<BuiltReport> {
  const bundle = await loadQuoteBundle(admin, job.source_id!);
  if (!bundle) throw new Error("Orçamento não encontrado para o PDF.");
  const q = bundle.quote;

  let snapshot: QuoteSnapshot | null = null;
  let versionNo: number | null = null;
  if (q.status !== "rascunho" && q.current_version_no > 0) {
    const { data: v } = await admin
      .from("quote_versions")
      .select("version_no, snapshot")
      .eq("quote_id", q.id)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (v && isCompleteSnapshot(v.snapshot)) {
      snapshot = v.snapshot;
      versionNo = v.version_no;
    }
  }
  snapshot ??= await currentQuoteSnapshot(admin, bundle);

  // Foto removida (revogada) depois da versão não volta a ser impressa.
  const wanted = [...snapshot.photos.local, ...snapshot.photos.referencia].map((p) => p.id);
  const { data: alive } = wanted.length
    ? await admin.from("attachments").select("id").in("id", wanted).is("revoked_at", null)
    : { data: [] as Array<{ id: string }> };
  const aliveIds = new Set((alive ?? []).map((a) => a.id));
  const photos = {
    local: snapshot.photos.local.filter((p) => aliveIds.has(p.id)),
    referencia: snapshot.photos.referencia.filter((p) => aliveIds.has(p.id)),
  };

  const status = effectiveQuoteStatus(q.status, q.valid_until, todayIso());
  const notice =
    STATUS_NOTICE[status] ?? (status === "expirado" && q.valid_until ? `VALIDADE VENCIDA EM ${formatDateBR(q.valid_until)}.` : null);
  // Dados da empresa congelados na versão; logo e assinatura vêm das Configurações atuais.
  const header = { ...(await loadReportHeader(admin)), ...snapshot.company };
  const doc = { ...snapshot, photos };

  return {
    title: `Orçamento ${q.number}`,
    footerLabel: `Orçamento ${q.number}${versionNo && versionNo > 1 ? ` · versão ${versionNo}` : ""}`,
    photoIds: [...photos.local, ...photos.referencia].map((p) => p.id),
    header: snapshot.company,
    body: (src) => quoteBody({ snapshot: doc, header, notice }, src),
  };
}

registerBuilder("orcamento", buildQuote);

registerFileName("orcamento", async (db, input) => {
  if (!input.sourceId) return null;
  const { data } = await db.from("quotes").select("number, client:clients(display_name)").eq("id", input.sourceId).maybeSingle();
  return data ? quoteFileName(data.number, data.client?.display_name ?? "Cliente") : null;
});
