import { FileDown, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDateBR, formatDateTimeBR, todayIso } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { isOverdue } from "@/domain/request-status";
import { rulerStageDates } from "@/domain/status-ruler";
import {
  cancelRequestAction,
  commentAction,
  reopenRequestAction,
  returnRequestAction,
  scheduleRequestAction,
  updateRequestAction,
  validateRequestAction,
  revokeAttachmentAction,
} from "@/server/actions/requests";
import { getRequestDetail, loadCatalogs, loadMemberships, loadProfiles } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { ButtonLink } from "@/ui/button";
import { ActionForm, CheckboxField, CheckboxGroup, SelectField, TextAreaField, TextField } from "@/ui/form";
import { DescriptionList, Notice, PageHeader, Panel } from "@/ui/page";
import { PhotoGrid } from "@/ui/photo-grid";
import { ReasonAction } from "@/ui/reason-action";
import { RequestTimeline } from "@/ui/request-timeline";
import { AlertTape } from "@/ui/status";
import { StatusRuler } from "@/ui/status-ruler";
import { GenerateReportButton } from "@/ui/report-button";

// Esta página pede PDFs; a geração roda após a resposta e precisa caber no tempo da função (Vercel Hobby: até 300 s).
export const maxDuration = 300;

export const metadata: Metadata = { title: "Chamado" };

const ORIGIN_LABEL: Record<string, string> = {
  cliente_externo: "Pedido do cliente",
  cliente_portal: "Portal do cliente",
  interna: "Demanda interna",
  programada: "Atividade programada",
};
const DONE_MESSAGE: Record<string, string> = {
  aberto: "Chamado aberto.",
  validado: "Execução validada. Chamado concluído.",
  devolvido: "Chamado devolvido para correção. A equipe foi avisada.",
  cancelado: "Chamado cancelado. O motivo ficou no histórico.",
  reaberto: "Chamado reaberto. Faça a nova triagem.",
};

export default async function AdminRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feito?: string; aviso?: string }>;
}) {
  const { id } = await params;
  const { feito, aviso } = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const db = await createSupabaseServer();
  const detail = await getRequestDetail(db, id);
  if (!detail) notFound();
  const [profiles, catalogs, members, areas] = await Promise.all([
    loadProfiles(db),
    loadCatalogs(db),
    loadMemberships(db),
    db.from("site_areas").select("id, name").eq("site_id", detail.request.site_id).eq("is_active", true).order("name"),
  ]);

  const r = detail.request;
  const memberIds = members.get(r.site_id) ?? [];
  const assigneeOptions = profiles.list
    .filter((p) => p.is_active && (p.role === "admin" || memberIds.includes(p.id)))
    .map((p) => ({ value: p.id, label: p.role === "admin" ? `${p.full_name} (administração)` : p.full_name }));
  const overdue = isOverdue(r.due_date, r.status, todayIso());
  const pending = (r.current_pending ?? null) as Record<string, string> | null;
  const hidden = { request_id: r.id };
  const canSchedule = ["aberta", "programada", "pendente"].includes(r.status);
  const canCancel = ["aberta", "programada", "em_execucao", "pendente"].includes(r.status);
  const terminal = r.status === "concluida" || r.status === "cancelada";

  return (
    <>
      <PageHeader
        back={{ href: "/admin/chamados", label: "Chamados" }}
        eyebrow={<span className="tipo-placa text-2xl text-grafite">{r.number}</span>}
        title={r.title}
        description={
          (overdue || r.is_internal) && (
            <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {overdue && <AlertTape>Prazo vencido</AlertTape>}
              {r.is_internal && <span className="text-sm font-semibold text-grafite">Demanda interna</span>}
            </span>
          )
        }
        actions={
          <>
            <GenerateReportButton kind="os_individual" sourceId={r.id} label="PDF da OS" icon={<FileDown aria-hidden className="size-4" />} />
            <ButtonLink href={`/campo/chamados/${r.id}`} variant="secondary" icon={<Smartphone aria-hidden className="size-4" />}>
              Visão de campo
            </ButtonLink>
          </>
        }
      />

      <div className="mb-10">
        <StatusRuler
          status={r.status}
          dates={rulerStageDates(detail.events)}
          note={r.status === "pendente" ? (pending?.pending_reason ?? null) : r.status === "executada" ? "Aguarda sua validação" : null}
        />
      </div>

      <div className="mb-4 space-y-2">
        {feito && DONE_MESSAGE[feito] && <Notice tone="ok">{DONE_MESSAGE[feito]}</Notice>}
        {aviso && <Notice tone="alerta">{aviso}</Notice>}
      </div>

      <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-10">
          <Panel title="Solicitação">
            <DescriptionList
              items={[
                { label: "Cliente", value: r.client?.display_name },
                { label: "Obra ou unidade", value: r.site?.name },
                { label: "Setor ou ambiente", value: r.area?.name ?? "—" },
                { label: "Origem", value: `${ORIGIN_LABEL[r.origin] ?? r.origin}${r.channel ? ` (${r.channel})` : ""}` },
                { label: "Solicitante", value: r.requester_name ?? "—" },
                { label: "Aberto em", value: `${formatDateTimeBR(r.opened_at)} por ${profiles.name(r.created_by)}` },
                { label: "Categoria", value: r.category?.name ?? "—" },
                { label: "Prioridade", value: r.priority?.name ?? "—" },
                { label: "Responsáveis", value: detail.assigneeIds.map((a) => profiles.name(a)).join(", ") || "—" },
                { label: "Data programada", value: formatDateBR(r.scheduled_date) },
                { label: "Prazo", value: formatDateBR(r.due_date) },
                { label: "Encerrado em", value: r.closed_at ? formatDateTimeBR(r.closed_at) : "—", hidden: !r.closed_at },
              ]}
            />
            <p className="mt-4 whitespace-pre-line">{r.description}</p>
            <div className="mt-4">
              <h3 className="mb-2 font-semibold">Fotos do chamado</h3>
              <PhotoGrid photos={detail.requestPhotos} emptyText="Nenhuma foto anexada à abertura." revokeAction={revokeAttachmentAction} />
            </div>
          </Panel>

          {r.status === "pendente" && pending && (
            <section className="border-l-[3px] border-alerta pl-4">
              <div className="space-y-1">
                <h2 className="text-[1.3125rem] text-alerta">Pendência atual: {pending.pending_reason}</h2>
                <p>{pending.explanation}</p>
                <p>
                  <span className="text-muted">Providência: </span>
                  {pending.next_action} — {pending.next_action_owner_name}
                </p>
                <p>
                  <span className="text-muted">Previsão de retorno: </span>
                  {formatDateBR(pending.expected_return_date)}
                </p>
              </div>
            </section>
          )}

          <Panel title="Histórico">
            <RequestTimeline detail={detail} name={profiles.name} showInternal />
          </Panel>
        </div>

        <div className="space-y-10">
          {r.status === "executada" && (
            <Panel title="Validar a execução">
              <p className="mb-3 text-muted">Confira a solução e as fotos do resultado no histórico antes de decidir.</p>
              <div className="space-y-3">
                <ActionForm action={validateRequestAction} submitLabel="Validar e concluir" submitVariant="primary">
                  <input type="hidden" name="request_id" value={r.id} />
                  <TextAreaField label="Observação" name="reason" rows={2} />
                </ActionForm>
                <ReasonAction
                  action={returnRequestAction}
                  hidden={hidden}
                  label="Devolver para correção"
                  confirmLabel="Devolver para correção"
                  reasonLabel="O que precisa ser corrigido"
                />
              </div>
            </Panel>
          )}

          {canSchedule && (
            <Panel title={r.status === "aberta" ? "Triagem e programação" : "Reprogramar"}>
              <ActionForm action={scheduleRequestAction} submitLabel={r.status === "aberta" ? "Programar" : "Reprogramar"}>
                <input type="hidden" name="request_id" value={r.id} />
                <CheckboxGroup
                  label="Responsáveis"
                  name="assignee_ids"
                  required
                  options={assigneeOptions}
                  defaultValues={detail.assigneeIds}
                  hint="Para incluir outra pessoa, vincule-a a este local em Clientes e locais."
                />
                <TextField label="Data programada" name="scheduled_date" type="date" required defaultValue={r.scheduled_date ?? todayIso()} />
                <TextField label="Prazo" name="due_date" type="date" defaultValue={r.due_date ?? ""} />
                <SelectField
                  label="Prioridade"
                  name="priority_id"
                  defaultValue={r.priority_id ?? ""}
                  options={catalogs.priorities.map((p) => ({ value: p.id, label: p.name }))}
                />
                <SelectField
                  label="Categoria"
                  name="service_category_id"
                  defaultValue={r.service_category_id ?? ""}
                  options={catalogs.categories.map((c) => ({ value: c.id, label: c.name }))}
                />
                {r.status !== "aberta" && <TextAreaField label="Motivo da reprogramação" name="reason" rows={2} />}
              </ActionForm>
            </Panel>
          )}

          <Panel title="Comentário ou nota interna">
            <ActionForm action={commentAction} submitLabel="Registrar" resetOnSuccess successMessage="Comentário registrado.">
              <input type="hidden" name="request_id" value={r.id} />
              <TextAreaField label="Texto" name="body" required rows={3} />
              <CheckboxField label="Nota interna" name="is_internal" hint="Nunca entra em relatório para o cliente." defaultChecked />
            </ActionForm>
          </Panel>

          {!terminal && (
            <details className="border-t border-linha pt-3">
              <summary className="tipo-expandida flex min-h-11 cursor-pointer items-center text-[1.3125rem]">Editar dados do chamado</summary>
              <div className="pt-4">
                <ActionForm action={updateRequestAction} submitLabel="Salvar alterações">
                  <input type="hidden" name="request_id" value={r.id} />
                  <TextField label="Título" name="title" required defaultValue={r.title} />
                  <TextAreaField label="Descrição" name="description" required defaultValue={r.description} rows={4} />
                  <SelectField
                    label="Setor ou ambiente"
                    name="site_area_id"
                    defaultValue={r.site_area_id ?? ""}
                    options={(areas.data ?? []).map((a) => ({ value: a.id, label: a.name }))}
                  />
                  <SelectField
                    label="Prioridade"
                    name="priority_id"
                    defaultValue={r.priority_id ?? ""}
                    options={catalogs.priorities.map((p) => ({ value: p.id, label: p.name }))}
                  />
                  <SelectField
                    label="Categoria"
                    name="service_category_id"
                    defaultValue={r.service_category_id ?? ""}
                    options={catalogs.categories.map((c) => ({ value: c.id, label: c.name }))}
                  />
                  <TextField label="Prazo" name="due_date" type="date" defaultValue={r.due_date ?? ""} />
                  <CheckboxField label="Demanda interna" name="is_internal" defaultChecked={r.is_internal} />
                  <TextAreaField label="Motivo" name="reason" rows={2} hint="Obrigatório ao alterar prazo ou prioridade." />
                </ActionForm>
              </div>
            </details>
          )}

          {(canCancel || terminal) && (
            <Panel title={terminal ? "Reabrir" : "Cancelar"}>
              {canCancel && (
                <ReasonAction
                  action={cancelRequestAction}
                  hidden={hidden}
                  label="Cancelar chamado"
                  confirmLabel="Confirmar cancelamento"
                  variant="danger"
                  intro="O cancelamento fica registrado com o motivo e não apaga o histórico."
                />
              )}
              {terminal && (
                <ReasonAction
                  action={reopenRequestAction}
                  hidden={hidden}
                  label="Reabrir chamado"
                  confirmLabel="Reabrir"
                  intro="A conclusão anterior continua registrada no histórico. O chamado volta para triagem."
                />
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
