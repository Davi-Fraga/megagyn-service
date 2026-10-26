import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, TextField } from "@/ui/form";
import { Notice } from "@/ui/page";
import { requestPasswordReset } from "../actions";

export const metadata: Metadata = { title: "Recuperar acesso" };

export default async function RecoverPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">Recuperar acesso</h1>
      <p className="mb-6 text-muted">Enviaremos um link para você criar uma nova senha.</p>
      {erro === "link" && (
        <div className="mb-4">
          <Notice tone="alerta">O link expirou ou já foi usado. Peça um novo abaixo.</Notice>
        </div>
      )}
      <ActionForm action={requestPasswordReset} submitLabel="Enviar link" pendingLabel="Enviando…" submitSize="lg">
        <TextField label="E-mail" name="email" type="email" autoComplete="email" inputMode="email" required />
      </ActionForm>
      <p className="mt-6 text-sm">
        <Link href="/login" className="font-semibold text-info underline">
          Voltar para entrar
        </Link>
      </p>
    </>
  );
}
