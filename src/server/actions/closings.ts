"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toActionError, type ActionState } from "@/domain/action-errors";
import { fdBool, fdStr, fdUuid } from "@/domain/form-data";
import { requireProfile } from "@/server/auth";
import { computeClosing } from "@/server/closings";
import type { Json } from "@/server/db/database.types";
import { errorInfo, log } from "@/server/log";
import { createSupabaseServer } from "@/server/supabase/server";

/**
 * Emite uma versão do fechamento: apura AGORA o snapshot do mês (eventos até o corte)
 * e grava o payload congelado. Correções geram nova versão; as anteriores ficam intactas.
 */
export async function issueClosingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const profile = await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const clientId = fdUuid(fd, "client_id");
  const siteId = fdUuid(fd, "site_id");
  const year = Number(fdStr(fd, "year"));
  const month = Number(fdStr(fd, "month"));
  const includeBilling = fdBool(fd, "include_billing");
  const reason = fdStr(fd, "reason");
  if (!clientId || !Number.isInteger(year) || month < 1 || month > 12) return { ok: false, message: "Escolha cliente, mês e ano." };

  let closingId: string;
  let existing = db
    .from("monthly_closings")
    .select("id")
    .eq("client_id", clientId)
    .eq("period_year", year)
    .eq("period_month", month);
  existing = siteId ? existing.eq("site_id", siteId) : existing.is("site_id", null);
  const { data: found } = await existing.maybeSingle();
  if (found) {
    closingId = found.id;
  } else {
    const { data: created, error } = await db
      .from("monthly_closings")
      .insert({ client_id: clientId, site_id: siteId, period_year: year, period_month: month, created_by: profile.id })
      .select("id")
      .single();
    if (error || !created) {
      log.error("closing.create_fail", errorInfo(error));
      return toActionError(error);
    }
    closingId = created.id;
  }

  let computed;
  try {
    computed = await computeClosing(db, { clientId, siteId, year, month, includeBilling });
  } catch (error) {
    log.error("closing.compute_fail", errorInfo(error));
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível apurar o fechamento." };
  }
  const { data: version, error } = await db.rpc("closing_version_create", {
    p_closing_id: closingId,
    p_cutoff_at: computed.payload.period.cutoffUtc,
    p_period_start: computed.payload.period.startUtc,
    p_criteria: { includeBilling, siteId, scope: siteId ? "unidade" : "todas_as_unidades" } as Json,
    p_header: computed.header as unknown as Json,
    p_payload: computed.payload as unknown as Json,
    p_summary: computed.payload.summary as unknown as Json,
    p_reason: reason ?? undefined,
  });
  if (error || !version) return toActionError(error);
  revalidatePath("/admin/fechamentos", "layout");
  redirect(`/admin/fechamentos/${closingId}?versao=${version.id}&feito=emitida`);
}

export async function registerDeliveryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const versionId = fdUuid(fd, "closing_version_id");
  const { data: artifact } = await db
    .from("report_artifacts")
    .select("id")
    .eq("source_id", versionId ?? "")
    .eq("status", "pronto")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await db.rpc("report_publication_register", {
    p_closing_version_id: versionId as string,
    p_report_artifact_id: (artifact?.id ?? null) as string,
    p_delivery_channel: fdStr(fd, "delivery_channel") ?? "",
    p_delivery_note: fdStr(fd, "delivery_note") ?? undefined,
  });
  if (error) return toActionError(error);
  revalidatePath("/admin/fechamentos", "layout");
  return { ok: true, message: "Entrega registrada no histórico do fechamento." };
}

export async function revokeDeliveryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const { error } = await db.rpc("report_publication_revoke", {
    p_publication_id: fdUuid(fd, "publication_id") as string,
    p_reason: fdStr(fd, "reason") ?? "",
  });
  if (error) return toActionError(error);
  revalidatePath("/admin/fechamentos", "layout");
  return { ok: true, message: "Registro de entrega revogado." };
}
