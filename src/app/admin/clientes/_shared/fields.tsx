import { CircleCheck, CircleSlash } from "lucide-react";
import { CLIENT_KIND_LABEL, SITE_STATUS_LABEL, SITE_TYPE_LABEL, type SiteStatus } from "@/domain/registry";
import type { Database } from "@/server/db/database.types";
import { SelectField, TextAreaField, TextField, type Option } from "@/ui/form";
import { Badge, type Tone } from "@/ui/status";

type Tables = Database["public"]["Tables"];
type ClientRow = Tables["clients"]["Row"];
type SiteRow = Tables["sites"]["Row"];

const KIND_OPTIONS = Object.entries(CLIENT_KIND_LABEL)
  .reverse()
  .map(([value, label]) => ({ value, label }));
const TYPE_OPTIONS = Object.entries(SITE_TYPE_LABEL).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = Object.entries(SITE_STATUS_LABEL).map(([value, label]) => ({ value, label }));

/** Campos do cadastro de cliente (criação e edição usam os mesmos nomes de input). */
export function ClientFields({ client }: { client?: ClientRow }) {
  return (
    <>
      <SelectField label="Tipo" name="kind" required placeholder="" options={KIND_OPTIONS} defaultValue={client?.kind ?? "pj"} />
      <TextField label="Razão social ou nome completo" name="legal_name" required maxLength={200} defaultValue={client?.legal_name} />
      <TextField
        label="Nome de exibição"
        name="display_name"
        maxLength={120}
        defaultValue={client?.display_name}
        hint="Como o cliente aparece nas telas e relatórios. Em branco, usa a razão social."
      />
      <TextField label="CPF ou CNPJ" name="document" inputMode="numeric" maxLength={20} defaultValue={client?.document ?? ""} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="E-mail" name="email" type="email" inputMode="email" maxLength={200} defaultValue={client?.email ?? ""} />
        <TextField label="Telefone" name="phone" type="tel" inputMode="tel" maxLength={40} defaultValue={client?.phone ?? ""} />
      </div>
      <TextAreaField label="Endereço" name="address_text" rows={2} maxLength={500} defaultValue={client?.address_text ?? ""} />
      <TextAreaField
        label="Dados de faturamento"
        name="billing_info"
        rows={2}
        maxLength={2000}
        defaultValue={client?.billing_info ?? ""}
        hint="Ex.: CNPJ de cobrança, e-mail do financeiro, dia de vencimento."
      />
      <TextAreaField
        label="Observações internas"
        name="notes_internal"
        rows={2}
        maxLength={2000}
        defaultValue={client?.notes_internal ?? ""}
        hint="Só a administração vê. Nunca entra em relatório."
      />
    </>
  );
}

/** Campos do cadastro de obra ou unidade. A situação só aparece na edição (local novo começa ativo). */
/** Opções dos responsáveis do local (B-21): a equipe da Megagyn e os contatos ativos do cliente. */
export type SiteResponsibleOptions = { staff: Option[]; contacts: Option[] };

export function SiteFields({ site, responsibles }: { site?: SiteRow; responsibles: SiteResponsibleOptions }) {
  return (
    <>
      <TextField label="Nome do local" name="name" required maxLength={160} defaultValue={site?.name} hint="Ex.: Torre A, Galpão de montagem." />
      <TextField
        label="Código"
        name="code"
        required
        maxLength={30}
        defaultValue={site?.code}
        hint="Curto e único (ex.: JEX-TA). Aparece nas listas e relatórios."
        className="uppercase"
      />
      <SelectField label="Tipo de local" name="site_type" required options={TYPE_OPTIONS} defaultValue={site?.site_type ?? ""} />
      {site && <SelectField label="Situação" name="status" required placeholder="" options={STATUS_OPTIONS} defaultValue={site.status} />}
      <TextAreaField label="Endereço do local" name="address_text" rows={2} maxLength={500} defaultValue={site?.address_text ?? ""} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Início previsto" name="planned_start" type="date" defaultValue={site?.planned_start ?? ""} />
        <TextField label="Término previsto" name="planned_end" type="date" defaultValue={site?.planned_end ?? ""} />
      </div>
      <TextField
        label="Horário de acesso"
        name="access_hours"
        maxLength={200}
        defaultValue={site?.access_hours ?? ""}
        hint="Ex.: segunda a sexta, das 7h às 17h. A equipe vê no chamado."
      />
      <TextAreaField
        label="Orientações de acesso"
        name="access_instructions"
        rows={2}
        maxLength={2000}
        defaultValue={site?.access_instructions ?? ""}
        hint="Ex.: retirar a chave na portaria. A equipe vê no chamado."
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Responsável na Megagyn"
          name="responsible_profile_id"
          placeholder="Ninguém definido"
          options={responsibles.staff}
          defaultValue={site?.responsible_profile_id ?? ""}
        />
        <SelectField
          label="Responsável do cliente"
          name="client_responsible_contact_id"
          placeholder="Ninguém definido"
          options={responsibles.contacts}
          defaultValue={site?.client_responsible_contact_id ?? ""}
          hint={responsibles.contacts.length === 0 ? "Cadastre um contato do cliente para escolher aqui." : "Só a administração vê."}
        />
      </div>
      {site && (
        <TextAreaField
          label="Observações internas"
          name="notes_internal"
          rows={2}
          maxLength={2000}
          defaultValue={site.notes_internal ?? ""}
          hint="Só a administração vê."
        />
      )}
    </>
  );
}

export function ActiveBadge({ active, inactiveLabel = "Desativado" }: { active: boolean; inactiveLabel?: string }) {
  return active ? (
    <Badge tone="ok" icon={CircleCheck}>
      Ativo
    </Badge>
  ) : (
    <Badge tone="neutral" icon={CircleSlash}>
      {inactiveLabel}
    </Badge>
  );
}

const SITE_STATUS_TONE: Record<SiteStatus, Tone> = { ativa: "ok", pausada: "alerta", encerrada: "neutral" };

export function SiteStatusBadge({ status }: { status: SiteStatus }) {
  return <Badge tone={SITE_STATUS_TONE[status]}>{SITE_STATUS_LABEL[status]}</Badge>;
}

/**
 * Opções dos responsáveis do local: equipe ativa e contatos ativos do cliente. O responsável atual
 * entra mesmo se tiver sido desativado; sem isso, salvar o formulário apagaria a escolha.
 */
export function siteResponsibleOptions(
  staff: Array<{ id: string; full_name: string; role: string; is_active: boolean }>,
  contacts: Array<{ id: string; name: string; role_title: string | null; is_active: boolean; anonymized_at: string | null }>,
  current: { profileId?: string | null; contactId?: string | null } = {},
): SiteResponsibleOptions {
  return {
    staff: staff
      .filter((p) => p.role !== "client" && (p.is_active || p.id === current.profileId))
      .map((p) => ({ value: p.id, label: p.full_name })),
    contacts: contacts
      .filter((c) => (c.is_active && !c.anonymized_at) || c.id === current.contactId)
      .map((c) => ({ value: c.id, label: c.role_title ? `${c.name} (${c.role_title})` : c.name })),
  };
}
