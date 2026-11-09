"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toActionError, type ActionState } from "@/domain/action-errors";
import { formatDateBR, todayIso } from "@/domain/dates";
import { fdBool, fdStr, fdUuid, fdUuids } from "@/domain/form-data";
import {
  CATALOGS,
  CLIENT_DOCUMENT_UNIQUE,
  catalogBySlug,
  friendlyUniqueViolation,
  guardSelfChange,
  parseAreaForm,
  parseCatalogForm,
  parseClientForm,
  parseContactForm,
  parseMembershipForm,
  parsePasswordForm,
  parseSettingsForm,
  parseSiteForm,
  parseUserForm,
  type CatalogDef,
  type FieldErrors,
  type UniqueRule,
} from "@/domain/registry";
import { requireProfile } from "@/server/auth";
import { env } from "@/server/env";
import { errorInfo, log } from "@/server/log";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { createSupabaseServer, type ServerDb } from "@/server/supabase/server";

/*
 * Cadastros da administração. Escritas comuns usam a sessão do usuário (RLS de admin);
 * o cliente service_role entra só na API administrativa do Auth e no INSERT de profiles
 * (a tabela não tem policy de inserção). Nada aqui exclui usuários, perfis ou catálogos.
 */

const UNIQUE_RULES: UniqueRule[] = [
  CLIENT_DOCUMENT_UNIQUE,
  { constraint: "sites_code_key", field: "code", message: "Já existe um local com este código. Escolha outro." },
  { constraint: "site_areas_site_id_name_key", field: "name", message: "Já existe um setor ou ambiente com este nome neste local." },
  { constraint: "site_memberships_open_uidx", field: "profile_id", message: "Esta pessoa já tem acesso a este local." },
  ...CATALOGS.map((c) => ({ constraint: `${c.table}_name_key`, field: "name", message: "Já existe um item com este nome neste catálogo." })),
];

/** Banimento longo no Auth (≈100 anos): bloqueia login e renovação de sessão do usuário inativado. */
const BAN_FOREVER = "876000h";

function fail(error: unknown, event: string): ActionState {
  const unique = friendlyUniqueViolation(error, UNIQUE_RULES);
  if (unique) return unique;
  const code = (error as { code?: string } | null)?.code;
  if (code === "42501") {
    log.warn(event, errorInfo(error));
    return { ok: false, message: "Você não tem permissão para esta alteração." };
  }
  if (code === "23514" || code === "23502") {
    log.warn(event, errorInfo(error));
    return { ok: false, message: "Algum dado está fora do permitido. Confira os campos e tente de novo." };
  }
  const state = toActionError(error);
  if (state.message?.startsWith("Não foi possível")) log.error(event, errorInfo(error));
  return state;
}

function invalid(fieldErrors: FieldErrors): ActionState {
  const messages = Object.values(fieldErrors);
  return { ok: false, message: messages.length === 1 ? messages[0] : "Confira os campos destacados.", fieldErrors };
}

const notFound = (what: string): ActionState => ({ ok: false, message: `${what} não encontrado. Atualize a página.` });

function refresh() {
  revalidatePath("/", "layout");
}

async function adminDb() {
  const profile = await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  return { profile, db };
}

/** Próxima posição da lista quando o campo "ordem" fica em branco. */
async function nextSortOrder(query: PromiseLike<{ data: Array<{ sort_order: number }> | null }>): Promise<number> {
  const { data } = await query;
  return (data?.[0]?.sort_order ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export async function createClientAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { profile, db } = await adminDb();
  const parsed = parseClientForm(fd);
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const { data, error } = await db
    .from("clients")
    .insert({ ...parsed.values, created_by: profile.id })
    .select("id")
    .single();
  if (error || !data) return fail(error, "client.create_fail");
  refresh();
  redirect(`/admin/clientes/${data.id}?feito=criado`);
}

export async function updateClientAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await adminDb();
  const id = fdUuid(fd, "client_id");
  if (!id) return notFound("Cliente");
  const parsed = parseClientForm(fd);
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const { data, error } = await db.from("clients").update(parsed.values).eq("id", id).select("id");
  if (error) return fail(error, "client.update_fail");
  if (!data?.length) return notFound("Cliente");
  refresh();
  return { ok: true, message: "Dados do cliente salvos." };
}

export async function setClientActiveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await adminDb();
  const id = fdUuid(fd, "client_id");
  if (!id) return notFound("Cliente");
  const active = fdBool(fd, "active");
  const { data, error } = await db.from("clients").update({ is_active: active }).eq("id", id).select("id");
  if (error) return fail(error, "client.active_fail");
  if (!data?.length) return notFound("Cliente");
  refresh();
  redirect(`/admin/clientes/${id}?feito=${active ? "ativado" : "desativado"}`);
}

// ---------------------------------------------------------------------------
// Responsáveis do cliente (pessoas SEM login: o login do cliente é decisão pendente, Q1)
// ---------------------------------------------------------------------------

/** Mantém abertos em client_contact_sites exatamente os locais escolhidos (todos do mesmo cliente). */
async function syncContactSites(db: ServerDb, contactId: string, clientId: string, wanted: string[]): Promise<ActionState | null> {
  if (wanted.length > 0) {
    const { data: valid } = await db.from("sites").select("id").eq("client_id", clientId).in("id", wanted);
    if ((valid ?? []).length !== wanted.length) {
      return invalid({ site_ids: "Escolha apenas locais deste cliente." });
    }
  }
  const { data: current, error: readErr } = await db
    .from("client_contact_sites")
    .select("site_id")
    .eq("client_contact_id", contactId)
    .is("ended_at", null);
  if (readErr) return fail(readErr, "contact.sites_read_fail");
  const have = new Set((current ?? []).map((c) => c.site_id));
  const toAdd = wanted.filter((s) => !have.has(s));
  const toRemove = [...have].filter((s) => !wanted.includes(s));
  if (toAdd.length > 0) {
    // Upsert reabre um vínculo encerrado antes (a trilha guarda o período anterior).
    const { error } = await db
      .from("client_contact_sites")
      .upsert(
        toAdd.map((site_id) => ({ client_contact_id: contactId, site_id, ended_at: null })),
        { onConflict: "client_contact_id,site_id" },
      );
    if (error) return fail(error, "contact.sites_add_fail");
  }
  if (toRemove.length > 0) {
    // Vínculo encerrado com data, não apagado: inclusão, encerramento e reabertura ficam em audit_events.
    const { error } = await db
      .from("client_contact_sites")
      .update({ ended_at: new Date().toISOString() })
      .eq("client_contact_id", contactId)
      .in("site_id", toRemove)
      .is("ended_at", null);
    if (error) return fail(error, "contact.sites_remove_fail");
  }
  return null;
}

export async function createContactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await adminDb();
  const clientId = fdUuid(fd, "client_id");
  if (!clientId) return notFound("Cliente");
  const parsed = parseContactForm(fd);
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const { site_ids, ...values } = parsed.values;
  const { data, error } = await db
    .from("client_contacts")
    .insert({ ...values, client_id: clientId })
    .select("id")
    .single();
  if (error || !data) return fail(error, "contact.create_fail");
  const linkErr = await syncContactSites(db, data.id, clientId, site_ids);
  refresh();
  if (linkErr) return { ok: false, message: `Responsável cadastrado, mas os locais não foram vinculados: ${linkErr.message} Edite o cadastro para corrigir.` };
  return { ok: true, message: `${values.name} cadastrado(a) como responsável do cliente.` };
}

export async function updateContactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await adminDb();
  const id = fdUuid(fd, "contact_id");
  if (!id) return notFound("Responsável");
  const { data: contact } = await db.from("client_contacts").select("id, client_id, anonymized_at").eq("id", id).maybeSingle();
  if (!contact) return notFound("Responsável");
  if (contact.anonymized_at) return { ok: false, message: "Este contato foi anonimizado e não pode mais ser editado." };
  const parsed = parseContactForm(fd);
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const { site_ids, ...values } = parsed.values;
  const { error } = await db.from("client_contacts").update(values).eq("id", id);
  if (error) return fail(error, "contact.update_fail");
  const linkErr = await syncContactSites(db, id, contact.client_id, site_ids);
  refresh();
  if (linkErr) return linkErr;
  return { ok: true, message: "Responsável atualizado." };
}

export async function setContactActiveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await adminDb();
  const id = fdUuid(fd, "contact_id");
  if (!id) return notFound("Responsável");
  const active = fdBool(fd, "active");
  const { data, error } = await db.from("client_contacts").update({ is_active: active }).eq("id", id).is("anonymized_at", null).select("id");
  if (error) return fail(error, "contact.active_fail");
  if (!data?.length) return { ok: false, message: "Contato não encontrado ou já anonimizado." };
  refresh();
  return { ok: true, message: active ? "Responsável reativado." : "Responsável desativado." };
}

/** LGPD: apaga os dados pessoais do contato, mantendo o registro (chamados antigos continuam apontando para ele). */
export async function anonymizeContactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await adminDb();
  const id = fdUuid(fd, "contact_id");
  if (!id) return notFound("Responsável");
  const { data, error } = await db
    .from("client_contacts")
    .update({ name: "Contato removido", email: null, phone: null, role_title: null, is_active: false, anonymized_at: new Date().toISOString() })
    .eq("id", id)
    .is("anonymized_at", null)
    .select("id");
  if (error) return fail(error, "contact.anonymize_fail");
  if (!data?.length) return { ok: false, message: "Contato não encontrado ou já anonimizado." };
  log.info("contact.anonymized", { id });
  refresh();
  return { ok: true, message: "Dados pessoais removidos. O contato aparece como “Contato removido”." };
}

// ---------------------------------------------------------------------------
// Locais (obras e unidades)
// ---------------------------------------------------------------------------

export async function createSiteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { profile, db } = await adminDb();
  const clientId = fdUuid(fd, "client_id");
  if (!clientId) return notFound("Cliente");
  const { data: client } = await db.from("clients").select("id, is_active").eq("id", clientId).maybeSingle();
  if (!client) return notFound("Cliente");
  if (!client.is_active) return { ok: false, message: "Cliente desativado. Reative o cliente antes de cadastrar locais." };
  const parsed = parseSiteForm(fd);
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const { data, error } = await db
    .from("sites")
    .insert({ ...parsed.values, client_id: clientId, created_by: profile.id })
    .select("id")
    .single();
  if (error || !data) return fail(error, "site.create_fail");
  refresh();
  redirect(`/admin/locais/${data.id}?feito=criado`);
}

export async function updateSiteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await adminDb();
  const id = fdUuid(fd, "site_id");
  if (!id) return notFound("Local");
  const parsed = parseSiteForm(fd);
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const { data, error } = await db.from("sites").update(parsed.values).eq("id", id).select("id");
  if (error) return fail(error, "site.update_fail");
  if (!data?.length) return notFound("Local");
  refresh();
  return { ok: true, message: "Dados do local salvos." };
}

// ---------------------------------------------------------------------------
// Setores e ambientes
// ---------------------------------------------------------------------------

export async function createAreaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await adminDb();
  const siteId = fdUuid(fd, "site_id");
  if (!siteId) return notFound("Local");
  const parsed = parseAreaForm(fd);
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const sortOrder =
    fdStr(fd, "sort_order") === null
      ? await nextSortOrder(db.from("site_areas").select("sort_order").eq("site_id", siteId).order("sort_order", { ascending: false }).limit(1))
      : parsed.values.sort_order;
  const { error } = await db.from("site_areas").insert({ site_id: siteId, name: parsed.values.name, sort_order: sortOrder });
  if (error) return fail(error, "area.create_fail");
  refresh();
  return { ok: true, message: `Setor “${parsed.values.name}” adicionado.` };
}

export async function updateAreaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await adminDb();
  const id = fdUuid(fd, "area_id");
  if (!id) return notFound("Setor");
  const parsed = parseAreaForm(fd);
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const { data, error } = await db.from("site_areas").update(parsed.values).eq("id", id).select("id");
  if (error) return fail(error, "area.update_fail");
  if (!data?.length) return notFound("Setor");
  refresh();
  return { ok: true, message: "Setor atualizado." };
}

export async function setAreaActiveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await adminDb();
  const id = fdUuid(fd, "area_id");
  if (!id) return notFound("Setor");
  const active = fdBool(fd, "active");
  const { data, error } = await db.from("site_areas").update({ is_active: active }).eq("id", id).select("id");
  if (error) return fail(error, "area.active_fail");
  if (!data?.length) return notFound("Setor");
  refresh();
  return { ok: true, message: active ? "Setor reativado." : "Setor desativado." };
}

// ---------------------------------------------------------------------------
// Equipe com acesso ao local (site_memberships: nunca excluídas, só encerradas)
// ---------------------------------------------------------------------------

export async function addMembershipAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { profile, db } = await adminDb();
  const siteId = fdUuid(fd, "site_id");
  if (!siteId) return notFound("Local");
  const parsed = parseMembershipForm(fd, todayIso());
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const { data: person } = await db.from("profiles").select("id, full_name, role, is_active").eq("id", parsed.values.profile_id).maybeSingle();
  if (!person || !person.is_active || (person.role !== "worker" && person.role !== "foreman")) {
    return invalid({ profile_id: "Escolha um funcionário ou encarregado com acesso ativo." });
  }
  const { error } = await db.from("site_memberships").insert({ ...parsed.values, site_id: siteId, created_by: profile.id });
  if (error) return fail(error, "membership.add_fail");
  refresh();
  return { ok: true, message: `${person.full_name} agora tem acesso a este local.` };
}

export async function endMembershipAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await adminDb();
  const id = fdUuid(fd, "membership_id");
  if (!id) return notFound("Acesso");
  const today = todayIso();
  const { data: m } = await db.from("site_memberships").select("id, active_from, active_to").eq("id", id).maybeSingle();
  if (!m) return notFound("Acesso");
  if (m.active_to) return { ok: false, message: "Este acesso já foi encerrado." };
  if (m.active_from > today) return { ok: false, message: `Este acesso só começa em ${formatDateBR(m.active_from)}.` };
  const { error } = await db.from("site_memberships").update({ active_to: today }).eq("id", id).is("active_to", null);
  if (error) return fail(error, "membership.end_fail");
  refresh();
  return { ok: true, message: "Acesso encerrado. O histórico do vínculo continua registrado." };
}

// ---------------------------------------------------------------------------
// Usuários (Auth + profiles). Nunca excluídos: inativação preserva as autorias.
// ---------------------------------------------------------------------------

type AuthErr = { code?: string; status?: number; message?: string } | null;

function authFail(error: AuthErr, event: string): ActionState {
  const code = error?.code ?? "";
  if (code === "email_exists" || code === "user_already_exists" || /already been registered/i.test(error?.message ?? "")) {
    return invalid({ email: "Já existe um usuário com este e-mail." });
  }
  if (code === "weak_password") return invalid({ password: "Senha fraca. Use ao menos 8 caracteres, misturando letras e números." });
  if (code === "email_address_invalid") return invalid({ email: "Informe um e-mail válido." });
  if (code === "over_email_send_rate_limit" || error?.status === 429) {
    return { ok: false, message: "Muitos e-mails enviados em pouco tempo. Tente de novo mais tarde." };
  }
  log.error(event, { code, status: error?.status, message: error?.message });
  return { ok: false, message: "Não foi possível concluir a operação. Tente novamente." };
}

type AuthAuditAction = "auth_criar" | "auth_convidar" | "auth_bloquear" | "auth_reativar" | "auth_senha_provisoria" | "auth_link_senha";

/**
 * Trilha das ações feitas na API do Auth (que não passa pelos gatilhos do banco), com a sessão do
 * admin como autor. Chamada depois da ação no Auth; se falhar, vai para o log e a ação não é desfeita.
 */
async function auditAuth(db: ServerDb, profileId: string, action: AuthAuditAction) {
  const { error } = await db.rpc("audit_admin_action", { p_entity: "profiles", p_entity_id: profileId, p_action: action });
  if (error) log.error("user.audit_fail", { profileId, action, ...errorInfo(error) });
}

export async function createUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await adminDb();
  // Senha em branco = convite por e-mail: a pessoa cria a própria senha pelo link (ninguém mais a conhece).
  // Senha preenchida = senha provisória, para quem não consegue usar o e-mail no momento.
  const parsed = parseUserForm(fd, { requirePassword: false });
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const { full_name, email, phone, role, password } = parsed.values;

  const admin = createSupabaseAdmin();
  const created = password
    ? await admin.auth.admin.createUser({ email: email!, password, email_confirm: true })
    : await admin.auth.admin.inviteUserByEmail(email!, { redirectTo: `${env.appUrl}/redefinir-senha?convite=1` });
  if (created.error || !created.data.user) return authFail(created.error, "user.create_auth_fail");
  const userId = created.data.user.id;

  const { error } = await admin.from("profiles").insert({ id: userId, full_name, email: email!, phone, role, is_active: true });
  if (error) {
    // Desfaz SÓ a conta recém-criada e ainda sem perfil (nenhuma autoria ligada a ela);
    // sem isso, um novo envio esbarraria em "e-mail já cadastrado" sem perfil para editar.
    const rollback = await admin.auth.admin.deleteUser(userId);
    if (rollback.error) log.error("user.create_rollback_fail", { userId, message: rollback.error.message });
    return fail(error, "user.create_profile_fail");
  }
  await auditAuth(db, userId, password ? "auth_criar" : "auth_convidar");
  log.info(password ? "user.created" : "user.invited", { userId, role });
  refresh();
  redirect(`/admin/usuarios/${userId}?feito=${password ? "criado" : "convidado"}`);
}

export async function updateUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { profile, db } = await adminDb();
  const id = fdUuid(fd, "profile_id");
  if (!id) return notFound("Usuário");
  const parsed = parseUserForm(fd, { requirePassword: false, requireEmail: false });
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const blocked = guardSelfChange({ actorId: profile.id, targetId: id, nextRole: parsed.values.role });
  if (blocked) return invalid({ role: blocked });
  const { full_name, phone, role } = parsed.values;
  const { data, error } = await db.from("profiles").update({ full_name, phone, role }).eq("id", id).select("id");
  if (error) return fail(error, "user.update_fail");
  if (!data?.length) return notFound("Usuário");
  refresh();
  return { ok: true, message: "Dados do usuário salvos." };
}

export async function setUserActiveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { profile, db } = await adminDb();
  const id = fdUuid(fd, "profile_id");
  if (!id) return notFound("Usuário");
  const active = fdBool(fd, "active");
  const blocked = guardSelfChange({ actorId: profile.id, targetId: id, nextActive: active });
  if (blocked) return { ok: false, message: blocked };

  // 1º o perfil (RLS e telas cortam o acesso na hora); 2º o Auth (bloqueia login e renovação de sessão).
  const { data, error } = await db
    .from("profiles")
    .update(active ? { is_active: true, deactivated_at: null } : { is_active: false, deactivated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return fail(error, "user.active_fail");
  if (!data?.length) return notFound("Usuário");

  const ban = await createSupabaseAdmin().auth.admin.updateUserById(id, { ban_duration: active ? "none" : BAN_FOREVER });
  refresh();
  if (ban.error) {
    log.error("user.ban_fail", { id, active, message: ban.error.message });
    return {
      ok: false,
      message: active
        ? "Perfil reativado, mas o login continua bloqueado no serviço de autenticação. Desative e reative de novo em instantes."
        : "Acesso desativado no sistema, mas o bloqueio de login no serviço de autenticação falhou. Reative e desative de novo em instantes.",
    };
  }
  await auditAuth(db, id, active ? "auth_reativar" : "auth_bloquear");
  log.info(active ? "user.reactivated" : "user.deactivated", { id });
  redirect(`/admin/usuarios/${id}?feito=${active ? "ativado" : "desativado"}`);
}

export async function sendPasswordLinkAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await adminDb();
  const id = fdUuid(fd, "profile_id");
  if (!id) return notFound("Usuário");
  const { data: person } = await db.from("profiles").select("email, is_active").eq("id", id).maybeSingle();
  if (!person) return notFound("Usuário");
  if (!person.is_active) return { ok: false, message: "Reative o acesso antes de enviar o link." };
  const { error } = await db.auth.resetPasswordForEmail(person.email, {
    redirectTo: `${env.appUrl}/auth/callback?next=/redefinir-senha`,
  });
  if (error) return authFail(error, "user.reset_link_fail");
  await auditAuth(db, id, "auth_link_senha");
  return { ok: true, message: `Link enviado para ${person.email}. Ele vale por 1 hora.` };
}

export async function setTemporaryPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await adminDb();
  const id = fdUuid(fd, "profile_id");
  if (!id) return notFound("Usuário");
  const parsed = parsePasswordForm(fd);
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const { data: person } = await db.from("profiles").select("id").eq("id", id).maybeSingle();
  if (!person) return notFound("Usuário");
  const { error } = await createSupabaseAdmin().auth.admin.updateUserById(id, { password: parsed.values.password });
  if (error) return authFail(error, "user.temp_password_fail");
  await auditAuth(db, id, "auth_senha_provisoria");
  log.info("user.temp_password_set", { id });
  return { ok: true, message: "Senha provisória definida. Informe a pessoa por um canal seguro e peça para trocá-la." };
}

// ---------------------------------------------------------------------------
// Configurações da empresa (linha única id = 1)
// ---------------------------------------------------------------------------

export async function updateSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { profile, db } = await adminDb();
  const parsed = parseSettingsForm(fd);
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const { data, error } = await db
    .from("company_settings")
    .update({ ...parsed.values, updated_by: profile.id })
    .eq("id", 1)
    .select("id");
  if (error) return fail(error, "settings.update_fail");
  if (!data?.length) return { ok: false, message: "Configurações não encontradas." };
  refresh();
  return { ok: true, message: "Configurações salvas." };
}

/** Logo e assinatura: anexos já enviados ao bucket privado "branding" pelo MediaUploader. */
export async function updateBrandingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { profile, db } = await adminDb();
  const logoId = fdUuids(fd, "logo_ids").at(-1) ?? null;
  const signatureId = fdUuids(fd, "signature_ids").at(-1) ?? null;
  const removeLogo = fdBool(fd, "remove_logo");
  const removeSignature = fdBool(fd, "remove_signature");

  const ids = [logoId, signatureId].filter((v): v is string => !!v);
  if (ids.length > 0) {
    const { data: atts } = await db.from("attachments").select("id, bucket, mime_type, revoked_at").in("id", ids);
    const ok = (id: string) => (atts ?? []).some((a) => a.id === id && a.bucket === "branding" && a.mime_type.startsWith("image/") && !a.revoked_at);
    if (logoId && !ok(logoId)) return invalid({ logo_ids: "Envie o logotipo novamente." });
    if (signatureId && !ok(signatureId)) return invalid({ signature_ids: "Envie a assinatura novamente." });
  }

  const patch: { logo_attachment_id?: string | null; signature_attachment_id?: string | null; updated_by: string } = { updated_by: profile.id };
  if (logoId) patch.logo_attachment_id = logoId;
  else if (removeLogo) patch.logo_attachment_id = null;
  if (signatureId) patch.signature_attachment_id = signatureId;
  else if (removeSignature) patch.signature_attachment_id = null;
  if (!("logo_attachment_id" in patch) && !("signature_attachment_id" in patch)) {
    return { ok: false, message: "Envie uma imagem ou marque o que deseja remover." };
  }
  const { error } = await db.from("company_settings").update(patch).eq("id", 1);
  if (error) return fail(error, "settings.branding_fail");
  refresh();
  return { ok: true, message: "Imagens dos documentos atualizadas." };
}

// ---------------------------------------------------------------------------
// Catálogos editáveis
// ---------------------------------------------------------------------------

/** Catálogos de forma simples (nome + ordem): o tipo é o mesmo em todas essas tabelas. */
type SimpleCatalog = "service_categories";

function catalogFrom(fd: FormData): CatalogDef | null {
  return catalogBySlug(fdStr(fd, "catalog") ?? "");
}

export async function createCatalogItemAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await adminDb();
  const def = catalogFrom(fd);
  if (!def) return { ok: false, message: "Catálogo inválido." };
  const parsed = parseCatalogForm(fd, def);
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const values = { ...parsed.values };
  if (fdStr(fd, "sort_order") === null) {
    values.sort_order = await nextSortOrder(
      db.from(def.table as SimpleCatalog).select("sort_order").order("sort_order", { ascending: false }).limit(1),
    );
  }
  const { error } =
    def.extra === "priority"
      ? await db.from("priority_definitions").insert(values as { name: string; sort_order: number; level: number; sla_days: number | null })
      : def.extra === "supplier"
        ? await db.from("suppliers").insert(values)
        : await db.from(def.table as SimpleCatalog).insert(values);
  if (error) return fail(error, "catalog.create_fail");
  refresh();
  return { ok: true, message: `“${values.name}” adicionado(a) em ${def.title.toLowerCase()}.` };
}

export async function updateCatalogItemAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await adminDb();
  const def = catalogFrom(fd);
  const id = fdUuid(fd, "item_id");
  if (!def || !id) return { ok: false, message: "Item inválido. Atualize a página." };
  const parsed = parseCatalogForm(fd, def);
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const { data, error } =
    def.extra === "priority"
      ? await db.from("priority_definitions").update(parsed.values).eq("id", id).select("id")
      : def.extra === "supplier"
        ? await db.from("suppliers").update(parsed.values).eq("id", id).select("id")
        : await db.from(def.table as SimpleCatalog).update(parsed.values).eq("id", id).select("id");
  if (error) return fail(error, "catalog.update_fail");
  if (!data?.length) return notFound("Item");
  refresh();
  return { ok: true, message: "Item atualizado." };
}

export async function setCatalogItemActiveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await adminDb();
  const def = catalogFrom(fd);
  const id = fdUuid(fd, "item_id");
  if (!def || !id) return { ok: false, message: "Item inválido. Atualize a página." };
  const active = fdBool(fd, "active");
  const { data, error } = await db
    .from(def.table as SimpleCatalog)
    .update({ is_active: active })
    .eq("id", id)
    .select("id");
  if (error) return fail(error, "catalog.active_fail");
  if (!data?.length) return notFound("Item");
  refresh();
  return { ok: true, message: active ? "Item reativado." : "Item desativado. Ele some das listas de escolha, mas o histórico continua." };
}
