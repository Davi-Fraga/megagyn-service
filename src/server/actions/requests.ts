"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toActionError, type ActionState } from "@/domain/action-errors";
import { fdBool, fdCaptions, fdDate, fdNumber, fdStr, fdUuid, fdUuids } from "@/domain/form-data";
import { newId } from "@/domain/ids";
import { actionReturnPath } from "@/domain/safe-redirect";
import { requireProfile } from "@/server/auth";
import { errorInfo, log } from "@/server/log";
import { createSupabaseServer, type ServerDb } from "@/server/supabase/server";
import type { Database } from "@/server/db/database.types";

type Enums = Database["public"]["Enums"];

/** Campo obrigatório ausente vai como null: a função do banco devolve a mensagem amigável com o campo. */
const nul = <T,>(v: T | null): T => v as T;

function key(fd: FormData): string {
  return fdUuid(fd, "client_request_id") ?? newId();
}

async function saveCaptions(db: ServerDb, fd: FormData) {
  const captions = fdCaptions(fd);
  if (Object.keys(captions).length > 0) await db.rpc("attachment_set_captions", { p_captions: captions });
}

function fail(error: unknown, event: string): ActionState {
  const state = toActionError(error);
  if (state.message?.startsWith("Não foi possível")) log.error(event, errorInfo(error));
  return state;
}

function refresh() {
  revalidatePath("/", "layout");
}

const ORIGINS: Enums["request_origin"][] = ["cliente_externo", "interna", "programada"];
const CHANNELS: Enums["request_channel"][] = ["whatsapp", "telefone", "email", "presencial", "outro"];

// ---------------------------------------------------------------------------
// Administração
// ---------------------------------------------------------------------------

export async function openRequestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const origin = (fdStr(fd, "origin") ?? "cliente_externo") as Enums["request_origin"];
  const channel = fdStr(fd, "channel") as Enums["request_channel"] | null;
  if (!ORIGINS.includes(origin)) return { ok: false, message: "Origem inválida.", fieldErrors: { origin: "Origem inválida." } };

  const { data, error } = await db.rpc("request_open", {
    p_client_request_id: key(fd),
    p_site_id: nul(fdUuid(fd, "site_id")),
    p_title: fdStr(fd, "title") ?? "",
    p_description: fdStr(fd, "description") ?? "",
    p_origin: origin,
    p_channel: channel && CHANNELS.includes(channel) ? channel : undefined,
    p_requester_contact_id: fdUuid(fd, "requester_contact_id") ?? undefined,
    p_requester_name: fdStr(fd, "requester_name") ?? undefined,
    p_site_area_id: fdUuid(fd, "site_area_id") ?? undefined,
    p_service_category_id: fdUuid(fd, "service_category_id") ?? undefined,
    p_priority_id: fdUuid(fd, "priority_id") ?? undefined,
    p_due_date: fdDate(fd, "due_date") ?? undefined,
    p_is_internal: fdBool(fd, "is_internal"),
    p_photo_ids: fdUuids(fd, "photo_ids"),
  });
  if (error || !data) return fail(error, "request.open_fail");
  await saveCaptions(db, fd);

  const assignees = fdUuids(fd, "assignee_ids");
  const scheduled = fdDate(fd, "scheduled_date");
  if (assignees.length > 0 && scheduled) {
    const sched = await db.rpc("request_schedule", {
      p_request_id: data.id,
      p_assignee_ids: assignees,
      p_scheduled_date: scheduled,
      p_client_request_id: newId(),
    });
    if (sched.error) {
      refresh();
      redirect(`/admin/chamados/${data.id}?aviso=${encodeURIComponent(`Chamado aberto, mas não programado: ${sched.error.message}`)}`);
    }
  }
  refresh();
  redirect(`/admin/chamados/${data.id}?feito=aberto`);
}

export async function scheduleRequestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const { error } = await db.rpc("request_schedule", {
    p_request_id: nul(fdUuid(fd, "request_id")),
    p_assignee_ids: fdUuids(fd, "assignee_ids"),
    p_scheduled_date: nul(fdDate(fd, "scheduled_date")),
    p_due_date: fdDate(fd, "due_date") ?? undefined,
    p_priority_id: fdUuid(fd, "priority_id") ?? undefined,
    p_service_category_id: fdUuid(fd, "service_category_id") ?? undefined,
    p_reason: fdStr(fd, "reason") ?? undefined,
    p_client_request_id: key(fd),
  });
  if (error) return fail(error, "request.schedule_fail");
  refresh();
  return { ok: true, message: "Responsável e data definidos. A equipe foi avisada no sistema." };
}

export async function updateRequestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const { error } = await db.rpc("request_update", {
    p_request_id: nul(fdUuid(fd, "request_id")),
    p_title: fdStr(fd, "title") ?? "",
    p_description: fdStr(fd, "description") ?? "",
    p_priority_id: nul(fdUuid(fd, "priority_id")),
    p_service_category_id: nul(fdUuid(fd, "service_category_id")),
    p_due_date: nul(fdDate(fd, "due_date")),
    p_site_area_id: nul(fdUuid(fd, "site_area_id")),
    p_is_internal: fdBool(fd, "is_internal"),
    p_reason: fdStr(fd, "reason") ?? undefined,
    p_client_request_id: key(fd),
  });
  if (error) return fail(error, "request.update_fail");
  refresh();
  return { ok: true, message: "Alterações salvas no histórico." };
}

type DecisionRpc = "request_validate" | "request_return" | "request_cancel" | "request_reopen";
const DECISION_DONE: Record<DecisionRpc, string> = {
  request_validate: "validado",
  request_return: "devolvido",
  request_cancel: "cancelado",
  request_reopen: "reaberto",
};

async function decision(rpc: DecisionRpc, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const id = fdUuid(fd, "request_id")!;
  const reason = fdStr(fd, "reason") ?? "";
  const { error } =
    rpc === "request_validate"
      ? await db.rpc(rpc, { p_request_id: id, p_note: reason || undefined, p_client_request_id: key(fd) })
      : await db.rpc(rpc, { p_request_id: id, p_reason: reason, p_client_request_id: key(fd) });
  if (error) return fail(error, `${rpc}_fail`);
  refresh();
  // O painel da ação some após a mudança de situação: o aviso vai para o topo da página.
  redirect(`/admin/chamados/${id}?feito=${DECISION_DONE[rpc]}`);
}

export async function validateRequestAction(_: ActionState, fd: FormData) {
  return decision("request_validate", fd);
}
export async function returnRequestAction(_: ActionState, fd: FormData) {
  return decision("request_return", fd);
}
export async function cancelRequestAction(_: ActionState, fd: FormData) {
  return decision("request_cancel", fd);
}
export async function reopenRequestAction(_: ActionState, fd: FormData) {
  return decision("request_reopen", fd);
}

export async function revokeAttachmentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const { error } = await db.rpc("attachment_revoke", {
    p_attachment_id: nul(fdUuid(fd, "attachment_id")),
    p_reason: fdStr(fd, "reason") ?? "",
  });
  if (error) return fail(error, "attachment.revoke_fail");
  refresh();
  return { ok: true, message: "Anexo removido. O registro continua no histórico." };
}

// ---------------------------------------------------------------------------
// Equipe (administração e campo)
// ---------------------------------------------------------------------------

export async function commentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin", "worker", "foreman"]);
  const db = await createSupabaseServer();
  const { error } = await db.rpc("request_comment", {
    p_request_id: nul(fdUuid(fd, "request_id")),
    p_client_request_id: key(fd),
    p_body: fdStr(fd, "body") ?? "",
    p_is_internal: fdBool(fd, "is_internal"),
  });
  if (error) return fail(error, "request.comment_fail");
  refresh();
  return { ok: true, message: "Comentário registrado." };
}

export async function startRequestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin", "worker", "foreman"]);
  const db = await createSupabaseServer();
  const id = nul(fdUuid(fd, "request_id"));
  const { error } = await db.rpc("request_start", { p_request_id: id, p_client_request_id: key(fd) });
  if (error) return fail(error, "request.start_fail");
  refresh();
  // O botão some após a mudança de situação: o aviso vai para o topo da página.
  redirect(`/campo/chamados/${id}?feito=iniciado`);
}

export async function resumeRequestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin", "worker", "foreman"]);
  const db = await createSupabaseServer();
  const { error } = await db.rpc("request_resume", {
    p_request_id: nul(fdUuid(fd, "request_id")),
    p_client_request_id: key(fd),
    p_note: fdStr(fd, "note") ?? undefined,
  });
  if (error) return fail(error, "request.resume_fail");
  refresh();
  redirect(`/campo/chamados/${fdUuid(fd, "request_id")}?feito=retomado`);
}

export async function addRequestPhotosAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin", "worker", "foreman"]);
  const db = await createSupabaseServer();
  const photos = fdUuids(fd, "photo_ids");
  if (photos.length === 0) return { ok: false, message: "Tire ou escolha ao menos 1 foto.", fieldErrors: { photo_ids: "Envie ao menos 1 foto." } };
  const role = (fdStr(fd, "role") ?? "intermediaria") as Enums["evidence_role"];
  const { error } = await db.rpc("request_add_photos", {
    p_request_id: nul(fdUuid(fd, "request_id")),
    p_client_request_id: key(fd),
    p_photo_ids: photos,
    p_role: role,
  });
  if (error) return fail(error, "request.photos_fail");
  await saveCaptions(db, fd);
  refresh();
  return { ok: true, message: `${photos.length} foto(s) adicionada(s) ao chamado.` };
}

const OUTCOMES: Enums["work_outcome"][] = ["executado", "parcial", "nao_executado"];
const KINDS: Enums["work_kind"][] = ["execucao", "visita", "vistoria", "recebimento_material", "apoio", "compra", "outro"];

/** "Registrar o que foi feito": cria o lançamento único (OS, tarefa ou avulso). */
export async function workEntryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin", "worker", "foreman"]);
  const db = await createSupabaseServer();
  const outcome = (fdStr(fd, "outcome") ?? "executado") as Enums["work_outcome"];
  const kind = (fdStr(fd, "kind") ?? "execucao") as Enums["work_kind"];
  const requestId = fdUuid(fd, "request_id");
  const occurrenceId = fdUuid(fd, "task_occurrence_id");
  const { data, error } = await db.rpc("work_entry_create", {
    p_client_request_id: key(fd),
    p_site_id: nul(fdUuid(fd, "site_id")),
    p_activity_date: nul(fdDate(fd, "activity_date")),
    p_description: fdStr(fd, "description") ?? "",
    p_kind: KINDS.includes(kind) ? kind : "execucao",
    p_service_request_id: requestId ?? undefined,
    p_task_occurrence_id: occurrenceId ?? undefined,
    p_site_area_id: fdUuid(fd, "site_area_id") ?? undefined,
    p_materials: fdStr(fd, "materials") ?? undefined,
    p_hours_worked: fdNumber(fd, "hours_worked") ?? undefined,
    p_outcome: OUTCOMES.includes(outcome) ? outcome : "executado",
    p_blocker_reason_id: fdUuid(fd, "blocker_reason_id") ?? undefined,
    p_next_step: fdStr(fd, "next_step") ?? undefined,
    p_participant_ids: fdUuids(fd, "participant_ids"),
    p_photo_ids: fdUuids(fd, "photo_ids"),
  });
  if (error || !data) return fail(error, "work_entry.create_fail");
  await saveCaptions(db, fd);
  refresh();
  const back = fdStr(fd, "return_to");
  redirect(back && back.startsWith("/campo") ? `${back}${back.includes("?") ? "&" : "?"}feito=registro` : "/campo?feito=registro");
}

export async function reportPendingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin", "worker", "foreman"]);
  const db = await createSupabaseServer();
  const id = nul(fdUuid(fd, "request_id"));
  const { error } = await db.rpc("request_report_pending", {
    p_request_id: id,
    p_client_request_id: key(fd),
    p_pending_reason_id: nul(fdUuid(fd, "pending_reason_id")),
    p_explanation: fdStr(fd, "explanation") ?? "",
    p_next_action: fdStr(fd, "next_action") ?? "",
    p_next_action_owner_id: nul(fdUuid(fd, "next_action_owner_id")),
    p_expected_return_date: nul(fdDate(fd, "expected_return_date")),
    p_photo_ids: fdUuids(fd, "photo_ids"),
  });
  if (error) return fail(error, "request.pending_fail");
  await saveCaptions(db, fd);
  refresh();
  redirect(actionReturnPath(fdStr(fd, "base"), "/campo/chamados", id, "pendencia"));
}

export async function markExecutedAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin", "worker", "foreman"]);
  const db = await createSupabaseServer();
  const id = nul(fdUuid(fd, "request_id"));
  const { error } = await db.rpc("request_mark_executed", {
    p_request_id: id,
    p_client_request_id: key(fd),
    p_solution: fdStr(fd, "solution") ?? "",
    p_result_photo_ids: fdUuids(fd, "result_photo_ids"),
    p_activity_date: fdDate(fd, "activity_date") ?? undefined,
    p_materials: fdStr(fd, "materials") ?? undefined,
    p_hours_worked: fdNumber(fd, "hours_worked") ?? undefined,
    p_participant_ids: fdUuids(fd, "participant_ids"),
    p_photo_ids: fdUuids(fd, "photo_ids"),
  });
  if (error) return fail(error, "request.executed_fail");
  await saveCaptions(db, fd);
  refresh();
  redirect(actionReturnPath(fdStr(fd, "base"), "/campo/chamados", id, "executada"));
}
