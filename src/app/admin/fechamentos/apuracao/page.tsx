import { FileDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { UUID_RE } from "@/domain/ids";
import { issueClosingAction } from "@/server/actions/closings";
import { computeClosing } from "@/server/closings";
import { createSupabaseServer } from "@/server/supabase/server";
import { ClosingView } from "@/ui/closing-view";
import { ActionForm, TextAreaField } from "@/ui/form";
import { Notice, PageHeader, Panel } from "@/ui/page";
import { GenerateReportButton } from "@/ui/report-button";

// Esta página pede PDFs; a geração roda após a resposta e precisa caber no tempo da função (Vercel Hobby: até 300 s).
export const maxDuration = 300;

export const metadata: Metadata = { title: "Apuração do fechamento" };

export default async function ClosingPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ alvo?: string; mes?: string; ano?: string; diarias?: string }>;
}) {
  const sp = await searchParams;
  const [clientId, siteRaw] = (sp.alvo ?? "").split(":");
  const siteId = siteRaw && siteRaw !== "todas" && UUID_RE.test(siteRaw) ? siteRaw : null;
  const month = Number(sp.mes);
  const year = Number(sp.ano);
  const includeBilling = sp.diarias === "1";
  if (!clientId || !UUID_RE.test(clientId) || !(month >= 1 && month <= 12) || !(year >= 2020 && year <= 2100)) {
    return (
      <>
        <PageHeader back={{ href: "/admin/fechamentos", label: "Fechamento mensal" }} title="Apuração" />
        <Notice tone="erro">Escolha cliente, mês e ano para apurar.</Notice>
      </>
    );
  }

  const db = await createSupabaseServer();
  const { payload } = await computeClosing(db, { clientId, siteId, year, month, includeBilling });
  let existing = db.from("monthly_closings").select("id, current_version_id").eq("client_id", clientId).eq("period_year", year).eq("period_month", month);
  existing = siteId ? existing.eq("site_id", siteId) : existing.is("site_id", null);
  const { data: closing } = await existing.maybeSingle();
  const { data: rules } = await db.from("billing_rules").select("id").eq("client_id", clientId).limit(1);
  const params = { clientId, siteId, year, month, includeBilling };
  const query = `alvo=${clientId}:${siteId ?? "todas"}&mes=${month}&ano=${year}`;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/fechamentos", label: "Fechamento mensal" }}
        eyebrow={`${payload.client.displayName}, ${siteId ? payload.sites[0]?.name : "todas as unidades"}`}
        title={<span className="tipo-placa text-3xl">{payload.period.title}</span>}
        description="Prévia calculada agora. Ao emitir, o conteúdo fica congelado nesta versão."
      />

      <div className="grid grid-cols-1 gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ClosingView payload={payload} />
        <aside className="space-y-10 lg:sticky lg:top-6 lg:self-start">
          <Panel title="Demonstrativo">
            {(rules ?? []).length === 0 ? (
              <p className="text-sm text-muted">Este cliente não tem regra de valor de diária/hora. Cadastre em Horas e diárias para incluir o demonstrativo.</p>
            ) : (
              <Link href={`/admin/fechamentos/apuracao?${query}${includeBilling ? "" : "&diarias=1"}`} className="font-semibold text-info underline">
                {includeBilling ? "Remover demonstrativo de diárias" : "Incluir demonstrativo de diárias"}
              </Link>
            )}
          </Panel>
          <Panel title="Exportar PDF (prévia)">
            <div className="space-y-2">
              <GenerateReportButton kind="fechamento_detalhado" params={params} label="Exportar PDF detalhado" icon={<FileDown aria-hidden className="size-4" />} />
              <GenerateReportButton kind="fechamento_resumo" params={params} label="Exportar PDF resumo" icon={<FileDown aria-hidden className="size-4" />} />
              <p className="text-sm text-muted">A prévia sai marcada como “PRÉVIA”. Emita a versão para gerar o relatório oficial.</p>
            </div>
          </Panel>
          <Panel title={closing?.current_version_id ? "Emitir nova versão" : "Emitir fechamento"}>
            <ActionForm
              action={issueClosingAction}
              submitLabel={closing?.current_version_id ? "Emitir nova versão" : "Fechar mês e emitir versão 1"}
              pendingLabel="Emitindo…"
            >
              <input type="hidden" name="client_id" value={clientId} />
              {siteId && <input type="hidden" name="site_id" value={siteId} />}
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="month" value={month} />
              {includeBilling && <input type="hidden" name="include_billing" value="on" />}
              {closing?.current_version_id ? (
                <>
                  <Notice tone="alerta">Já existe versão emitida. A nova versão não apaga a anterior.</Notice>
                  <TextAreaField label="Motivo da nova versão" name="reason" required rows={2} />
                </>
              ) : (
                <p className="text-sm text-muted">Confira a prévia ao lado antes de emitir.</p>
              )}
            </ActionForm>
            {closing && (
              <p className="mt-3 text-sm">
                <Link href={`/admin/fechamentos/${closing.id}`} className="font-semibold text-info underline">
                  Ver versões emitidas
                </Link>
              </p>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}
