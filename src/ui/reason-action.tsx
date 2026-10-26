"use client";

import { useState } from "react";
import { Button, type ButtonVariant } from "./button";
import { ActionForm, TextAreaField, type ActionFn } from "./form";

/** Ação crítica com confirmação explícita e motivo (devolver, cancelar, reabrir, remover anexo). */
export function ReasonAction({
  action,
  hidden,
  label,
  confirmLabel,
  reasonLabel = "Motivo",
  reasonHint,
  required = true,
  variant = "secondary",
  confirmVariant = "dark",
  intro,
}: {
  action: ActionFn;
  hidden: Record<string, string>;
  label: string;
  confirmLabel: string;
  reasonLabel?: string;
  reasonHint?: string;
  required?: boolean;
  variant?: ButtonVariant;
  confirmVariant?: ButtonVariant;
  intro?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant={variant} onClick={() => setOpen(true)} aria-expanded={false}>
        {label}
      </Button>
    );
  }
  return (
    <div className="w-full rounded-ctl border border-linha bg-concreto p-3">
      {intro && <p className="mb-3 text-sm text-muted">{intro}</p>}
      <ActionForm
        action={action}
        submitLabel={confirmLabel}
        submitVariant={confirmVariant}
        extraActions={
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Voltar
          </Button>
        }
      >
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <TextAreaField label={reasonLabel} name="reason" required={required} rows={3} hint={reasonHint} />
      </ActionForm>
    </div>
  );
}
