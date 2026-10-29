"use client";

import { useState } from "react";
import type { QuoteItemDraft } from "@/domain/quote-form";
import { saveQuoteAction } from "@/server/actions/quotes";
import { ActionForm, SelectField, TextAreaField, TextField, type Option } from "@/ui/form";
import { Panel } from "@/ui/page";
import { QuoteItemsEditor } from "@/ui/quote-items-editor";

export type QuoteHeaderValues = {
  client_id: string;
  client_contact_id: string;
  site_id: string;
  service_location_text: string;
  title: string;
  issued_at: string;
  valid_until: string;
  execution_deadline_text: string;
  payment_terms: string;
  warranty_text: string;
  inclusions_text: string;
  intro_text: string;
  observations: string;
  technical_notes: string;
  declaration_text: string;
};

/** Cabeçalho + itens do orçamento (criar e editar rascunho). */
export function QuoteForm({
  quoteId,
  clients,
  contactsByClient,
  sitesByClient,
  values,
  items,
  submitLabel,
}: {
  quoteId?: string;
  clients: Option[];
  contactsByClient: Record<string, Option[]>;
  sitesByClient: Record<string, Option[]>;
  values: QuoteHeaderValues;
  items: QuoteItemDraft[];
  submitLabel: string;
}) {
  const [clientId, setClientId] = useState(values.client_id);
  const sameClient = clientId === values.client_id;
  const contacts = contactsByClient[clientId] ?? [];
  const sites = sitesByClient[clientId] ?? [];

  return (
    <ActionForm action={saveQuoteAction} submitLabel={submitLabel} pendingLabel="Salvando…" stickySubmit>
      {quoteId && <input type="hidden" name="quote_id" value={quoteId} />}

      <Panel title="Cliente e local">
        <div className="space-y-4">
          <SelectField
            label="Cliente"
            name="client_id"
            required
            options={clients}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Selecione o cliente…"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              key={`contact-${clientId}`}
              label="Contato (Att.)"
              name="client_contact_id"
              options={contacts}
              defaultValue={sameClient ? values.client_contact_id : ""}
              placeholder={contacts.length ? "Selecione…" : "Nenhum contato cadastrado"}
              disabled={!clientId}
            />
            <SelectField
              key={`site-${clientId}`}
              label="Obra ou unidade"
              name="site_id"
              options={sites}
              defaultValue={sameClient ? values.site_id : ""}
              placeholder={sites.length ? "Ainda sem obra cadastrada" : "Nenhum local cadastrado"}
              disabled={!clientId}
            />
          </div>
          <TextField
            label="Endereço ou local do serviço"
            name="service_location_text"
            defaultValue={values.service_location_text}
            maxLength={500}
            hint="Use quando ainda não há obra/unidade cadastrada (sai como “End.:” na proposta)."
          />
        </div>
      </Panel>

      <Panel title="Proposta">
        <div className="space-y-4">
          <TextField label="Título" name="title" defaultValue={values.title} maxLength={200} placeholder="Ex.: Reforma da cobertura" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Data de emissão" name="issued_at" type="date" required defaultValue={values.issued_at} />
            <TextField label="Válida até" name="valid_until" type="date" defaultValue={values.valid_until} hint="Obrigatória para marcar como enviado." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Prazo de execução"
              name="execution_deadline_text"
              defaultValue={values.execution_deadline_text}
              maxLength={200}
              placeholder="Ex.: 30 dias úteis"
            />
            <TextField label="Garantia" name="warranty_text" defaultValue={values.warranty_text} maxLength={300} placeholder="Ex.: 01 ano" />
          </div>
          <TextAreaField
            label="Forma de pagamento"
            name="payment_terms"
            rows={2}
            defaultValue={values.payment_terms}
            maxLength={1000}
            placeholder="Ex.: 50% na aprovação e 50% na entrega"
          />
          <TextAreaField
            label="Inclusões e condições"
            name="inclusions_text"
            rows={3}
            defaultValue={values.inclusions_text}
            maxLength={2000}
            hint="Uma por linha (ex.: Acompanhamento técnico incluso / Material e mão de obra inclusos)."
          />
        </div>
      </Panel>

      <Panel title="Itens">
        <QuoteItemsEditor initial={items} />
      </Panel>

      <Panel title="Textos da proposta">
        <div className="space-y-4">
          <TextAreaField label="Texto de abertura" name="intro_text" rows={2} defaultValue={values.intro_text} maxLength={2000} />
          <TextAreaField label="Observações" name="observations" rows={3} defaultValue={values.observations} maxLength={4000} />
          <TextAreaField label="Notas técnicas" name="technical_notes" rows={3} defaultValue={values.technical_notes} maxLength={4000} />
          <TextAreaField
            label="Declaração"
            name="declaration_text"
            rows={4}
            defaultValue={values.declaration_text}
            maxLength={4000}
            hint="Modelo vem de Configurações; ajuste se precisar."
          />
        </div>
      </Panel>
    </ActionForm>
  );
}
