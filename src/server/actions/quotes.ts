"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toActionError, type ActionState } from "@/domain/action-errors";
import { fdCaptions, fdDate, fdStr, fdUuid, fdUuids } from "@/domain/form-data";
import { newId } from "@/domain/ids";
import { readItemDrafts, validateQuoteItems } from "@/domain/quote-form";
import { requireProfile } from "@/server/auth";
import type { Database, Json } from "@/server/db/database.types";
import { errorInfo, log } from "@/server/log";
import { currentQuoteSnapshot, loadQuoteBundle } from "@/app/admin/orcamentos/data";
import { createSupabaseServer } from "@/server/supabase/server";

/**
 * Orçamentos (somente administração). Valor comercial: nunca vira despesa nem receita.
 * Cabeçalho e itens são gravados por quote_save (migração 20261108000200); mudanças de
 * situação, versões e vínculo de fotos passam pelas funções do banco (20261025001300).
 */

type SiteType = Database["public"]["Enums"]["site_type"];

function fail(error: unknown, event: string): ActionState {
  const state = toActionError(error);
  if (state.message?.startsWith("Não foi possível")) log.error(event, errorInfo(error));
  return state;
}

function refresh() {
  revalidatePath("/", "layout");
}

function invalid(fieldErrors: Record<string, string>): ActionState {
  const count = Object.keys(fieldErrors).length;
  return {
    ok: false,
    message: count === 1 ? Object.values(fieldErrors)[0] : `Confira os ${count} campos destacados.`,
    fieldErrors,
  };
}

const TEXT_FIELDS = {
  title: 200,
  service_location_text: 500,
  execution_deadline_text: 200,
  payment_terms: 1000,
  warranty_text: 300,
  inclusions_text: 2000,
  intro_text: 2000,
  observations: 4000,
  technical_notes: 4000,
  declaration_text: 4000,
} as const;

// ---------------------------------------------------------------------------
// Cabeçalho + itens
// ---------------------------------------------------------------------------

export async function saveQuoteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const quoteId = fdUuid(fd, "quote_id");
  const errors: Record<string, string> = {};

  const clientId = fdUuid(fd, "client_id");
  if (!clientId) errors.client_id = "Escolha o cliente.";
  const issuedAt = fdDate(fd, "issued_at");
  if (!issuedAt) errors.issued_at = "Informe a data de emissão.";
  const validUntil = fdDate(fd, "valid_until");
  if (fdStr(fd, "valid_until") && !validUntil) errors.valid_until = "Data inválida.";
  else if (issuedAt && validUntil && validUntil < issuedAt) errors.valid_until = "A validade não pode ser anterior à emissão.";

  const contactId = fdUuid(fd, "client_contact_id");
  const siteId = fdUuid(fd, "site_id");
  if (clientId && contactId) {
    const { data } = await db.from("client_contacts").select("client_id").eq("id", contactId).maybeSingle();
    if (data?.client_id !== clientId) errors.client_contact_id = "Escolha um contato deste cliente.";
  }
  if (clientId && siteId) {
    const { data } = await db.from("sites").select("client_id").eq("id", siteId).maybeSingle();
    if (data?.client_id !== clientId) errors.site_id = "Escolha uma obra ou unidade deste cliente.";
  }

  const texts = {} as Record<keyof typeof TEXT_FIELDS, string | null>;
  for (const [name, max] of Object.entries(TEXT_FIELDS) as Array<[keyof typeof TEXT_FIELDS, number]>) {
    const value = fdStr(fd, name);
    if (value && value.length > max) errors[name] = `Use no máximo ${max} caracteres.`;
    texts[name] = value;
  }

  const items = validateQuoteItems(readItemDrafts(fd));
  Object.assign(errors, items.fieldErrors);
  if (Object.keys(errors).length > 0) return invalid(errors);

  const header = {
    client_id: clientId!,
    client_contact_id: contactId,
    site_id: siteId,
    issued_at: issuedAt!,
    valid_until: validUntil,
    ...texts,
  };

  // Cabeçalho e itens numa transação só, com chave de idempotência (B-08): o reenvio depois de um
  // timeout não cria outro orçamento, e dois salvamentos ao mesmo tempo não duplicam itens. A
  // conferência de rascunho e de "alterado por outra pessoa" é do banco.
  const { data, error } = await db.rpc("quote_save", {
    p_client_request_id: fdUuid(fd, "client_request_id") ?? newId(),
    p_header: header,
    p_items: items.rows,
    p_quote_id: quoteId ?? undefined,
    p_expected_updated_at: fdStr(fd, "expected_updated_at") ?? undefined,
  });
  if (error || !data) return fail(error, quoteId ? "quote.update_fail" : "quote.create_fail");
  refresh();
  if (!quoteId) redirect(`/admin/orcamentos/${data.id}?feito=criado`);
  return { ok: true, message: "Orçamento salvo." };
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

export async function linkQuotePhotosAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const quoteId = fdUuid(fd, "quote_id");
  const photos = fdUuids(fd, "photo_ids");
  const role = fdStr(fd, "role");
  if (!quoteId) return { ok: false, message: "Orçamento não encontrado." };
  if (role !== "local" && role !== "referencia") return { ok: false, message: "Tipo de foto inválido." };
  if (photos.length === 0) return { ok: false, message: "Envie ao menos 1 foto.", fieldErrors: { photo_ids: "Envie ao menos 1 foto." } };
  const { error } = await db.rpc("quote_link_photos", { p_quote_id: quoteId, p_photo_ids: photos, p_role: role });
  if (error) return fail(error, "quote.photos_fail");
  const captions = fdCaptions(fd);
  if (Object.keys(captions).length > 0) await db.rpc("attachment_set_captions", { p_captions: captions });
  refresh();
  return { ok: true, message: `${photos.length} foto(s) adicionada(s) ao orçamento.` };
}

export async function unlinkQuotePhotoAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const quoteId = fdUuid(fd, "quote_id");
  const attachmentId = fdUuid(fd, "attachment_id");
  if (!quoteId || !attachmentId) return { ok: false, message: "Foto não encontrada." };
  const { error } = await db.rpc("quote_unlink_photo", { p_quote_id: quoteId, p_attachment_id: attachmentId });
  if (error) return fail(error, "quote.unlink_fail");
  refresh();
  return { ok: true, message: "Foto retirada do orçamento." };
}

// ---------------------------------------------------------------------------
// Situação (com versão congelada ao enviar, aprovar e renovar)
// ---------------------------------------------------------------------------

type Transition = "enviar" | "aprovar" | "recusar" | "cancelar" | "renovar" | "revisar";
// Aprovar não monta snapshot: o banco copia a versão enviada, que é o que o cliente aprovou (B-04).
const FREEZES: Transition[] = ["enviar", "renovar"];
const DONE: Record<Transition, string> = {
  enviar: "enviado",
  aprovar: "aprovado",
  recusar: "recusado",
  cancelar: "cancelado",
  renovar: "renovado",
  revisar: "revisao",
};

async function transition(action: Transition, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const id = fdUuid(fd, "quote_id");
  if (!id) return { ok: false, message: "Orçamento não encontrado." };

  let snapshot: Json | undefined;
  if (FREEZES.includes(action)) {
    const bundle = await loadQuoteBundle(db, id);
    if (!bundle) return { ok: false, message: "Orçamento não encontrado." };
    snapshot = (await currentQuoteSnapshot(db, bundle)) as unknown as Json;
  }
  const { error } = await db.rpc("quote_transition", {
    p_quote_id: id,
    p_action: action,
    p_reason: fdStr(fd, "reason") ?? undefined,
    p_snapshot: snapshot,
    p_valid_until: fdDate(fd, "valid_until") ?? undefined,
    p_accepted_on: fdDate(fd, "accepted_on") ?? undefined,
  });
  if (error) return fail(error, `quote.${action}_fail`);
  refresh();
  // O painel da ação muda com a situação: o aviso vai para o topo da página.
  redirect(`/admin/orcamentos/${id}?feito=${DONE[action]}`);
}

export async function sendQuoteAction(_: ActionState, fd: FormData) {
  return transition("enviar", fd);
}
export async function approveQuoteAction(_: ActionState, fd: FormData) {
  return transition("aprovar", fd);
}
export async function rejectQuoteAction(_: ActionState, fd: FormData) {
  return transition("recusar", fd);
}
export async function cancelQuoteAction(_: ActionState, fd: FormData) {
  return transition("cancelar", fd);
}
export async function renewQuoteAction(_: ActionState, fd: FormData) {
  return transition("renovar", fd);
}
export async function reviseQuoteAction(_: ActionState, fd: FormData) {
  return transition("revisar", fd);
}

// ---------------------------------------------------------------------------
// Duplicar e criar obra
// ---------------------------------------------------------------------------

export async function duplicateQuoteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const id = fdUuid(fd, "quote_id");
  if (!id) return { ok: false, message: "Orçamento não encontrado." };
  const { data, error } = await db.rpc("quote_duplicate", { p_quote_id: id });
  if (error || !data) return fail(error, "quote.duplicate_fail");
  refresh();
  redirect(`/admin/orcamentos/${data.id}?feito=duplicado`);
}

const SITE_TYPES: SiteType[] = ["obra_temporaria", "unidade_recorrente"];

/** Ação explícita do admin (R-68): cria só o local/obra ligado ao orçamento — nunca despesas ou pagamentos. */
export async function createSiteFromQuoteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const profile = await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const id = fdUuid(fd, "quote_id");
  const name = fdStr(fd, "name");
  const code = fdStr(fd, "code");
  const siteType = fdStr(fd, "site_type") as SiteType | null;
  const errors: Record<string, string> = {};
  if (!name) errors.name = "Informe o nome da obra.";
  else if (name.length > 200) errors.name = "Use no máximo 200 caracteres.";
  if (!code) errors.code = "Informe o código.";
  else if (code.length > 40) errors.code = "Use no máximo 40 caracteres.";
  if (!siteType || !SITE_TYPES.includes(siteType)) errors.site_type = "Escolha o tipo.";
  if (!id) return { ok: false, message: "Orçamento não encontrado." };
  if (Object.keys(errors).length > 0) return invalid(errors);

  const { data: quote } = await db.from("quotes").select("id, status, client_id, service_location_text").eq("id", id).maybeSingle();
  if (!quote) return { ok: false, message: "Orçamento não encontrado." };
  if (quote.status !== "aprovado") return { ok: false, message: "Só um orçamento aprovado pode gerar uma obra." };
  // Uma obra por orçamento (índice sites_quote_uidx): clique repetido ou outra aba levam à obra que já existe.
  const { data: existing } = await db.from("sites").select("id").eq("quote_id", id).limit(1).maybeSingle();
  if (existing) redirect(`/admin/locais/${existing.id}`);

  const { data, error } = await db
    .from("sites")
    .insert({
      client_id: quote.client_id,
      name: name!,
      code: code!,
      site_type: siteType!,
      address_text: fdStr(fd, "address_text") ?? quote.service_location_text,
      quote_id: quote.id,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    if (error.message.includes("sites_quote_uidx")) {
      const { data: created } = await db.from("sites").select("id").eq("quote_id", id).maybeSingle();
      if (created) redirect(`/admin/locais/${created.id}`);
    }
    return invalid({ code: "Já existe um local com este código." });
  }
  if (error || !data) return fail(error, "quote.site_fail");
  refresh();
  redirect(`/admin/locais/${data.id}`);
}
