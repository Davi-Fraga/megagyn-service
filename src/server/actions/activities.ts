"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionState } from "@/domain/action-errors";
import { fdBool, fdDate, fdNumber, fdStr, fdUuid, fdUuids } from "@/domain/form-data";
import { requireProfile } from "@/server/auth";
import { createSupabaseServer } from "@/server/supabase/server";

/** Ajuste pela administração: o envio original do trabalhador continua guardado (submitted_payload + auditoria). */
export async function adjustWorkEntryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const { error } = await db.rpc("work_entry_adjust", {
    p_work_entry_id: fdUuid(fd, "work_entry_id") as string,
    p_reason: fdStr(fd, "reason") ?? "",
    p_description: fdStr(fd, "description") ?? "",
    p_solution: fdStr(fd, "solution") ?? "",
    p_materials: fdStr(fd, "materials") ?? "",
    p_hours_worked: fdNumber(fd, "hours_worked") as number,
    p_activity_date: fdDate(fd, "activity_date") as string,
    p_client_visible: fdBool(fd, "client_visible"),
  });
  if (error) return toActionError(error);
  revalidatePath("/", "layout");
  return { ok: true, message: "Ajuste salvo. O texto original continua no histórico." };
}

export async function markReviewedAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const ids = fdUuids(fd, "work_entry_ids");
  if (ids.length === 0) return { ok: false, message: "Selecione ao menos um registro." };
  const db = await createSupabaseServer();
  const { data, error } = await db.rpc("work_entries_mark_reviewed", { p_ids: ids });
  if (error) return toActionError(error);
  revalidatePath("/admin/atividades");
  return { ok: true, message: `${data ?? 0} registro(s) marcados como revisados.` };
}
