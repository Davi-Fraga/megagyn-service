"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionState } from "@/domain/action-errors";
import { fdBool, fdDate, fdMoney, fdNumber, fdStr, fdUuid, fdUuids } from "@/domain/form-data";
import { requireProfile } from "@/server/auth";
import { createSupabaseServer } from "@/server/supabase/server";

export async function saveTimeEntryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const profile = await requireProfile(["admin", "worker", "foreman"]);
  const db = await createSupabaseServer();
  const isAdmin = profile.role === "admin";
  const hours = fdNumber(fd, "hours");
  const { error } = await db.rpc("time_entry_upsert", {
    p_site_id: fdUuid(fd, "site_id") as string,
    p_work_date: fdDate(fd, "work_date") as string,
    p_hours: hours as number,
    p_notes: fdStr(fd, "notes") ?? undefined,
    p_profile_id: isAdmin ? (fdUuid(fd, "profile_id") ?? undefined) : undefined,
    p_billable: isAdmin ? fdBool(fd, "billable") : undefined,
    p_billing_units: isAdmin ? (fdNumber(fd, "billing_units") ?? undefined) : undefined,
  });
  if (error) return toActionError(error);
  revalidatePath("/", "layout");
  return { ok: true, message: "Jornada salva." };
}

export async function approveTimeEntriesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const ids = fdUuids(fd, "time_entry_ids");
  if (ids.length === 0) return { ok: false, message: "Selecione ao menos uma jornada." };
  const db = await createSupabaseServer();
  const { data, error } = await db.rpc("time_entries_approve", { p_ids: ids });
  if (error) return toActionError(error);
  revalidatePath("/admin/horas");
  return { ok: true, message: `${data ?? 0} jornada(s) conferida(s).` };
}

/** Regra de valor de serviço (diária/hora) por contrato, com vigência. Não é salário nem custo interno. */
export async function createBillingRuleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const profile = await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const clientId = fdUuid(fd, "client_id");
  const price = fdMoney(fd, "unit_price");
  const validFrom = fdDate(fd, "valid_from");
  const unitType = fdStr(fd, "unit_type");
  const errors: Record<string, string> = {};
  if (!clientId) errors.client_id = "Escolha o cliente.";
  if (!price || price <= 0) errors.unit_price = "Informe o valor (ex.: 333,00).";
  if (!validFrom) errors.valid_from = "Informe o início da vigência.";
  if (unitType !== "diaria" && unitType !== "hora") errors.unit_type = "Escolha diária ou hora.";
  if (Object.keys(errors).length) return { ok: false, message: "Confira os campos destacados.", fieldErrors: errors };
  const { error } = await db.from("billing_rules").insert({
    client_id: clientId!,
    site_id: fdUuid(fd, "site_id"),
    unit_type: unitType!,
    unit_price_cents: price!,
    valid_from: validFrom!,
    valid_to: fdDate(fd, "valid_to"),
    show_in_client_report: fdBool(fd, "show_in_client_report"),
    notes: fdStr(fd, "notes"),
    created_by: profile.id,
  });
  if (error) {
    if (error.code === "23P01") {
      return { ok: false, message: "Já existe regra vigente para este cliente/local no mesmo período. Encerre a anterior antes.", fieldErrors: { valid_from: "Período sobreposto." } };
    }
    return toActionError(error);
  }
  revalidatePath("/admin/horas");
  return { ok: true, message: "Regra de valor criada." };
}

export async function endBillingRuleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const validTo = fdDate(fd, "valid_to");
  if (!validTo) return { ok: false, message: "Informe a data final.", fieldErrors: { valid_to: "Informe a data final." } };
  const { error } = await db.from("billing_rules").update({ valid_to: validTo }).eq("id", fdUuid(fd, "rule_id") ?? "");
  if (error) return toActionError(error);
  revalidatePath("/admin/horas");
  return { ok: true, message: "Vigência encerrada." };
}
