import type { SupabaseClient } from "@supabase/supabase-js";
import { closingFileName } from "@/domain/report-naming";
import { closingBody, headerFromSnapshot } from "@/reports/templates/closing";
import { closingPhotoIds, computeClosing, type ClosingHeaderSnapshot, type ClosingPayload } from "@/server/closings";
import type { ServerDb } from "@/server/data";
import type { Database } from "@/server/db/database.types";
import { attachmentDataUri } from "../assets";
import { registerBuilder, type BuiltReport, type ReportJob } from "../builders";
import { registerFileName, type ReportNameInput } from "../file-names";

type Admin = SupabaseClient<Database>;
type Kind = "detalhado" | "resumo";

type DraftParams = { clientId: string; siteId: string | null; year: number; month: number; includeBilling: boolean };

function draftParams(raw: unknown): DraftParams {
  const p = (raw ?? {}) as Record<string, unknown>;
  const year = Number(p.year);
  const month = Number(p.month);
  if (typeof p.clientId !== "string" || !Number.isInteger(year) || !Number.isInteger(month)) throw new Error("Parâmetros do fechamento não encontrados.");
  return {
    clientId: p.clientId,
    siteId: typeof p.siteId === "string" && p.siteId ? p.siteId : null,
    year,
    month,
    includeBilling: p.includeBilling === true || p.includeBilling === "true",
  };
}

async function build(admin: Admin, job: ReportJob, kind: Kind): Promise<BuiltReport> {
  let payload: ClosingPayload;
  let header: ClosingHeaderSnapshot;
  let versionNo: number | null = null;
  let versionReason: string | null = null;
  let generatedAt = job.requested_at;
  let draft = false;

  if (job.source_id) {
    const { data: v } = await admin.from("closing_versions").select("*").eq("id", job.source_id).maybeSingle();
    if (!v) throw new Error("Versão do fechamento não encontrada.");
    payload = v.payload as unknown as ClosingPayload;
    header = v.header_snapshot as unknown as ClosingHeaderSnapshot;
    versionNo = v.version_no;
    versionReason = v.reason;
    generatedAt = v.generated_at;
  } else {
    const computed = await computeClosing(admin, draftParams(job.params));
    payload = computed.payload;
    header = computed.header;
    draft = true;
  }

  const reportHeader = headerFromSnapshot(
    header,
    await attachmentDataUri(admin, header.company.logoAttachmentId),
    await attachmentDataUri(admin, header.company.signatureAttachmentId),
  );
  const label = `Relatório ${payload.period.title}${versionNo ? ` · versão ${versionNo}` : draft ? " · prévia" : ""}`;
  return {
    title: `Relatório ${payload.client.displayName} ${payload.period.title}`,
    footerLabel: label,
    header: reportHeader,
    photoIds: kind === "detalhado" ? closingPhotoIds(payload) : [],
    body: (src) => closingBody(payload, header, reportHeader, { kind, versionNo, versionReason, generatedAt, draft }, src),
  };
}

/** Nome do arquivo: Relatorio_<Cliente>[_<Unidade>]_<Mês>_<Ano>[_Resumo][_vN].pdf (unidade só se o cliente tem várias). */
async function fileName(db: ServerDb, input: ReportNameInput, kind: Kind): Promise<string | null> {
  let clientId: string;
  let siteId: string | null;
  let year: number;
  let month: number;
  let version: number | undefined;
  if (input.sourceId) {
    const { data: v } = await db
      .from("closing_versions")
      .select("version_no, closing:monthly_closings!closing_versions_closing_id_fkey(client_id, site_id, period_year, period_month)")
      .eq("id", input.sourceId)
      .maybeSingle();
    if (!v || !v.closing) return null;
    clientId = v.closing.client_id;
    siteId = v.closing.site_id;
    year = v.closing.period_year;
    month = v.closing.period_month;
    version = v.version_no;
  } else {
    const p = draftParams(input.params);
    ({ clientId, siteId, year, month } = p);
  }
  const [{ data: client }, { data: sites }] = await Promise.all([
    db.from("clients").select("display_name").eq("id", clientId).maybeSingle(),
    db.from("sites").select("id, name").eq("client_id", clientId),
  ]);
  if (!client) return null;
  const unitName = siteId && (sites ?? []).length > 1 ? ((sites ?? []).find((s) => s.id === siteId)?.name ?? null) : null;
  const name = closingFileName({ clientName: client.display_name, unitName, year, month, kind, version });
  return input.sourceId ? name : name.replace(/\.pdf$/, "_Previa.pdf");
}

registerBuilder("fechamento_detalhado", (admin, job) => build(admin, job, "detalhado"));
registerBuilder("fechamento_resumo", (admin, job) => build(admin, job, "resumo"));
registerFileName("fechamento_detalhado", (db, input) => fileName(db, input, "detalhado"));
registerFileName("fechamento_resumo", (db, input) => fileName(db, input, "resumo"));
