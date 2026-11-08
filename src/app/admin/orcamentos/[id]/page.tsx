import { FileDown, HardHat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addDaysIso, formatDateBR, formatDateTimeBR, isoDateInTz, todayIso } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { formatBRL } from "@/domain/money";
import { itemRowToDraft } from "@/domain/quote-form";
import { effectiveQuoteStatus, quoteActions } from "@/domain/quote-rules";
import {
  approveQuoteAction,
  cancelQuoteAction,
  createSiteFromQuoteAction,
  duplicateQuoteAction,
  rejectQuoteAction,
  renewQuoteAction,
  reviseQuoteAction,
  sendQuoteAction,
} from "@/server/actions/quotes";
import { loadProfiles } from "@/server/data";
import { loadQuoteBundle } from "@/app/admin/orcamentos/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { ActionForm, SelectField, TextAreaField, TextField } from "@/ui/form";
import { Notice, PageHeader, Panel } from "@/ui/page";
import { ReasonAction } from "@/ui/reason-action";
import { GenerateReportButton } from "@/ui/report-button";
import { loadQuoteFormOptions } from "../load";
import { QuoteForm } from "../quote-form";
import { AlertTape } from "@/ui/status";
import { QuoteStatusRuler } from "../quote-status-ruler";
import { QuotePhotos } from "./quote-photos";
import { QuoteView } from "./quote-view";

// Esta página pede PDFs; a geração roda após a resposta e precisa caber no tempo da função (Vercel Hobby: até 300 s).
export const maxDuration = 300;

export const metadata: Metadata = { title: "Orçamento" };

const DONE_MESSAGE: Record<string, string> = {
  criado: "Orçamento criado como rascunho. Adicione as fotos e marque como enviado quando estiver pronto.",
  enviado: "Proposta marcada como enviada. O conteúdo foi congelado em uma nova versão.",
  aprovado: "Aprovação do cliente registrada. Uma nova versão foi congelada.",
  recusado: "Recusa registrada com o motivo.",
  cancelado: "Orçamento cancelado. O motivo ficou registrado.",
  renovado: "Validade renovada. A proposta voltou para Enviado com uma nova versão.",
  revisao: "Proposta voltou para rascunho. Ao marcar como enviado de novo, será criada a próxima versão.",
  duplicado: "Cópia criada como novo rascunho (emissão hoje). Confira os dados antes de enviar.",
};

export default async function QuotePage({
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
  const bundle = await loadQuoteBundle(db, id);
  if (!bundle) notFound();

  const q = bundle.quote;
  const today = todayIso();
  const status = effectiveQuoteStatus(q.status, q.valid_until, today);
  const actions = quoteActions(q.status, q.valid_until, today);
  const can = (a: (typeof actions)[number]) => actions.includes(a);
  const [versions, profiles, createdSites, options] = await Promise.all([
    db
      .from("quote_versions")
      .select("id, version_no, reason, created_at, created_by, total:snapshot->>total_cents")
      .eq("quote_id", id)
      .order("version_no", { ascending: false }),
    loadProfiles(db),
    db.from("sites").select("id, name, code").eq("quote_id", id).order("created_at"),
    can("editar") ? loadQuoteFormOptions(db, { clientId: q.client_id, contactId: q.client_contact_id, siteId: q.site_id }) : null,
  ]);
  const hidden = { quote_id: q.id };
  const place = q.site?.name ?? q.service_location_text;
  const localPhotos = bundle.photos.filter((p) => p.role === "local");
  const referencePhotos = bundle.photos.filter((p) => p.role === "referencia");

  return (
    <>
      <PageHeader
        back={{ href: "/admin/orcamentos", label: "Orçamentos" }}
        eyebrow={<span className="tipo-placa text-2xl text-grafite">{q.number}</span>}
        title={q.title || place || "Orçamento"}
        description={
          <span className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {status === "expirado" && <AlertTape>Validade vencida</AlertTape>}
            <span>{q.client?.display_name}</span>
            <span className="tipo-condensada text-[1.0625rem] tabular-nums text-grafite">{formatBRL(q.total_cents)}</span>
            {q.current_version_no > 0 && <span className="text-sm">Versão {q.current_version_no}</span>}
          </span>
        }
        actions={
          <>
            <GenerateReportButton kind="orcamento" sourceId={q.id} label="Gerar PDF" icon={<FileDown aria-hidden className="size-4" />} />
            <ActionForm action={duplicateQuoteAction} submitLabel="Duplicar" submitVariant="secondary" pendingLabel="Duplicando…" className="space-y-1">
              <input type="hidden" name="quote_id" value={q.id} />
            </ActionForm>
          </>
        }
      />

      <div className="mb-10">
        <QuoteStatusRuler status={status} size="grande" stages />
      </div>

      <div className="mb-4 space-y-2">
        {feito && DONE_MESSAGE[feito] && <Notice tone="ok">{DONE_MESSAGE[feito]}</Notice>}
        {aviso && <Notice tone="alerta">{aviso}</Notice>}
        {q.status === "rascunho" && q.current_version_no > 0 && (
          <Notice tone="info">
            Em revisão: a versão {q.current_version_no} já foi enviada ao cliente.{q.status_reason ? ` Motivo: ${q.status_reason}` : ""}
          </Notice>
        )}
        {status === "expirado" && <Notice tone="alerta">Validade vencida em {formatDateBR(q.valid_until)}. Renove a validade para seguir com a proposta.</Notice>}
        {q.status === "rejeitado" && <Notice tone="erro">Recusado pelo cliente. Motivo: {q.status_reason}</Notice>}
        {q.status === "cancelado" && <Notice tone="alerta">Cancelado. Motivo: {q.status_reason}</Notice>}
        {q.status === "aprovado" && q.accepted_at && (
          <Notice tone="ok">
            Aprovado pelo cliente em {formatDateBR(isoDateInTz(new Date(q.accepted_at)))}: {q.accepted_note}
          </Notice>
        )}
      </div>

      {/* grid-cols-1: sem ela, a coluna única do celular cresce até a largura mínima da tabela de itens. */}
      <div className="grid grid-cols-1 gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-10">
          {can("editar") && options ? (
            <QuoteForm
              quoteId={q.id}
              updatedAt={q.updated_at}
              clients={options.clients}
              contactsByClient={options.contactsByClient}
              sitesByClient={options.sitesByClient}
              submitLabel="Salvar orçamento"
              items={bundle.items.map(itemRowToDraft)}
              values={{
                client_id: q.client_id,
                client_contact_id: q.client_contact_id ?? "",
                site_id: q.site_id ?? "",
                service_location_text: q.service_location_text ?? "",
                title: q.title ?? "",
                issued_at: q.issued_at,
                valid_until: q.valid_until ?? "",
                execution_deadline_text: q.execution_deadline_text ?? "",
                payment_terms: q.payment_terms ?? "",
                warranty_text: q.warranty_text ?? "",
                inclusions_text: q.inclusions_text ?? "",
                intro_text: q.intro_text ?? "",
                observations: q.observations ?? "",
                technical_notes: q.technical_notes ?? "",
                declaration_text: q.declaration_text ?? "",
              }}
            />
          ) : (
            <QuoteView bundle={bundle} />
          )}

          <QuotePhotos
            quoteId={q.id}
            role="local"
            title="Fotos do local"
            hint="Situação atual do local do serviço. Saem na página “Fotos do local” da proposta."
            photos={localPhotos}
            editable={can("fotos")}
          />
          <QuotePhotos
            quoteId={q.id}
            role="referencia"
            title="Fotos de serviços semelhantes"
            hint="Referências de serviços já realizados. Saem na página “Fotos de serviços realizados”."
            photos={referencePhotos}
            editable={can("fotos")}
          />
        </div>

        <div className="space-y-10">
          <Panel title="Situação">
            <div className="space-y-4">
              {can("enviar") && (
                <div className="space-y-2">
                  <p className="text-sm text-muted">
                    Ao marcar como enviado, itens, fotos, textos e total ficam congelados na versão {q.current_version_no + 1}. Envie o PDF ao cliente
                    pelo canal combinado.
                  </p>
                  {bundle.items.length === 0 && <Notice tone="alerta">Inclua ao menos 1 item e salve antes de enviar.</Notice>}
                  {!q.valid_until && <Notice tone="alerta">Informe a validade (“Válida até”) e salve antes de enviar.</Notice>}
                  <ActionForm action={sendQuoteAction} submitLabel="Marcar como enviado" pendingLabel="Congelando versão…">
                    <input type="hidden" name="quote_id" value={q.id} />
                  </ActionForm>
                </div>
              )}

              {can("aprovar") && (
                <div className="border-t border-linha pt-4">
                  <h3 className="mb-2 font-semibold">Aprovação do cliente</h3>
                  <ActionForm action={approveQuoteAction} submitLabel="Registrar aprovação do cliente" pendingLabel="Registrando…">
                    <input type="hidden" name="quote_id" value={q.id} />
                    <TextAreaField
                      label="Quem aprovou e como"
                      name="reason"
                      required
                      rows={2}
                      maxLength={1000}
                      hint="Ex.: síndica, por e-mail respondendo à proposta. Registro administrativo (sem assinatura eletrônica)."
                    />
                    <TextField label="Data da aprovação" name="accepted_on" type="date" required defaultValue={today} max={today} min={q.issued_at} />
                  </ActionForm>
                </div>
              )}

              {can("renovar") && (
                <div className="border-t border-linha pt-4">
                  <h3 className="mb-2 font-semibold">Renovar validade</h3>
                  <ActionForm action={renewQuoteAction} submitLabel="Renovar validade" pendingLabel="Renovando…">
                    <input type="hidden" name="quote_id" value={q.id} />
                    <TextField label="Nova validade" name="valid_until" type="date" required min={today} defaultValue={addDaysIso(today, 30)} />
                  </ActionForm>
                </div>
              )}

              <div className="flex flex-col items-start gap-2">
                {can("recusar") && (
                  <ReasonAction
                    action={rejectQuoteAction}
                    hidden={hidden}
                    label="Registrar recusa"
                    confirmLabel="Registrar recusa"
                    reasonLabel="Motivo da recusa"
                  />
                )}
                {can("revisar") && (
                  <ReasonAction
                    action={reviseQuoteAction}
                    hidden={hidden}
                    label="Revisar proposta"
                    confirmLabel="Voltar para rascunho"
                    reasonLabel="O que será revisado"
                    intro="A proposta volta para rascunho para edição. Ao reenviar, ela ganha uma nova versão; as anteriores ficam no histórico."
                  />
                )}
                {can("cancelar") && (
                  <ReasonAction
                    action={cancelQuoteAction}
                    hidden={hidden}
                    label="Cancelar orçamento"
                    confirmLabel="Confirmar cancelamento"
                    variant="danger"
                    intro="O cancelamento fica registrado com o motivo; o histórico e as versões são mantidos."
                  />
                )}
                {actions.length === 1 && <p className="text-sm text-muted">Situação final. Use “Duplicar” para montar uma nova proposta a partir desta.</p>}
              </div>
            </div>
          </Panel>

          {q.status === "aprovado" && (
            <Panel title="Obra a partir deste orçamento">
              {(createdSites.data ?? []).length > 0 ? (
                <ul className="space-y-2">
                  {(createdSites.data ?? []).map((s) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <HardHat aria-hidden className="size-4 text-acento-escuro" />
                      <Link href={`/admin/locais/${s.id}`} className="font-semibold text-info underline">
                        {s.name} ({s.code})
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    Cria só o cadastro da obra ligado a este orçamento. Nenhuma despesa, receita ou pagamento é gerado.
                  </p>
                  <ActionForm action={createSiteFromQuoteAction} submitLabel="Criar obra a partir deste orçamento" pendingLabel="Criando…">
                    <input type="hidden" name="quote_id" value={q.id} />
                    <TextField label="Nome da obra" name="name" required maxLength={200} defaultValue={q.title ?? place ?? ""} />
                    <TextField label="Código" name="code" required maxLength={40} hint="Curto e único (ex.: OBR-COB-01)." />
                    <SelectField
                      label="Tipo"
                      name="site_type"
                      required
                      placeholder=""
                      defaultValue="obra_temporaria"
                      options={[
                        { value: "obra_temporaria", label: "Obra temporária" },
                        { value: "unidade_recorrente", label: "Unidade recorrente" },
                      ]}
                    />
                    <TextField
                      label="Endereço"
                      name="address_text"
                      maxLength={500}
                      defaultValue={q.service_location_text ?? q.site?.address_text ?? ""}
                    />
                  </ActionForm>
                </div>
              )}
            </Panel>
          )}

          <Panel title="Versões">
            {(versions.data ?? []).length === 0 ? (
              <p className="text-sm text-muted">Nenhuma versão ainda. A primeira é criada ao marcar como enviado.</p>
            ) : (
              <ol className="space-y-3">
                {(versions.data ?? []).map((v) => (
                  <li key={v.id} className="border-t border-linha pt-3 first:border-t-0 first:pt-0">
                    <p className="flex items-baseline justify-between gap-4 font-semibold">
                      <span>Versão {v.version_no}</span>
                      {v.total ? <span className="tipo-condensada text-[1.0625rem] tabular-nums">{formatBRL(Number(v.total))}</span> : null}
                    </p>
                    <p className="text-sm">{v.reason}</p>
                    <p className="text-sm text-muted">
                      {formatDateTimeBR(v.created_at)} por {profiles.name(v.created_by)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-3 text-xs text-muted">O PDF de proposta enviada usa sempre a versão mais recente.</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
