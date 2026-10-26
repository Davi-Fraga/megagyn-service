import { FileDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTimeBR, monthTitle } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { issueClosingAction, registerDeliveryAction, revokeDeliveryAction } from "@/server/actions/closings";
import type { ClosingPayload } from "@/server/closings";
import { loadProfiles } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { cn } from "@/ui/cn";
import { ClosingView } from "@/ui/closing-view";
import { ActionForm, CheckboxField, SelectField, TextAreaField } from "@/ui/form";
import { Notice, PageHeader, Panel } from "@/ui/page";
import { ReasonAction } from "@/ui/reason-action";
import { GenerateReportButton } from "@/ui/report-button";
import { Badge } from "@/ui/status";
import { rowOrNotFound } from "@/server/query";

export const metadata: Metadata = { title: "Fechamento" };

export default async function ClosingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ versao?: string; feito?: string }>;
}) {
  const { id } = await params;
  const { versao, feito } = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const db = await createSupabaseServer();
  const closing = rowOrNotFound(await db
    .from("monthly_closings")
    .select("id, client_id, site_id, period_year, period_month, status, current_version_id, client:clients(display_name), site:sites(name)")
    .eq("id", id)
    .maybeSingle());

  const [{ data: versions }, profiles] = await Promise.all([
    db.from("closing_versions").select("id, version_no, generated_at, generated_by, reason, summary, criteria").eq("closing_id", id).order("version_no", { ascending: false }),
    loadProfiles(db),
  ]);
  const list = versions ?? [];
  const selectedId = versao && list.some((v) => v.id === versao) ? versao : (closing.current_version_id ?? list[0]?.id);
  const selected = list.find((v) => v.id === selectedId);
  const [{ data: full }, { data: artifacts }, { data: deliveries }] = await Promise.all([
    selected ? db.from("closing_versions").select("payload").eq("id", selected.id).single() : Promise.resolve({ data: null }),
    selected
      ? db.from("report_artifacts").select("id, kind, file_name, status, finished_at, page_count").eq("source_id", selected.id).order("requested_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    selected
      ? db.from("report_publications").select("*").eq("closing_version_id", selected.id).order("published_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const payload = (full?.payload ?? null) as unknown as ClosingPayload | null;
  const criteria = (selected?.criteria ?? {}) as { includeBilling?: boolean };

  return (
    <>
      <PageHeader
        back={{ href: "/admin/fechamentos", label: "Fechamento mensal" }}
        eyebrow={`${closing.client?.display_name} — ${closing.site?.name ?? "todas as unidades"}`}
        title={<span className="tipo-placa text-3xl">{monthTitle(closing.period_year, closing.period_month)}</span>}
        description={selected ? `Mostrando a versão ${selected.version_no}, emitida em ${formatDateTimeBR(selected.generated_at)} por ${profiles.name(selected.generated_by)}.` : "Nenhuma versão emitida."}
      />
      {feito === "emitida" && (
        <div className="mb-4">
          <Notice tone="ok">Versão emitida. O conteúdo desta versão não muda mais; correções geram uma nova versão.</Notice>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div>{payload ? <ClosingView payload={payload} /> : <Notice tone="info">Emita a primeira versão pela apuração.</Notice>}</div>

        <aside className="space-y-4">
          {selected && (
            <Panel title="Exportar PDF">
              <div className="space-y-3">
                <GenerateReportButton kind="fechamento_detalhado" sourceId={selected.id} label="Exportar PDF" icon={<FileDown aria-hidden className="size-4" />} variant="primary" />
                <GenerateReportButton kind="fechamento_resumo" sourceId={selected.id} label="Exportar resumo gerencial" icon={<FileDown aria-hidden className="size-4" />} />
                {(artifacts ?? []).filter((a) => a.status === "pronto").length > 0 && (
                  <div>
                    <p className="mb-1 text-sm font-semibold">Arquivos gerados</p>
                    <ul className="space-y-1 text-sm">
                      {(artifacts ?? [])
                        .filter((a) => a.status === "pronto")
                        .map((a) => (
                          <li key={a.id}>
                            <a href={`/api/reports/${a.id}/download`} className="text-info underline">
                              {a.file_name}
                            </a>{" "}
                            <span className="text-muted">
                              ({a.page_count ?? "?"} págs. · {formatDateTimeBR(a.finished_at)})
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </Panel>
          )}

          <Panel title="Versões">
            <ul className="space-y-2">
              {list.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/admin/fechamentos/${id}?versao=${v.id}`}
                    aria-current={v.id === selectedId ? "page" : undefined}
                    className={cn("block rounded-ctl border px-3 py-2", v.id === selectedId ? "border-grafite bg-concreto" : "border-linha hover:bg-concreto")}
                  >
                    <span className="flex items-center justify-between font-semibold">
                      Versão {v.version_no}
                      {v.id === closing.current_version_id && <Badge tone="ok">Atual</Badge>}
                    </span>
                    <span className="block text-sm text-muted">{formatDateTimeBR(v.generated_at)}</span>
                    {v.reason && <span className="block text-sm">Motivo: {v.reason}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          {selected && (
            <Panel title="Entrega ao cliente">
              <p className="mb-3 text-sm text-muted">
                O acesso do cliente ao sistema ainda está em decisão. Registre aqui como esta versão foi entregue (WhatsApp, e-mail, impresso).
              </p>
              <ActionForm action={registerDeliveryAction} submitLabel="Registrar entrega" resetOnSuccess>
                <input type="hidden" name="closing_version_id" value={selected.id} />
                <SelectField
                  label="Como foi entregue"
                  name="delivery_channel"
                  required
                  options={[
                    { value: "WhatsApp", label: "WhatsApp" },
                    { value: "E-mail", label: "E-mail" },
                    { value: "Impresso", label: "Impresso" },
                    { value: "Outro", label: "Outro" },
                  ]}
                />
                <TextAreaField label="Observação" name="delivery_note" rows={2} placeholder="Ex.: enviado à síndica em 01/10" />
              </ActionForm>
              {(deliveries ?? []).length > 0 && (
                <ul className="mt-4 space-y-2 text-sm">
                  {(deliveries ?? []).map((d) => (
                    <li key={d.id} className="rounded-ctl border border-linha p-2">
                      <p className={cn("font-semibold", d.revoked_at && "line-through")}>
                        {d.delivery_channel} · {formatDateTimeBR(d.published_at)} · {profiles.name(d.published_by)}
                      </p>
                      {d.delivery_note && <p>{d.delivery_note}</p>}
                      {d.revoked_at ? (
                        <p className="text-erro">Revogado: {d.revoke_reason}</p>
                      ) : (
                        <ReasonAction action={revokeDeliveryAction} hidden={{ publication_id: d.id }} label="Revogar" confirmLabel="Revogar registro" variant="ghost" />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          <Panel title="Corrigir">
            <p className="mb-3 text-sm text-muted">
              Corrija os registros de origem (atividades, chamados) e emita uma nova versão. As versões anteriores continuam disponíveis.
            </p>
            <ActionForm action={issueClosingAction} submitLabel="Emitir nova versão" pendingLabel="Emitindo…">
              <input type="hidden" name="client_id" value={closing.client_id} />
              {closing.site_id && <input type="hidden" name="site_id" value={closing.site_id} />}
              <input type="hidden" name="year" value={closing.period_year} />
              <input type="hidden" name="month" value={closing.period_month} />
              <CheckboxField label="Incluir demonstrativo de diárias" name="include_billing" defaultChecked={criteria.includeBilling ?? false} />
              <TextAreaField label="Motivo da nova versão" name="reason" required rows={2} />
            </ActionForm>
            <p className="mt-3 text-sm">
              <Link
                href={`/admin/fechamentos/apuracao?alvo=${closing.client_id}:${closing.site_id ?? "todas"}&mes=${closing.period_month}&ano=${closing.period_year}`}
                className="font-semibold text-info underline"
              >
                Ver prévia com os dados atuais
              </Link>
            </p>
          </Panel>
        </aside>
      </div>
    </>
  );
}
