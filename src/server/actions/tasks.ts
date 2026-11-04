"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toActionError, type ActionState } from "@/domain/action-errors";
import { fdDate, fdStr, fdUuid, fdUuids } from "@/domain/form-data";
import { newId } from "@/domain/ids";
import { actionReturnPath } from "@/domain/safe-redirect";
import { buildOccurrences } from "@/domain/task-form";
import { requireProfile } from "@/server/auth";
import { errorInfo, log } from "@/server/log";
import { createSupabaseServer } from "@/server/supabase/server";

const nul = <T,>(v: T | null): T => v as T;

function fail(error: unknown, event: string): ActionState {
  const state = toActionError(error);
  if (state.message?.startsWith("Não foi possível")) log.error(event, errorInfo(error));
  return state;
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function createTaskAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const date = fdDate(fd, "scheduled_date");
  const sites = fdUuids(fd, "site_ids");
  const { occurrences, error: areaError } = buildOccurrences(sites, date, fdStr(fd, "site_area"));
  if (areaError) return { ok: false, message: areaError, fieldErrors: { site_area: areaError } };
  const { data, error } = await db.rpc("task_create", {
    p_client_request_id: fdUuid(fd, "client_request_id") ?? newId(),
    p_title: fdStr(fd, "title") ?? "",
    p_scheduled_date: nul(date),
    p_assignee_ids: fdUuids(fd, "assignee_ids"),
    p_occurrences: occurrences,
    p_description: fdStr(fd, "description") ?? undefined,
    p_kind_id: fdUuid(fd, "kind_id") ?? undefined,
    p_priority_id: fdUuid(fd, "priority_id") ?? undefined,
    p_due_date: fdDate(fd, "due_date") ?? undefined,
    p_service_request_id: fdUuid(fd, "service_request_id") ?? undefined,
  });
  if (error || !data) {
    const state = fail(error, "task.create_fail");
    if (state.fieldErrors?.occurrences) state.fieldErrors.site_ids = state.fieldErrors.occurrences;
    return state;
  }
  refresh();
  redirect(`/admin/agenda?data=${date}&feito=tarefa`);
}

export async function rescheduleOccurrenceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const { error } = await db.rpc("task_occurrence_reschedule", {
    p_occurrence_id: nul(fdUuid(fd, "occurrence_id")),
    p_scheduled_date: nul(fdDate(fd, "scheduled_date")),
    p_reason: fdStr(fd, "reason") ?? "",
  });
  if (error) return fail(error, "task.reschedule_fail");
  refresh();
  return { ok: true, message: "Data alterada. A mudança ficou registrada." };
}

export async function cancelTaskAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const { error } = await db.rpc("task_cancel", { p_task_id: nul(fdUuid(fd, "task_id")), p_reason: fdStr(fd, "reason") ?? "" });
  if (error) return fail(error, "task.cancel_fail");
  refresh();
  return { ok: true, message: "Tarefa cancelada." };
}

export async function addOccurrenceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin", "worker", "foreman"]);
  const db = await createSupabaseServer();
  const { data, error } = await db.rpc("task_add_occurrence", {
    p_task_id: nul(fdUuid(fd, "task_id")),
    p_site_id: nul(fdUuid(fd, "site_id")),
    p_scheduled_date: nul(fdDate(fd, "scheduled_date")),
  });
  if (error || !data) {
    const state = fail(error, "task.add_occurrence_fail");
    if (state.fieldErrors?.site_id === undefined && state.message) state.fieldErrors = { ...(state.fieldErrors ?? {}), site_id: state.message };
    return state;
  }
  refresh();
  redirect(actionReturnPath(fdStr(fd, "base"), "/campo/tarefas", data.id, "desdobrada"));
}

export async function startOccurrenceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin", "worker", "foreman"]);
  const db = await createSupabaseServer();
  const { error } = await db.rpc("task_occurrence_start", { p_occurrence_id: nul(fdUuid(fd, "occurrence_id")) });
  if (error) return fail(error, "task.start_fail");
  refresh();
  // O formulário some após a mudança de situação: o aviso vai para o topo da página.
  redirect(`/campo/tarefas/${fdUuid(fd, "occurrence_id")}?feito=iniciada`);
}

export async function finishOccurrenceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin", "worker", "foreman"]);
  const db = await createSupabaseServer();
  const { error } = await db.rpc("task_occurrence_finish", {
    p_occurrence_id: nul(fdUuid(fd, "occurrence_id")),
    p_notes: fdStr(fd, "notes") ?? undefined,
  });
  if (error) return fail(error, "task.finish_fail");
  refresh();
  // O formulário some após a mudança de situação: o aviso vai para o topo da página.
  redirect(`/campo/tarefas/${fdUuid(fd, "occurrence_id")}?feito=finalizada`);
}

/** Pela agenda da administração: mesma regra do campo, mas a resposta fica na própria agenda. */
export async function markOccurrenceNotDoneAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const { error } = await db.rpc("task_occurrence_not_done", {
    p_occurrence_id: nul(fdUuid(fd, "occurrence_id")),
    p_reason: fdStr(fd, "reason") ?? "",
  });
  if (error) return fail(error, "task.not_done_fail");
  refresh();
  return { ok: true, message: "Registrado que a tarefa não foi realizada, com o motivo." };
}

export async function notDoneOccurrenceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin", "worker", "foreman"]);
  const db = await createSupabaseServer();
  const { error } = await db.rpc("task_occurrence_not_done", {
    p_occurrence_id: nul(fdUuid(fd, "occurrence_id")),
    p_reason: fdStr(fd, "reason") ?? "",
  });
  if (error) return fail(error, "task.not_done_fail");
  refresh();
  // O formulário some após a mudança de situação: o aviso vai para o topo da página.
  redirect(`/campo/tarefas/${fdUuid(fd, "occurrence_id")}?feito=nao_realizada`);
}
