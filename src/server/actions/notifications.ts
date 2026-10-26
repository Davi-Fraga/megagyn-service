"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/domain/action-errors";
import { requireProfile } from "@/server/auth";
import { createSupabaseServer } from "@/server/supabase/server";

export async function markAllReadAction(): Promise<ActionState> {
  await requireProfile();
  const db = await createSupabaseServer();
  const { data } = await db.rpc("notifications_mark_read", {});
  revalidatePath("/", "layout");
  return { ok: true, message: `${data ?? 0} notificação(ões) marcada(s) como lida(s).` };
}
