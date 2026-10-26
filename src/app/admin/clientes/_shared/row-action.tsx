"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/domain/action-errors";
import { Button, buttonClass, type ButtonVariant } from "@/ui/button";
import type { ActionFn } from "@/ui/form";

const INITIAL: ActionState = { ok: false };

/**
 * Ação curta dentro de uma linha de lista (desativar, reativar, encerrar acesso…).
 * Com `confirm`, pede uma segunda confirmação explícita antes de enviar.
 * A server action vai direto para o useActionState: o formulário funciona mesmo antes
 * da hidratação (celular lento), sem perder o envio.
 */
export function RowAction({
  action,
  hidden,
  label,
  pendingLabel = "Aguarde…",
  variant = "secondary",
  confirm,
}: {
  action: ActionFn;
  hidden: Record<string, string>;
  label: string;
  pendingLabel?: string;
  variant?: ButtonVariant;
  confirm?: { intro: string; label: string; variant?: ButtonVariant };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, INITIAL);
  // Fecha a confirmação quando chega um resultado de sucesso (estado derivado, sem efeito).
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.ok) setOpen(false);
  }

  const message =
    state.message &&
    (state.ok ? (
      <p role="status" className="text-sm font-medium text-ok">
        {state.message}
      </p>
    ) : (
      <p role="alert" className="text-sm font-medium text-erro">
        {state.message}
      </p>
    ));

  if (confirm && !open) {
    return (
      <div className="space-y-1">
        <Button size="sm" variant={variant} onClick={() => setOpen(true)} aria-expanded={false}>
          {label}
        </Button>
        {message}
      </div>
    );
  }

  const form = (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" disabled={pending} className={buttonClass(confirm?.variant ?? variant, "sm")}>
        {pending ? pendingLabel : (confirm?.label ?? label)}
      </button>
      {confirm && (
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Voltar
        </Button>
      )}
    </form>
  );

  if (!confirm) {
    return (
      <div className="space-y-1">
        {form}
        {message}
      </div>
    );
  }
  return (
    <div className="w-full space-y-2 rounded-ctl border border-linha bg-concreto p-3">
      <p className="text-sm">{confirm.intro}</p>
      {form}
      {message}
    </div>
  );
}
