"use server";

import { after } from "next/server";
import { UUID_RE } from "@/domain/ids";
import { serviceOrderFileName } from "@/domain/report-naming";
import { requireProfile } from "@/server/auth";
import { errorInfo, log } from "@/server/log";
import type { ReportKind } from "@/server/reports/builders";
import { createSupabaseServer } from "@/server/supabase/server";

export type ReportRequest = { kind: ReportKind; sourceId?: string | null; params?: Record<string, string | number | boolean | null> };
export type ReportRequestResult = { ok: true; artifactId: string } | { ok: false; message: string };

/**
 * Construtores e fila são carregados sob demanda: este módulo é referenciado por componentes
 * de tela, e importá-los estaticamente criaria ciclos (construtor → página → botão → esta ação).
 */
async function reportModules() {
  await import("@/server/reports/register-builders");
  const [{ reportFileName }, { processReport }] = await Promise.all([import("@/server/reports/file-names"), import("@/server/reports/jobs")]);
  return { reportFileName, processReport };
}

const SOURCE_TYPE: Record<ReportKind, string> = {
  os_individual: "service_request",
  fechamento_detalhado: "closing_version",
  fechamento_resumo: "closing_version",
  diario: "site",
  atividades_pessoa: "profile",
  despesas_internas: "period",
  orcamento: "quote",
};

/** Enfileira um PDF e começa a gerá-lo após a resposta (sem travar a tela). */
export async function requestReport(input: ReportRequest): Promise<ReportRequestResult> {
  const profile = await requireProfile(["admin"]);
  if (!Object.hasOwn(SOURCE_TYPE, input.kind)) return { ok: false, message: "Tipo de relatório inválido." };
  if (input.sourceId && !UUID_RE.test(input.sourceId)) return { ok: false, message: "Documento inválido." };
  const db = await createSupabaseServer();
  const { reportFileName, processReport } = await reportModules();

  let fileName: string | null;
  try {
    fileName =
      input.kind === "os_individual" && input.sourceId
        ? await db
            .from("service_requests")
            .select("number")
            .eq("id", input.sourceId)
            .maybeSingle()
            .then(({ data }) => (data ? serviceOrderFileName(data.number) : null))
        : await reportFileName(db, input);
  } catch (error) {
    log.error("report.name_fail", errorInfo(error));
    fileName = null;
  }
  if (!fileName) return { ok: false, message: "Documento não encontrado." };

  const { data, error } = await db
    .from("report_artifacts")
    .insert({
      kind: input.kind,
      source_type: SOURCE_TYPE[input.kind],
      source_id: input.sourceId ?? null,
      params: input.params ?? {},
      file_name: fileName,
      requested_by: profile.id,
      audience: input.kind.startsWith("fechamento") || input.kind === "orcamento" ? "cliente" : "interno",
    })
    .select("id")
    .single();
  if (error || !data) {
    log.error("report.enqueue_fail", errorInfo(error));
    return { ok: false, message: "Não foi possível pedir o PDF. Tente novamente." };
  }
  after(() => processReport(data.id));
  return { ok: true, artifactId: data.id };
}

export async function retryReport(artifactId: string): Promise<ReportRequestResult> {
  await requireProfile(["admin"]);
  if (!UUID_RE.test(artifactId)) return { ok: false, message: "Relatório inválido." };
  const db = await createSupabaseServer();
  const { data } = await db.from("report_artifacts").select("id, status").eq("id", artifactId).maybeSingle();
  if (!data) return { ok: false, message: "Relatório não encontrado." };
  if (data.status === "falhou") {
    const { processReport } = await reportModules();
    after(() => processReport(data.id));
  }
  return { ok: true, artifactId: data.id };
}
