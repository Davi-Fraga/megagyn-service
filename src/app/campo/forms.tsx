"use client";

import { useState } from "react";
import { todayIso, addDaysIso } from "@/domain/dates";
import { markExecutedAction, reportPendingAction, workEntryAction } from "@/server/actions/requests";
import { ActionForm, CheckboxGroup, SelectField, TextAreaField, TextField, type Option } from "@/ui/form";
import { MediaUploader } from "@/ui/media-uploader";

const KIND_OPTIONS: Option[] = [
  { value: "execucao", label: "Serviço executado" },
  { value: "vistoria", label: "Vistoria" },
  { value: "visita", label: "Visita técnica" },
  { value: "recebimento_material", label: "Recebimento de material" },
  { value: "apoio", label: "Apoio à equipe" },
  { value: "compra", label: "Compra" },
  { value: "outro", label: "Outra atividade" },
];

type SiteCtx = { id: string; label: string; areas: Option[]; members: Option[] };

function DateAndHours({ backdateDays }: { backdateDays: number }) {
  const today = todayIso();
  return (
    <div className="grid grid-cols-2 gap-3">
      <TextField
        label="Data do serviço"
        name="activity_date"
        type="date"
        required
        defaultValue={today}
        max={today}
        min={addDaysIso(today, -backdateDays)}
        hint="Pode ser diferente de hoje."
      />
      <TextField label="Horas" name="hours_worked" inputMode="decimal" placeholder="Ex.: 9" />
    </div>
  );
}

/** "Registrar o que foi feito" — OS, tarefa ou atividade avulsa (um único lançamento). */
export function WorkEntryForm({
  sites,
  fixedSiteId,
  requestId,
  occurrenceId,
  returnTo,
  pendingReasons,
  backdateDays,
  showKind,
}: {
  sites: SiteCtx[];
  fixedSiteId?: string;
  requestId?: string;
  occurrenceId?: string;
  returnTo: string;
  pendingReasons: Option[];
  backdateDays: number;
  showKind?: boolean;
}) {
  const [siteId, setSiteId] = useState(fixedSiteId ?? (sites.length === 1 ? sites[0]!.id : ""));
  const [outcome, setOutcome] = useState("executado");
  const site = sites.find((s) => s.id === siteId);

  return (
    <ActionForm action={workEntryAction} submitLabel="Salvar registro" pendingLabel="Salvando…" submitSize="lg" stickySubmit>
      <input type="hidden" name="return_to" value={returnTo} />
      {requestId && <input type="hidden" name="request_id" value={requestId} />}
      {occurrenceId && <input type="hidden" name="task_occurrence_id" value={occurrenceId} />}
      {fixedSiteId ? (
        <input type="hidden" name="site_id" value={fixedSiteId} />
      ) : (
        <div className="space-y-1.5">
          <label htmlFor="site_id" className="block font-semibold">
            Onde foi feito <span className="text-erro">*</span>
          </label>
          <select id="site_id" name="site_id" required value={siteId} onChange={(e) => setSiteId(e.target.value)} className="campo-input">
            <option value="">Escolha a obra ou unidade…</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {showKind && <SelectField label="Tipo" name="kind" options={KIND_OPTIONS} defaultValue="execucao" placeholder="" />}
      {site && site.areas.length > 0 && <SelectField label="Ambiente" name="site_area_id" options={site.areas} />}

      <TextAreaField
        label="O que foi feito"
        name="description"
        required
        rows={4}
        placeholder="Ex.: Remoção do entulho do salão de festas e limpeza do piso."
      />

      {site ? (
        <MediaUploader key={site.id} name="photo_ids" label="Fotos" siteId={site.id} hint="Tire fotos do serviço. Elas entram no diário do dia." />
      ) : (
        <p className="rounded-ctl border border-dashed border-linha bg-papel p-3 text-sm text-muted">Escolha o local para enviar fotos.</p>
      )}

      <fieldset className="space-y-2">
        <legend className="font-semibold">Resultado</legend>
        <div className="grid gap-2">
          {[
            { v: "executado", l: "Feito" },
            { v: "parcial", l: "Feito em parte" },
            { v: "nao_executado", l: "Não deu para fazer" },
          ].map((o) => (
            <label key={o.v} className="flex min-h-12 items-center gap-3 rounded-ctl border border-linha bg-papel px-3">
              <input type="radio" name="outcome" value={o.v} checked={outcome === o.v} onChange={() => setOutcome(o.v)} className="size-5 accent-laranja" />
              {o.l}
            </label>
          ))}
        </div>
      </fieldset>
      {outcome !== "executado" && (
        <>
          <SelectField label="Motivo" name="blocker_reason_id" required options={pendingReasons} />
          <TextAreaField label="Próximo passo" name="next_step" rows={2} placeholder="O que falta e quando continua" />
        </>
      )}

      <TextField label="Materiais usados" name="materials" placeholder="Ex.: 2 luvas 50 mm, cola PVC" />
      <DateAndHours backdateDays={backdateDays} />
      {site && site.members.length > 1 && (
        <CheckboxGroup label="Quem participou" name="participant_ids" options={site.members} hint="Você já é incluído automaticamente." />
      )}
    </ActionForm>
  );
}

/** "Não consegui concluir" — pendência com motivo, providência, responsável e previsão. */
export function PendingForm({
  requestId,
  siteId,
  base,
  pendingReasons,
  owners,
}: {
  requestId: string;
  siteId: string;
  base: string;
  pendingReasons: Option[];
  owners: Option[];
}) {
  return (
    <ActionForm action={reportPendingAction} submitLabel="Registrar pendência" pendingLabel="Registrando…" submitSize="lg" stickySubmit>
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="base" value={base} />
      <SelectField label="Por que não deu para concluir?" name="pending_reason_id" required options={pendingReasons} />
      <TextAreaField label="Explique o que aconteceu" name="explanation" required rows={3} placeholder="Ex.: Faltou luva de 50 mm para terminar o reparo." />
      <TextAreaField label="O que precisa ser feito" name="next_action" required rows={2} placeholder="Ex.: Comprar 2 luvas de 50 mm." />
      <SelectField label="Quem faz a próxima ação" name="next_action_owner_id" required options={owners} />
      <TextField label="Previsão de retorno" name="expected_return_date" type="date" required min={todayIso()} />
      <MediaUploader name="photo_ids" label="Fotos do problema" siteId={siteId} />
    </ActionForm>
  );
}

/** "Concluí" — exige solução e ao menos 1 foto do resultado (também validado no banco). */
export function ExecutedForm({
  requestId,
  siteId,
  base,
  members,
  backdateDays,
}: {
  requestId: string;
  siteId: string;
  base: string;
  members: Option[];
  backdateDays: number;
}) {
  return (
    <ActionForm action={markExecutedAction} submitLabel="Enviar para validação" pendingLabel="Enviando…" submitSize="lg" stickySubmit>
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="base" value={base} />
      <TextAreaField label="Solução aplicada" name="solution" required rows={4} placeholder="Ex.: Substituída a luva e refeita a vedação do cano." />
      <MediaUploader name="result_photo_ids" label="Fotos do resultado" required siteId={siteId} hint="Ao menos 1 foto mostrando o serviço pronto." />
      <TextField label="Materiais usados" name="materials" />
      <DateAndHours backdateDays={backdateDays} />
      {members.length > 1 && <CheckboxGroup label="Quem participou" name="participant_ids" options={members} hint="Você já é incluído automaticamente." />}
    </ActionForm>
  );
}
