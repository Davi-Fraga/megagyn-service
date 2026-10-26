import type { ReactNode } from "react";
import { Brand } from "./brand";

/** Moldura das telas avulsas (erro e "não encontrado"), igual à do login. */
export function CenteredPanel({ alert = false, children }: { alert?: boolean; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col">
      {alert && <div aria-hidden className="faixa-alerta h-2" />}
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8">
          <Brand />
        </div>
        <div className="rounded-panel border border-linha bg-papel p-5 sm:p-7">{children}</div>
      </div>
    </main>
  );
}
