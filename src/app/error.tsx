"use client";

import Link from "next/link";
import { buttonClass } from "@/ui/button";
import { CenteredPanel } from "@/ui/centered-panel";

/**
 * Falha inesperada ao montar a tela (ex.: consulta com erro). Em produção o Next troca a
 * mensagem por um código (digest), que liga esta tela ao registro no log do servidor.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? ((error as Error & { digest?: string }).digest ?? "") : "";
  return (
    <CenteredPanel alert>
      <h1 className="mb-2 text-2xl font-bold">Não foi possível abrir esta tela</h1>
      <p className="mb-6 text-muted">
        Houve uma falha ao carregar os dados. Tente de novo. Se continuar, avise a administração
        {digest ? ` e informe o código ${digest}` : ""}.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => retry()} className={buttonClass("dark")}>
          Tentar de novo
        </button>
        <Link href="/" className={buttonClass("secondary")}>
          Ir para o início
        </Link>
      </div>
    </CenteredPanel>
  );
}
