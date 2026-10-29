import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/server/supabase/server";
import { ActionForm, TextField } from "@/ui/form";
import { updatePassword } from "../actions";

export const metadata: Metadata = { title: "Nova senha" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ convite?: string }> }) {
  const { convite } = await searchParams;
  const invited = convite === "1";
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/recuperar-acesso");
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">{invited ? "Crie sua senha de acesso" : "Criar nova senha"}</h1>
      <p className="mb-6 text-muted">
        {invited ? "Seu acesso ao Megagyn Service foi criado. Escolha uma senha com ao menos 8 caracteres." : "Use ao menos 8 caracteres."}
      </p>
      <ActionForm action={updatePassword} submitLabel="Salvar nova senha" submitSize="lg">
        <TextField label="Nova senha" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <TextField label="Repita a senha" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </ActionForm>
    </>
  );
}
