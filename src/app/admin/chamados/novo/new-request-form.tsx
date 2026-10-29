"use client";

import { useState } from "react";
import { todayIso } from "@/domain/dates";
import { openRequestAction } from "@/server/actions/requests";
import { ActionForm, CheckboxField, CheckboxGroup, SelectField, TextAreaField, TextField, type Option } from "@/ui/form";
import { MediaUploader } from "@/ui/media-uploader";

type Site = { id: string; name: string; clientId: string; clientName: string };

export function NewRequestForm({
  sites,
  areasBySite,
  contactsByClient,
  membersBySite,
  priorities,
  categories,
}: {
  sites: Site[];
  areasBySite: Record<string, Option[]>;
  contactsByClient: Record<string, Option[]>;
  membersBySite: Record<string, Option[]>;
  priorities: Option[];
  categories: Option[];
}) {
  const [siteId, setSiteId] = useState("");
  const [origin, setOrigin] = useState("cliente_externo");
  const [scheduleNow, setScheduleNow] = useState(false);
  const site = sites.find((s) => s.id === siteId);
  const byClient = new Map<string, Site[]>();
  for (const s of sites) byClient.set(s.clientName, [...(byClient.get(s.clientName) ?? []), s]);

  return (
    <ActionForm action={openRequestAction} submitLabel="Abrir chamado" pendingLabel="Abrindo…" stickySubmit>
      <div className="space-y-1.5">
        <label htmlFor="site_id" className="block text-[0.95rem] font-semibold">
          Cliente e local <span className="text-erro">*</span>
        </label>
        <select id="site_id" name="site_id" required value={siteId} onChange={(e) => setSiteId(e.target.value)} className="campo-input">
          <option value="">Selecione a obra ou unidade…</option>
          {[...byClient.entries()].map(([client, list]) => (
            <optgroup key={client} label={client}>
              {list.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {site && (areasBySite[site.id]?.length ?? 0) > 0 && (
        <SelectField label="Setor ou ambiente" name="site_area_id" options={areasBySite[site.id] ?? []} />
      )}

      <fieldset className="space-y-2">
        <legend className="text-[0.95rem] font-semibold">
          Origem <span className="text-erro">*</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { value: "cliente_externo", label: "Pedido do cliente", hint: "WhatsApp, telefone, e-mail…" },
            { value: "interna", label: "Demanda interna", hint: "Identificada pela Megagyn" },
            { value: "programada", label: "Atividade programada", hint: "Rotina ou plano" },
          ].map((o) => (
            <label key={o.value} className="flex min-h-14 items-start gap-3 rounded-ctl border border-linha bg-papel p-3">
              <input
                type="radio"
                name="origin"
                value={o.value}
                checked={origin === o.value}
                onChange={() => setOrigin(o.value)}
                className="mt-1 size-5 accent-laranja"
              />
              <span>
                <span className="block font-semibold">{o.label}</span>
                <span className="block text-sm text-muted">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {origin === "cliente_externo" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Canal"
            name="channel"
            options={[
              { value: "whatsapp", label: "WhatsApp" },
              { value: "telefone", label: "Telefone" },
              { value: "email", label: "E-mail" },
              { value: "presencial", label: "Presencial" },
              { value: "outro", label: "Outro" },
            ]}
          />
          {site && (contactsByClient[site.clientId]?.length ?? 0) > 0 ? (
            <SelectField
              label="Solicitante cadastrado"
              name="requester_contact_id"
              options={contactsByClient[site.clientId] ?? []}
              hint="Ou digite o nome abaixo se a pessoa não estiver cadastrada."
            />
          ) : null}
          <TextField label="Nome do solicitante" name="requester_name" hint="Use quando o solicitante não estiver na lista." />
        </div>
      )}

      <TextField label="Título" name="title" required maxLength={140} placeholder="Ex.: Vazamento no cano do subsolo" />
      <TextAreaField label="Descrição do problema" name="description" required rows={4} />

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Categoria" name="service_category_id" options={categories} />
        <SelectField label="Prioridade" name="priority_id" options={priorities} />
        <TextField label="Prazo" name="due_date" type="date" min={todayIso()} />
      </div>

      {site ? (
        <MediaUploader key={site.id} name="photo_ids" label="Fotos da situação inicial" siteId={site.id} />
      ) : (
        <p className="rounded-ctl border border-dashed border-linha bg-papel p-3 text-sm text-muted">
          Escolha o local para anexar fotos da situação inicial.
        </p>
      )}

      <CheckboxField label="Demanda interna (não aparece no relatório do cliente)" name="is_internal" />

      <div className="rounded-panel border border-linha bg-papel p-4">
        <label className="flex items-center gap-3 font-semibold">
          <input type="checkbox" checked={scheduleNow} onChange={(e) => setScheduleNow(e.target.checked)} className="size-5 accent-laranja" />
          Já definir responsável e data
        </label>
        {scheduleNow && site && (
          <div className="mt-4 space-y-4">
            <CheckboxGroup
              label="Responsáveis"
              name="assignee_ids"
              options={membersBySite[site.id] ?? []}
              hint="Somente pessoas vinculadas a este local."
            />
            <TextField label="Data programada" name="scheduled_date" type="date" defaultValue={todayIso()} />
          </div>
        )}
        {scheduleNow && !site && <p className="mt-2 text-sm text-muted">Escolha o local primeiro.</p>}
      </div>
    </ActionForm>
  );
}
