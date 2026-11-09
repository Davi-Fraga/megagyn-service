import { ChevronRight, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateBR, formatDateTimeBR } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { CLIENT_KIND_LABEL, SITE_TYPE_LABEL } from "@/domain/registry";
import {
  anonymizeContactAction,
  createContactAction,
  createSiteAction,
  setClientActiveAction,
  setContactActiveAction,
  updateClientAction,
  updateContactAction,
} from "@/server/actions/registry";
import { loadPhotos, loadProfiles } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { ActionForm, CheckboxGroup, TextAreaField, TextField } from "@/ui/form";
import { ClientDocuments, ClientHistory } from "./client-documents";
import { EmptyState, Notice, PageHeader, Panel, RowList } from "@/ui/page";
import { Badge } from "@/ui/status";
import { ActiveBadge, ClientFields, SiteFields, SiteStatusBadge, siteResponsibleOptions } from "../_shared/fields";
import { RowAction } from "../_shared/row-action";
import { rowOrNotFound } from "@/server/query";

export const metadata: Metadata = { title: "Cliente" };

const DONE: Record<string, string> = {
  criado: "Cliente cadastrado. Agora cadastre as obras ou unidades e os responsáveis.",
  ativado: "Cliente reativado.",
  desativado: "Cliente desativado. Locais, chamados e relatórios continuam no histórico.",
};

type ContactRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role_title: string | null;
  is_active: boolean;
  anonymized_at: string | null;
};

function ContactFields({ contact, siteOptions, linked }: { contact?: ContactRow; siteOptions: Array<{ value: string; label: string }>; linked?: string[] }) {
  return (
    <>
      <TextField label="Nome do responsável" name="name" required maxLength={160} defaultValue={contact?.name} />
      <TextField label="Cargo ou função" name="role_title" maxLength={120} defaultValue={contact?.role_title ?? ""} hint="Ex.: Síndica, Gerente de manutenção." />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="E-mail do responsável" name="email" type="email" inputMode="email" maxLength={200} defaultValue={contact?.email ?? ""} />
        <TextField label="Telefone do responsável" name="phone" type="tel" inputMode="tel" maxLength={40} defaultValue={contact?.phone ?? ""} />
      </div>
      <CheckboxGroup
        label="Locais pelos quais responde"
        name="site_ids"
        options={siteOptions}
        defaultValues={linked}
        hint="Usado para sugerir quem pediu cada serviço."
      />
    </>
  );
}

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feito?: string }>;
}) {
  const { id } = await params;
  const { feito } = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const db = await createSupabaseServer();
  // Notas internas e dados de cobrança só pela view client_internal (B-16): a tabela não os entrega pela API.
  const [clientRes, internalRes] = await Promise.all([
    db.from("clients").select("id, kind, legal_name, display_name, document, email, phone, address_text, is_active, created_by, created_at, updated_at, document_digits").eq("id", id).maybeSingle(),
    db.from("client_internal").select("notes_internal, billing_info").eq("id", id).maybeSingle(),
  ]);
  const client = { ...rowOrNotFound(clientRes), notes_internal: internalRes.data?.notes_internal ?? null, billing_info: internalRes.data?.billing_info ?? null };

  const [sitesRes, contactsRes, profiles, photoMap, categoriesRes, historyRes] = await Promise.all([
    db.from("sites").select("id, name, code, site_type, status, address_text, planned_start, planned_end").eq("client_id", id).order("name"),
    db
      .from("client_contacts")
      .select("id, name, email, phone, role_title, is_active, anonymized_at, updated_at, sites:client_contact_sites(site_id, ended_at)")
      .eq("client_id", id)
      .order("is_active", { ascending: false })
      .order("name"),
    loadProfiles(db),
    // B-18: documentos e fotos do cadastro, com a categoria do vínculo, e a trilha do cliente.
    loadPhotos(db, "client", [id]),
    db.from("attachment_links").select("attachment_id, category").eq("entity_type", "client").eq("entity_id", id),
    db
      .from("audit_events")
      .select("id, action, actor_id, reason, created_at, before, after")
      .eq("entity_type", "clients")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const categoryOf = new Map((categoriesRes.data ?? []).map((l) => [l.attachment_id, l.category]));
  const files = (photoMap.get(id) ?? []).map((f) => ({
    ...f,
    caption: [categoryOf.get(f.id), f.caption].filter(Boolean).join(", ") || null,
  }));
  const history = historyRes.data ?? [];
  const sites = sitesRes.data ?? [];
  const contacts = contactsRes.data ?? [];
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const siteOptions = sites.filter((s) => s.status !== "encerrada").map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }));
  const hidden = { client_id: client.id };

  return (
    <>
      <PageHeader
        back={{ href: "/admin/clientes", label: "Clientes" }}
        eyebrow={CLIENT_KIND_LABEL[client.kind]}
        title={client.display_name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ActiveBadge active={client.is_active} />
            {client.legal_name !== client.display_name && <span>{client.legal_name}</span>}
            {client.document && <span className="text-sm">{client.document}</span>}
          </span>
        }
      />

      {feito && DONE[feito] && (
        <div className="mb-4">
          <Notice tone="ok">{DONE[feito]}</Notice>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Panel title="Obras e unidades">
            {sites.length === 0 ? (
              <p className="mb-4 text-muted">Nenhum local cadastrado para este cliente.</p>
            ) : (
              <div className="mb-4">
                <RowList>
                  {sites.map((s) => (
                    <li key={s.id}>
                      <Link href={`/admin/locais/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-concreto/60">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">
                            {s.name} <span className="tipo-condensada ml-1 text-sm text-muted">{s.code}</span>
                          </p>
                          <p className="text-sm text-muted">
                            {SITE_TYPE_LABEL[s.site_type]}
                            {s.planned_start || s.planned_end
                              ? `, ${formatDateBR(s.planned_start)} a ${formatDateBR(s.planned_end)}`
                              : ""}
                          </p>
                        </div>
                        <SiteStatusBadge status={s.status} />
                        <ChevronRight aria-hidden className="size-5 text-muted" />
                      </Link>
                    </li>
                  ))}
                </RowList>
              </div>
            )}
            {client.is_active ? (
              <details className="rounded-ctl border border-linha" open={sites.length === 0}>
                <summary className="cursor-pointer px-3 py-2.5 font-semibold">Cadastrar novo local</summary>
                <div className="border-t border-linha p-3">
                  <ActionForm action={createSiteAction} submitLabel="Cadastrar local" pendingLabel="Cadastrando…">
                    <input type="hidden" name="client_id" value={client.id} />
                    <SiteFields responsibles={siteResponsibleOptions(profiles.list, contacts)} />
                  </ActionForm>
                </div>
              </details>
            ) : (
              <Notice tone="info">Reative o cliente para cadastrar novos locais.</Notice>
            )}
          </Panel>

          <Panel title="Responsáveis do cliente">
            <p className="mb-4 text-sm text-muted">
              Pessoas do lado do cliente (síndico, gerente…). Elas <strong>não entram no sistema</strong>: o acesso do cliente ainda
              depende de decisão da Megagyn. Servem para registrar quem pediu cada serviço.
            </p>
            {contacts.length === 0 ? (
              <div className="mb-4">
                <EmptyState title="Nenhum responsável cadastrado." />
              </div>
            ) : (
              <ul className="mb-4 divide-y divide-linha border-y border-linha">
                {contacts.map((c) => {
                  // Vínculo encerrado (ended_at) fica só no histórico.
                  const linked = c.sites.filter((s) => !s.ended_at).map((s) => s.site_id);
                  const anonymized = !!c.anonymized_at;
                  return (
                    <li key={c.id} className="space-y-2 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {c.name}
                            {c.role_title && <span className="font-normal text-muted">, {c.role_title}</span>}
                          </p>
                          <p className="flex flex-wrap gap-x-4 text-sm text-muted">
                            {c.phone && (
                              <span className="inline-flex items-center gap-1">
                                <Phone aria-hidden className="size-3.5" /> {c.phone}
                              </span>
                            )}
                            {c.email && (
                              <span className="inline-flex items-center gap-1 break-all">
                                <Mail aria-hidden className="size-3.5" /> {c.email}
                              </span>
                            )}
                          </p>
                          {linked.length > 0 && (
                            <p className="text-sm">Locais: {linked.map((sid) => siteName.get(sid) ?? "—").join(", ")}</p>
                          )}
                        </div>
                        {anonymized ? (
                          <Badge tone="neutral">Anonimizado em {formatDateTimeBR(c.anonymized_at)}</Badge>
                        ) : (
                          <ActiveBadge active={c.is_active} />
                        )}
                      </div>
                      {!anonymized && (
                        <div className="flex flex-wrap items-start gap-2">
                          <details className="w-full rounded-ctl border border-linha">
                            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Editar {c.name}</summary>
                            <div className="border-t border-linha p-3">
                              <ActionForm action={updateContactAction} submitLabel="Salvar responsável">
                                <input type="hidden" name="contact_id" value={c.id} />
                                <ContactFields contact={c} siteOptions={siteOptions} linked={linked} />
                              </ActionForm>
                            </div>
                          </details>
                          <RowAction
                            action={setContactActiveAction}
                            hidden={{ contact_id: c.id, active: c.is_active ? "0" : "1" }}
                            label={c.is_active ? "Desativar" : "Reativar"}
                          />
                          <RowAction
                            action={anonymizeContactAction}
                            hidden={{ contact_id: c.id }}
                            label="Anonimizar (LGPD)"
                            variant="danger"
                            confirm={{
                              intro:
                                "Apaga nome, e-mail, telefone e cargo deste contato de forma definitiva. Ele passa a aparecer como “Contato removido”. Não dá para desfazer.",
                              label: "Confirmar anonimização",
                              variant: "danger",
                            }}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="rounded-ctl border border-linha p-3">
              <h3 className="mb-3 font-semibold">Novo responsável</h3>
              <ActionForm action={createContactAction} submitLabel="Adicionar responsável" resetOnSuccess>
                <input type="hidden" name="client_id" value={client.id} />
                <ContactFields siteOptions={siteOptions} />
              </ActionForm>
            </div>
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel title="Dados do cliente">
            <ActionForm action={updateClientAction} submitLabel="Salvar dados">
              <input type="hidden" name="client_id" value={client.id} />
              <input type="hidden" name="expected_updated_at" value={client.updated_at} />
              <ClientFields client={client} />
            </ActionForm>
          </Panel>

          <ClientDocuments clientId={client.id} files={files} />

          <Panel title="Situação do cadastro">
            {client.is_active ? (
              <ActionForm action={setClientActiveAction} submitLabel="Desativar cliente" submitVariant="danger">
                <input type="hidden" name="client_id" value={client.id} />
                <input type="hidden" name="active" value="0" />
                <TextAreaField label="Motivo da desativação" name="reason" required rows={2} maxLength={500} />
                <p className="text-sm text-muted">
                  O cliente deixa de aparecer nas listas de escolha. Locais, chamados, relatórios e o histórico continuam guardados.
                </p>
              </ActionForm>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted">Cliente desativado. Reative para voltar a usá-lo em novos cadastros.</p>
                <RowAction action={setClientActiveAction} hidden={{ ...hidden, active: "1" }} label="Reativar cliente" variant="primary" />
              </div>
            )}
          </Panel>

          <ClientHistory rows={history} name={(actor) => profiles.name(actor)} />
        </div>
      </div>
    </>
  );
}
