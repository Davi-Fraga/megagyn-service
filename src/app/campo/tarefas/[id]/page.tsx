import { PencilLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateBR, formatDateTimeBR, todayIso } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { requireProfile } from "@/server/auth";
import { addOccurrenceAction, finishOccurrenceAction, notDoneOccurrenceAction, startOccurrenceAction } from "@/server/actions/tasks";
import { loadPhotos, loadProfiles } from "@/server/data";
import { loadFieldContext } from "@/server/field";
import { FIELD_OCCURRENCE_SELECT } from "@/server/field-queries";
import { createSupabaseServer } from "@/server/supabase/server";
import { ButtonLink } from "@/ui/button";
import { ActionForm, SelectField, TextAreaField, TextField } from "@/ui/form";
import { MediaUploader } from "@/ui/media-uploader";
import { OccurrenceBadge } from "@/ui/occurrence-status";
import { Notice, PageHeader, Panel } from "@/ui/page";
import { PhotoGrid } from "@/ui/photo-grid";
import { ReasonAction } from "@/ui/reason-action";
import { rowOrNotFound } from "@/server/query";

export const metadata: Metadata = { title: "Tarefa" };

const DONE: Record<string, string> = {
  registro: "Atividade registrada neste local. Ela já aparece no diário do dia.",
  desdobrada: "Novo local adicionado à mesma tarefa.",
  iniciada: "Tarefa iniciada.",
  finalizada: "Tarefa finalizada neste local.",
  nao_realizada: "Registrado que a tarefa não foi realizada, com o motivo.",
};

export default async function FieldTaskPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ feito?: string }> }) {
  await requireProfile(["worker", "foreman", "admin"]);
  const { id } = await params;
  const { feito } = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const db = await createSupabaseServer();
  const o = rowOrNotFound(await db.from("task_occurrences").select(FIELD_OCCURRENCE_SELECT).eq("id", id).maybeSingle());
  const [{ data: siblings }, { data: entries }, profiles, ctx] = await Promise.all([
    db.from("task_occurrences").select("id, scheduled_date, status, site:sites(name)").eq("task_id", o.task_id).neq("id", o.id).order("sort_order"),
    db.from("work_entries").select("id, activity_date, description, author_id, created_at").eq("task_occurrence_id", o.id).order("created_at"),
    loadProfiles(db),
    loadFieldContext(db),
  ]);
  const [photos, finishPhotos] = await Promise.all([
    loadPhotos(db, "work_entry", (entries ?? []).map((e) => e.id)),
    loadPhotos(db, "task_occurrence", [o.id]),
  ]);
  const closingPhotos = finishPhotos.get(o.id) ?? [];
  const open = o.status === "prevista" || o.status === "iniciada";
  const otherSites = ctx.sites.filter((s) => s.id !== o.site_id);

  return (
    <>
      <PageHeader
        back={{ href: "/campo/tarefas", label: "Agenda" }}
        eyebrow={`${o.task?.kind?.name ?? "Tarefa"} · ${formatDateBR(o.scheduled_date)}`}
        title={o.task?.title ?? "Tarefa"}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <OccurrenceBadge status={o.status} />
            <span>
              {o.site?.name}
              {o.area ? ` · ${o.area.name}` : ""}
            </span>
          </span>
        }
      />
      {feito && DONE[feito] && (
        <div className="mb-4">
          <Notice tone="ok">{DONE[feito]}</Notice>
        </div>
      )}

      {open && (
        <section className="mb-5 space-y-3">
          <ButtonLink href={`/campo/tarefas/${o.id}/registrar`} size="lg" icon={<PencilLine aria-hidden className="size-6" />}>
            Registrar o que foi feito
          </ButtonLink>
          {o.status === "prevista" && (
            <ActionForm action={startOccurrenceAction} submitLabel="Iniciar" submitVariant="secondary" submitSize="lg">
              <input type="hidden" name="occurrence_id" value={o.id} />
            </ActionForm>
          )}
          {/* B-38: observação e fotos do encerramento, opcionais (DP-05). */}
          <ActionForm action={finishOccurrenceAction} submitLabel="Finalizar neste local" submitVariant="dark" submitSize="lg">
            <input type="hidden" name="occurrence_id" value={o.id} />
            <TextAreaField label="Observação do encerramento" name="notes" rows={2} maxLength={2000} hint="O que foi feito e o que ficou pendente, se houver." />
            <MediaUploader name="photo_ids" label="Fotos do resultado" siteId={o.site_id} />
          </ActionForm>
          <ReasonAction
            action={notDoneOccurrenceAction}
            hidden={{ occurrence_id: o.id }}
            label="Não deu para fazer"
            confirmLabel="Registrar motivo"
            reasonLabel="Por que não foi feito?"
            intro="O dia fica registrado como não realizado, com o motivo, para a administração reprogramar."
          />
        </section>
      )}
      {o.status === "nao_realizada" && <Notice tone="alerta">Não realizada: {o.no_show_reason}</Notice>}

      <div className="space-y-8">
        <Panel title="Detalhes">
          {o.task?.description && <p className="mb-2 whitespace-pre-line">{o.task.description}</p>}
          <p className="text-sm text-muted">
            {o.task?.due_date ? `Prazo ${formatDateBR(o.task.due_date)}. ` : ""}
            {o.started_at ? `Iniciada ${formatDateTimeBR(o.started_at)}. ` : ""}
            {o.finished_at ? `Encerrada ${formatDateTimeBR(o.finished_at)}.` : ""}
          </p>
          {o.task?.request && (
            <p className="mt-2">
              Ligada ao chamado{" "}
              <Link href={`/campo/chamados/${o.task.request.id}`} className="font-semibold text-info underline">
                {o.task.request.number} — {o.task.request.title}
              </Link>
              . O que você registrar aqui também aparece no chamado, sem duplicar.
            </p>
          )}
          {(siblings ?? []).length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-semibold">A mesma tarefa em outros locais:</p>
              <ul className="text-sm">
                {(siblings ?? []).map((s) => (
                  <li key={s.id}>
                    <Link href={`/campo/tarefas/${s.id}`} className="text-info underline">
                      {s.site?.name} — {formatDateBR(s.scheduled_date)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel title="Registros neste local">
          {(entries ?? []).length === 0 ? (
            <p className="text-muted">Nenhum registro ainda.</p>
          ) : (
            <ul className="space-y-4">
              {(entries ?? []).map((e) => (
                <li key={e.id} className="space-y-2">
                  <p className="text-sm text-muted">
                    {formatDateBR(e.activity_date)} — {profiles.name(e.author_id)}
                  </p>
                  <p className="whitespace-pre-line">{e.description}</p>
                  <PhotoGrid photos={photos.get(e.id) ?? []} emptyText="Sem fotos." />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {open && otherSites.length > 0 && (
          <details className="border-t border-linha">
            <summary className="flex min-h-12 cursor-pointer items-center pt-1 text-[1.0625rem] font-semibold">Esta tarefa me levou a outro local</summary>
            <div className="pb-2 pt-3">
              <p className="mb-3 text-sm text-muted">Cria um registro separado no outro local, ligado a esta mesma tarefa.</p>
              <ActionForm action={addOccurrenceAction} submitLabel="Adicionar local">
                <input type="hidden" name="task_id" value={o.task_id} />
                <SelectField label="Outro local" name="site_id" required options={otherSites.map((s) => ({ value: s.id, label: s.label }))} />
                <TextField label="Data" name="scheduled_date" type="date" required defaultValue={todayIso()} />
              </ActionForm>
            </div>
          </details>
        )}

        {(o.notes || closingPhotos.length > 0) && (
          <Panel title="Encerramento">
            {o.notes && <p className="mb-3 whitespace-pre-line">{o.notes}</p>}
            {closingPhotos.length > 0 && <PhotoGrid photos={closingPhotos} emptyText="Sem fotos." />}
          </Panel>
        )}
      </div>
    </>
  );
}
