import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/ui/button";
import { CenteredPanel } from "@/ui/centered-panel";

export const metadata: Metadata = { title: "Não encontrado" };

/** Endereço inexistente ou registro fora do acesso da pessoa (a RLS não distingue os dois casos). */
export default function NotFound() {
  return (
    <CenteredPanel>
      <h1 className="mb-2 text-2xl font-bold">Não encontrado</h1>
      <p className="mb-6 text-muted">Este endereço não existe ou o registro não está liberado para o seu usuário.</p>
      <Link href="/" className={buttonClass("secondary")}>
        Ir para o início
      </Link>
    </CenteredPanel>
  );
}
