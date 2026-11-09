import { Camera, CheckCheck, PencilLine, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDateBR, todayIso } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { availableActions, isOverdue } from "@/domain/request-status";
import { rulerStageDates } from "@/domain/status-ruler";
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
import { AlertTape } from "@/ui/status";
import { StatusRuler } from "@/ui/status-ruler";

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
        eyebrow={<span className="tipo-placa text-2xl text-grafite">{r.number}</span>}
        title={r.title}
        description={isOverdue(r.due_date, r.status, todayIso()) && <AlertTape>Prazo vencido</AlertTape>}
      />
      <div className="mb-8">
        <StatusRuler status={r.status} dates={rulerStageDates(detail.events)} />
      </div>
      {feito && DONE[feito] && (
        <div className="mb-4">
          <Notice tone="ok">{DONE[feito]}</Notice>
        </div>
      )}

      <section className="mb-8 space-y-3">
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
        <section className="mb-8 border-l-[3px] border-alerta pl-4">
          <h2 className="text-[1.3125rem] text-alerta">Pendente: {pending.pending_reason}</h2>
          <p className="mt-1">{pending.explanation}</p>
          <p className="mt-1 text-[0.9375rem]">
            Providência: {pending.next_action} — {pending.next_action_owner_name}. Previsão: {formatDateBR(pending.expected_return_date)}
          </p>
        </section>
      )}

      <div className="space-y-8">
        <Panel title="Pedido">
          <p className="mb-2 flex flex-wrap gap-x-3 text-[0.9375rem] text-muted">
            <span>{[r.site?.name, r.area?.name].filter(Boolean).join(", ")}</span>
            <span className="tipo-condensada">Programado para {formatDateBR(r.scheduled_date)}</span>
            {r.due_date && <span className="tipo-condensada">Prazo {formatDateBR(r.due_date)}</span>}
          </p>
          <p className="whitespace-pre-line">{r.description}</p>
          <div className="mt-4">
            <PhotoGrid photos={detail.requestPhotos} emptyText="Sem fotos da situação inicial." />
          </div>
          {r.site && (r.site.access_hours || r.site.access_instructions || r.site.responsible_profile_id) && (
            // B-21: o que a equipe precisa saber para entrar no local.
            <section aria-labelledby="acesso-local" className="mt-5 border-t border-linha pt-4">
              <h3 id="acesso-local" className="text-[1.0625rem] font-semibold">
                Acesso ao local
              </h3>
              <dl className="mt-2 space-y-1.5 text-[0.95rem]">
                {r.site.access_hours && (
                  <div>
                    <dt className="text-muted">Horário</dt>
                    <dd>{r.site.access_hours}</dd>
                  </div>
                )}
                {r.site.access_instructions && (
                  <div>
                    <dt className="text-muted">Orientações</dt>
                    <dd className="whitespace-pre-line">{r.site.access_instructions}</dd>
                  </div>
                )}
                {r.site.responsible_profile_id && (
                  <div>
                    <dt className="text-muted">Responsável na Megagyn</dt>
                    <dd>{profiles.name(r.site.responsible_profile_id)}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </Panel>

        {!["concluida", "cancelada", "aberta"].includes(r.status) && (
          <details className="border-t border-linha">
            <summary className="flex min-h-12 cursor-pointer items-center gap-2 pt-1 text-[1.0625rem] font-semibold">
              <Camera aria-hidden className="size-5 text-acento" /> Adicionar fotos ao chamado
            </summary>
            <div className="pb-2 pt-3">
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
