import { Camera, CheckCheck, PencilLine, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDateBR, todayIso } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { availableActions, isOverdue } from "@/domain/request-status";
import { requireProfile } from "@/server/auth";
import { addRequestPhotosAction, commentAction, resumeRequestAction, startRequestAction } from "@/server/actions/requests";
import { getRequestDetail, loadProfiles } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { ButtonLink } from "@/ui/button";
import { ActionForm, CheckboxField, TextAreaField } from "@/ui/form";
import { MediaUploader } from "@/ui/media-uploader";
import { Notice, PageHeader, Panel } from "@/ui/page";
import { PhotoGrid } from "@/ui/photo-grid";
import { RequestTimeline } from "@/ui/request-timeline";
import { AlertTape, StatusBadge } from "@/ui/status";

export const metadata: Metadata = { title: "Chamado" };

const DONE: Record<string, string> = {
  registro: "Registro salvo no chamado e no diário do dia.",
  pendencia: "Pendência registrada. A administração foi avisada.",
  executada: "Execução enviada. Agora a Megagyn confere e valida.",
  iniciado: "Serviço iniciado.",
  retomado: "Serviço retomado.",
};

export default async function FieldRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feito?: string }>;
}) {
  const profile = await requireProfile(["worker", "foreman", "admin"]);
  const { id } = await params;
  const { feito } = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const db = await createSupabaseServer();
  const [detail, profiles] = await Promise.all([getRequestDetail(db, id), loadProfiles(db)]);
  if (!detail) notFound();
  const r = detail.request;
  const actions = availableActions(r.status, profile.role === "admin" ? "worker" : profile.role);
  const pending = (r.current_pending ?? null) as Record<string, string> | null;
  const base = `/campo/chamados/${r.id}`;

  return (
    <>
      <PageHeader
        back={{ href: "/campo/chamados", label: "Chamados" }}
        eyebrow={<span className="tipo-placa text-lg text-laranja-escuro">{r.number}</span>}
        title={r.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={r.status} />
            {isOverdue(r.due_date, r.status, todayIso()) && <AlertTape>Prazo vencido</AlertTape>}
          </span>
        }
      />
      {feito && DONE[feito] && (
        <div className="mb-4">
          <Notice tone="ok">{DONE[feito]}</Notice>
        </div>
      )}

      <section className="mb-5 space-y-3">
        {(actions.includes("registrar_atividade") || actions.includes("informar_execucao")) && (
          <ButtonLink href={`${base}/registrar`} size="lg" icon={<PencilLine aria-hidden className="size-6" />}>
            Registrar o que foi feito
          </ButtonLink>
        )}
        <div className="grid grid-cols-2 gap-3">
          {actions.includes("informar_execucao") && (
            <ButtonLink href={`${base}/concluir`} variant="dark" className="min-h-14" icon={<CheckCheck aria-hidden className="size-5" />}>
              Concluí
            </ButtonLink>
          )}
          {actions.includes("informar_pendencia") && (
            <ButtonLink href={`${base}/pendencia`} variant="secondary" className="min-h-14" icon={<TriangleAlert aria-hidden className="size-5" />}>
              Não consegui concluir
            </ButtonLink>
          )}
        </div>
        {actions.includes("iniciar") && (
          <ActionForm action={startRequestAction} submitLabel="Iniciar serviço" submitVariant="secondary" submitSize="lg">
            <input type="hidden" name="request_id" value={r.id} />
          </ActionForm>
        )}
        {actions.includes("retomar") && (
          <ActionForm action={resumeRequestAction} submitLabel="Retomar serviço" submitSize="lg">
            <input type="hidden" name="request_id" value={r.id} />
          </ActionForm>
        )}
        {r.status === "executada" && <Notice tone="info">Execução informada. Aguardando a validação da Megagyn.</Notice>}
        {r.status === "aberta" && <Notice tone="info">Aguardando a triagem da administração.</Notice>}
      </section>

      {r.status === "pendente" && pending && (
        <section className="mb-5 overflow-hidden rounded-panel border border-alerta bg-papel">
          <div aria-hidden className="faixa-alerta h-2" />
          <div className="space-y-1 p-4">
            <h2 className="font-bold">Pendente: {pending.pending_reason}</h2>
            <p>{pending.explanation}</p>
            <p className="text-sm">
              Providência: {pending.next_action} — {pending.next_action_owner_name}. Previsão: {formatDateBR(pending.expected_return_date)}
            </p>
          </div>
        </section>
      )}

      <div className="space-y-5">
        <Panel title="Pedido">
          <p className="mb-1 text-sm text-muted">
            {r.site?.name}
            {r.area ? ` · ${r.area.name}` : ""} · programado {formatDateBR(r.scheduled_date)}
            {r.due_date ? ` · prazo ${formatDateBR(r.due_date)}` : ""}
          </p>
          <p className="whitespace-pre-line">{r.description}</p>
          <div className="mt-3">
            <PhotoGrid photos={detail.requestPhotos} emptyText="Sem fotos da situação inicial." />
          </div>
        </Panel>

        {!["concluida", "cancelada", "aberta"].includes(r.status) && (
          <details className="rounded-panel border border-linha bg-papel">
            <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 font-bold">
              <Camera aria-hidden className="size-5" /> Adicionar fotos ao chamado
            </summary>
            <div className="border-t border-linha p-4">
              <ActionForm action={addRequestPhotosAction} submitLabel="Salvar fotos" resetOnSuccess>
                <input type="hidden" name="request_id" value={r.id} />
                <MediaUploader name="photo_ids" label="Fotos" required siteId={r.site_id} />
              </ActionForm>
            </div>
          </details>
        )}

        <Panel title="Histórico">
          <RequestTimeline detail={detail} name={profiles.name} showInternal />
        </Panel>

        <Panel title="Comentário">
          <ActionForm action={commentAction} submitLabel="Enviar comentário" resetOnSuccess successMessage="Comentário registrado.">
            <input type="hidden" name="request_id" value={r.id} />
            <TextAreaField label="Mensagem para a equipe" name="body" required rows={3} />
            <CheckboxField label="Nota interna" name="is_internal" hint="Nunca entra em relatório para o cliente." defaultChecked />
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
