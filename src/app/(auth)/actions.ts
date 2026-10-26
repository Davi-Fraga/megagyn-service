"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/domain/action-errors";
import { safeRedirectPath } from "@/domain/safe-redirect";
import { homeFor } from "@/server/auth";
import { env } from "@/server/env";
import { errorInfo, log } from "@/server/log";
import { createSupabaseServer } from "@/server/supabase/server";

function safeNext(value: FormDataEntryValue | null): string | null {
  return safeRedirectPath(typeof value === "string" ? value : null, "") || null;
}

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fieldErrors: Record<string, string> = {};
  if (!email) fieldErrors.email = "Informe seu e-mail.";
  if (!password) fieldErrors.password = "Informe sua senha.";
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Preencha e-mail e senha.", fieldErrors };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    log.warn("auth.login_fail", { reason: error?.code ?? "unknown" });
    if (error?.code === "user_banned") {
      return { ok: false, message: "Seu acesso está desativado. Fale com a administração da Megagyn." };
    }
    return { ok: false, message: "E-mail ou senha incorretos." };
  }
  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", data.user.id).maybeSingle();
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return { ok: false, message: "Seu acesso está desativado. Fale com a administração da Megagyn." };
  }
  redirect(safeNext(formData.get("next")) ?? homeFor(profile.role));
}

export async function requestPasswordReset(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, message: "Informe seu e-mail.", fieldErrors: { email: "Informe seu e-mail." } };
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.appUrl}/auth/callback?next=/redefinir-senha`,
  });
  if (error) log.warn("auth.reset_fail", errorInfo(error));
  // Mesma resposta exista ou não a conta (não revela e-mails cadastrados).
  return { ok: true, message: "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha." };
}

export async function updatePassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { ok: false, message: "A senha precisa ter ao menos 8 caracteres.", fieldErrors: { password: "Mínimo de 8 caracteres." } };
  if (password !== confirm) return { ok: false, message: "As senhas não conferem.", fieldErrors: { confirm: "Repita a mesma senha." } };
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    log.warn("auth.update_password_fail", errorInfo(error));
    return { ok: false, message: "Não foi possível trocar a senha. Abra o link do e-mail novamente." };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
