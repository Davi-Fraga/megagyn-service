import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, TextField } from "@/ui/form";
import { signIn } from "../actions";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">Entrar</h1>
      <p className="mb-6 text-muted">Use o e-mail e a senha que a administração cadastrou para você.</p>
      <ActionForm action={signIn} submitLabel="Entrar" pendingLabel="Entrando…" submitSize="lg">
        <input type="hidden" name="next" value={next ?? ""} />
        <TextField label="E-mail" name="email" type="email" autoComplete="email" inputMode="email" required />
        <TextField label="Senha" name="password" type="password" autoComplete="current-password" required />
      </ActionForm>
      <p className="mt-6 text-sm">
        <Link href="/recuperar-acesso" className="font-semibold text-info underline">
          Esqueci minha senha
        </Link>
      </p>
    </>
  );
}
