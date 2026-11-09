import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDateTimeBR } from "@/domain/dates";
import { CATALOGS } from "@/domain/registry";
import { updateBrandingAction, updateSettingsAction } from "@/server/actions/registry";
import { loadProfiles } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { ActionForm, CheckboxField, TextAreaField, TextField } from "@/ui/form";
import { MediaUploader } from "@/ui/media-uploader";
import { Notice, PageHeader, Panel, RowList } from "@/ui/page";

export const metadata: Metadata = { title: "Configurações" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-5 border-t border-linha pt-5 first:border-t-0 first:pt-0">
      <legend className="float-left mb-1 w-full text-base font-bold">{title}</legend>
      <div className="clear-both space-y-5">{children}</div>
    </fieldset>
  );
}

function CurrentImage({ id, label }: { id: string | null; label: string }) {
  if (!id) return <p className="text-sm text-muted">{label}: nenhuma imagem enviada.</p>;
  return (
    <figure className="space-y-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/files/${id}?v=thumb`} alt={`${label} atual`} className="max-h-28 rounded-ctl border border-linha bg-papel object-contain p-2" />
      <figcaption className="text-sm text-muted">{label} atual</figcaption>
    </figure>
  );
}

export default async function SettingsPage() {
  const db = await createSupabaseServer();
  const [{ data: s }, profiles, ...counts] = await Promise.all([
    db.from("company_settings").select("*").eq("id", 1).single(),
    loadProfiles(db),
    ...CATALOGS.map((c) => db.from(c.table as "service_categories").select("id", { count: "exact", head: true }).eq("is_active", true)),
  ]);
  if (!s) return <Notice tone="erro">Configurações da empresa não encontradas. Rode as migrações do banco.</Notice>;

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Dados da empresa que aparecem nos relatórios e orçamentos, limites de envio de arquivos e listas de escolha."
      />

      <div className="mb-5">
        <Notice tone="alerta">
          Os documentos de referência trazem dados divergentes (endereço, site, CNPJ, CREA). Confirme os dados oficiais antes de emitir
          relatórios.
        </Notice>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Dados da empresa e dos documentos">
          <p className="mb-5 text-sm text-muted">
            Última alteração em {formatDateTimeBR(s.updated_at)}
            {s.updated_by ? ` por ${profiles.name(s.updated_by)}` : ""}.
          </p>
          <ActionForm action={updateSettingsAction} submitLabel="Salvar configurações" stickySubmit>
            <Section title="Empresa">
              <TextField label="Nome fantasia" name="trade_name" required maxLength={120} defaultValue={s.trade_name} />
              <TextField label="Razão social" name="legal_name" maxLength={200} defaultValue={s.legal_name} />
              <TextField label="CNPJ" name="cnpj" inputMode="numeric" maxLength={30} defaultValue={s.cnpj ?? ""} />
              <TextAreaField label="Endereço" name="address_text" rows={2} maxLength={500} defaultValue={s.address_text ?? ""} />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="Telefone" name="phone" type="tel" maxLength={40} defaultValue={s.phone ?? ""} />
                <TextField label="E-mail" name="email" type="email" maxLength={200} defaultValue={s.email ?? ""} />
              </div>
              <TextField label="Site" name="website" maxLength={200} defaultValue={s.website ?? ""} hint="Ex.: www.empresa.com.br" />
            </Section>

            <Section title="Responsável técnico">
              <TextField label="Nome do responsável técnico" name="technical_manager_name" maxLength={160} defaultValue={s.technical_manager_name ?? ""} />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="Título" name="technical_manager_title" maxLength={120} defaultValue={s.technical_manager_title ?? ""} hint="Ex.: Eng. Civil" />
                <TextField label="CREA" name="crea" maxLength={60} defaultValue={s.crea ?? ""} />
              </div>
            </Section>

            <Section title="Relatórios mensais">
              <TextAreaField
                label="Objetivo padrão do relatório"
                name="report_objective_text"
                required
                rows={3}
                maxLength={2000}
                defaultValue={s.report_objective_text}
              />
              <TextField label="Cidade do encerramento" name="report_city" maxLength={120} defaultValue={s.report_city ?? ""} hint="Ex.: Goiânia (aparece em “Goiânia, 30 de setembro de 2026”)." />
              <TextAreaField label="Rodapé dos relatórios" name="report_footer_text" rows={2} maxLength={1000} defaultValue={s.report_footer_text ?? ""} />
            </Section>

            <Section title="Orçamentos">
              <TextAreaField label="Texto de abertura" name="quote_intro_text" required rows={2} maxLength={2000} defaultValue={s.quote_intro_text} />
              <TextAreaField label="Declaração padrão" name="quote_declaration_text" rows={4} maxLength={4000} defaultValue={s.quote_declaration_text ?? ""} />
            </Section>

            <Section title="Envio de arquivos e registros">
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="Tamanho máximo de foto (MB)" name="max_image_mb" type="number" required min={1} max={100} defaultValue={s.max_image_mb} />
                <TextField label="Tamanho máximo de PDF (MB)" name="max_pdf_mb" type="number" required min={1} max={100} defaultValue={s.max_pdf_mb} />
                <TextField
                  label="Arquivos por envio"
                  name="max_files_per_upload"
                  type="number"
                  required
                  min={1}
                  max={100}
                  defaultValue={s.max_files_per_upload}
                />
                <TextField
                  label="Dias para registrar atividade atrasada"
                  name="activity_backdate_limit_days"
                  type="number"
                  required
                  min={0}
                  max={365}
                  defaultValue={s.activity_backdate_limit_days}
                  hint="Quantos dias para trás a equipe de campo pode lançar."
                />
              </div>
            </Section>

            <Section title="Guarda de dados (LGPD)">
              <TextAreaField
                label="Política de retenção"
                name="retention_policy"
                rows={3}
                maxLength={4000}
                defaultValue={s.retention_policy ?? ""}
                hint="Por quanto tempo fotos, comprovantes e dados de contato ficam guardados."
              />
            </Section>
          </ActionForm>
        </Panel>

        <div className="min-w-0 space-y-5">
          <Panel title="Logotipo e assinatura">
            <p className="mb-4 text-sm text-muted">Usados no cabeçalho e no encerramento dos relatórios e orçamentos em PDF.</p>
            <div className="mb-5 grid grid-cols-2 gap-4">
              <CurrentImage id={s.logo_attachment_id} label="Logotipo" />
              <CurrentImage id={s.signature_attachment_id} label="Assinatura" />
            </div>
            <ActionForm action={updateBrandingAction} submitLabel="Salvar imagens" resetOnSuccess>
              <MediaUploader name="logo_ids" label="Novo logotipo" purpose="logo" max={1} hint="Use fundo claro." />
              <MediaUploader name="signature_ids" label="Nova assinatura digitalizada" purpose="logo" max={1} />
              {s.logo_attachment_id && <CheckboxField label="Remover o logotipo atual" name="remove_logo" />}
              {s.signature_attachment_id && <CheckboxField label="Remover a assinatura atual" name="remove_signature" />}
            </ActionForm>
          </Panel>

          <Panel title="Listas de escolha">
            <p className="mb-3 text-sm text-muted">Itens não são excluídos: desative o que não usa mais e o histórico continua igual.</p>
            <RowList>
              {CATALOGS.map((c, i) => (
                <li key={c.slug}>
                  <Link href={`/admin/configuracoes/catalogos/${c.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-concreto/60">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{c.title}</p>
                      <p className="text-sm text-muted">{c.description}</p>
                    </div>
                    <span className="text-sm text-muted">{counts[i]?.count ?? 0} ativo(s)</span>
                    <ChevronRight aria-hidden className="size-5 text-muted" />
                  </Link>
                </li>
              ))}
            </RowList>
          </Panel>
        </div>
      </div>
    </>
  );
}
