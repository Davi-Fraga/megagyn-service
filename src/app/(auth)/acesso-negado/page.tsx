import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/ui/button";
import { signOut } from "../actions";

export const metadata: Metadata = { title: "Acesso negado" };

export default async function DeniedPage({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const { motivo } = await searchParams;
  return (
    <>
      <h1 className="mb-2 text-2xl font-bold">Acesso negado</h1>
      <p className="mb-6 text-muted">
        {motivo === "inativo"
          ? "Seu acesso está desativado ou ainda não foi liberado. Fale com a administração da Megagyn."
          : "Você não tem permissão para abrir esta página. Volte ao início ou entre com outro usuário."}
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className={buttonClass("secondary")}>
          Ir para o início
        </Link>
        <form action={signOut}>
          <button type="submit" className={buttonClass("dark")}>
            Sair e entrar com outro usuário
          </button>
        </form>
      </div>
    </>
  );
}
