"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import type { ActionState } from "@/domain/action-errors";
import { newId } from "@/domain/ids";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button";
import { cn } from "./cn";
import { useHydrated } from "./use-hydrated";

/** Fotos de um campo: "enviando" segura o envio até terminar; "falhou" segura até reenviar ou retirar. */
export type UploadState = "enviando" | "falhou" | null;

type FormCtx = {
  errors: Record<string, string>;
  setBusy: (key: string, state: UploadState) => void;
};
const FormContext = createContext<FormCtx>({ errors: {}, setBusy: () => {} });

export function useFieldError(name: string): string | undefined {
  return useContext(FormContext).errors[name];
}
export function useFormBusy() {
  return useContext(FormContext).setBusy;
}

export type ActionFn = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Formulário com server action: mostra erros por campo, impede envio duplo (botão
 * desabilitado + chave de idempotência `client_request_id` reaproveitada em reenvio)
 * e bloqueia o envio enquanto houver foto subindo ou foto que falhou.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Salvando…",
  successMessage,
  submitVariant = "primary",
  submitSize = "md",
  stickySubmit = false,
  resetOnSuccess = false,
  className,
  extraActions,
  submitDisabled = false,
  disabledReason,
}: {
  action: ActionFn;
  children: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  successMessage?: string;
  submitVariant?: ButtonVariant;
  submitSize?: ButtonSize;
  stickySubmit?: boolean;
  resetOnSuccess?: boolean;
  className?: string;
  extraActions?: ReactNode;
  /** Bloqueia o envio por regra da tela (ex.: rateio não fecha); o motivo aparece junto ao botão. */
  submitDisabled?: boolean;
  disabledReason?: string;
}) {
  const keyRef = useRef<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [busy, setBusyMap] = useState<Record<string, UploadState>>({});
  const formRef = useRef<HTMLFormElement>(null);

  // A mesma chave de idempotência é reaproveitada em reenvios até o primeiro sucesso.
  const submit = useCallback(
    async (prev: ActionState, formData: FormData): Promise<ActionState> => {
      if (!keyRef.current) keyRef.current = newId();
      formData.set("client_request_id", keyRef.current);
      const result = await action(prev, formData);
      if (result.ok) {
        keyRef.current = null;
        if (resetOnSuccess) setFormKey((k) => k + 1);
      }
      return result;
    },
    [action, resetOnSuccess],
  );
  const [state, formAction, pending] = useActionState(submit, { ok: false });
  // false no servidor e até a hidratação: evita envio nativo (GET) antes de o React assumir o formulário.
  const hydrated = useHydrated();

  const setBusy = useCallback((key: string, value: UploadState) => {
    setBusyMap((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);
  const uploads = Object.values(busy);
  const uploading = uploads.includes("enviando");
  // Sem isso o registro sairia sem a foto que falhou, e a evidência se perderia.
  const uploadFailed = !uploading && uploads.includes("falhou");

  useEffect(() => {
    if (state.ok || !state.fieldErrors) return;
    const first = Object.keys(state.fieldErrors)[0];
    const el = first ? formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`) : null;
    el?.focus();
  }, [state]);

  const ctx = useMemo<FormCtx>(() => ({ errors: state.fieldErrors ?? {}, setBusy }), [state.fieldErrors, setBusy]);

  return (
    <FormContext.Provider value={ctx}>
      <form
        ref={formRef}
        method="post"
        onSubmit={(event) => {
          // Envio via transição (em vez de <form action>) para NÃO limpar os campos quando o
          // servidor devolve erro: o React 19 reseta formulários após ações nativas.
          event.preventDefault();
          if (!hydrated || pending || uploading || uploadFailed || submitDisabled) return;
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
        className={cn("space-y-5", className)}
      >
        <div key={formKey} className="space-y-5">
          {children}
        </div>
        <FormMessage state={state} successMessage={successMessage} />
        <div
          className={cn(
            "flex flex-wrap items-center gap-3",
            stickySubmit &&
              // --sticky-offset: altura do menu inferior do campo (definida no layout); 0 na administração.
              "sticky bottom-[var(--sticky-offset,0px)] z-10 -mx-4 border-t border-linha bg-concreto/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0",
          )}
        >
          <button
            type="submit"
            disabled={!hydrated || pending || uploading || uploadFailed || submitDisabled}
            className={buttonClass(submitVariant, submitSize)}
          >
            {pending ? pendingLabel : uploading ? "Aguarde o envio das fotos…" : submitLabel}
          </button>
          {extraActions}
          {uploadFailed && (
            <p role="status" className="basis-full text-sm font-semibold text-erro">
              Uma foto não foi enviada. Toque em “Tentar de novo” ou retire a foto para salvar.
            </p>
          )}
          {submitDisabled && disabledReason && (
            <p role="status" className="basis-full text-sm font-semibold text-erro">
              {disabledReason}
            </p>
          )}
        </div>
      </form>
    </FormContext.Provider>
  );
}

export function FormMessage({ state, successMessage }: { state: ActionState; successMessage?: string }) {
  if (state.ok && (state.message || successMessage)) {
    return (
      <p role="status" className="border-l-[3px] border-ok bg-ok-claro px-3 py-2 text-sm font-medium text-ok">
        {state.message ?? successMessage}
      </p>
    );
  }
  if (!state.ok && state.message) {
    return (
      <p role="alert" className="border-l-[3px] border-erro bg-erro-claro px-3 py-2 text-sm font-medium text-erro">
        {state.message}
      </p>
    );
  }
  return null;
}

type A11y = { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string };
type FieldShellProps = { label: string; name: string; hint?: string; required?: boolean; children: (a11y: A11y) => ReactNode };

export function FieldShell({ label, name, hint, required, children }: FieldShellProps) {
  const id = useId();
  const error = useFieldError(name);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[0.95rem] font-semibold">
        {label}
        {required ? <span className="text-erro"> *</span> : <span className="font-normal text-muted"> (opcional)</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-erro">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = Omit<ComponentProps<"input">, "name"> & { label: string; name: string; hint?: string };

export function TextField({ label, name, hint, required, className, ...rest }: InputProps) {
  return (
    <FieldShell label={label} name={name} hint={hint} required={required}>
      {(a11y) => <input name={name} required={required} className={cn("campo-input", className)} {...a11y} {...rest} />}
    </FieldShell>
  );
}

type TextAreaProps = Omit<ComponentProps<"textarea">, "name"> & { label: string; name: string; hint?: string };

export function TextAreaField({ label, name, hint, required, rows = 4, className, ...rest }: TextAreaProps) {
  return (
    <FieldShell label={label} name={name} hint={hint} required={required}>
      {(a11y) => (
        <textarea name={name} required={required} rows={rows} className={cn("campo-input", className)} {...a11y} {...rest} />
      )}
    </FieldShell>
  );
}

export type Option = { value: string; label: string };
type SelectProps = Omit<ComponentProps<"select">, "name"> & {
  label: string;
  name: string;
  hint?: string;
  options: Option[];
  placeholder?: string;
};

export function SelectField({ label, name, hint, required, options, placeholder = "Selecione…", className, ...rest }: SelectProps) {
  return (
    <FieldShell label={label} name={name} hint={hint} required={required}>
      {(a11y) => (
        <select name={name} required={required} className={cn("campo-input", className)} {...a11y} {...rest}>
          {placeholder !== "" && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

export function CheckboxField({
  label,
  name,
  hint,
  defaultChecked,
  value = "on",
}: {
  label: string;
  name: string;
  hint?: string;
  defaultChecked?: boolean;
  value?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5">
      <input id={id} type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="mt-0.5 size-5 shrink-0 accent-acento" />
      <span className="text-[0.95rem]">
        <span className="font-semibold">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Lista de caixas de seleção (ex.: responsáveis). Envia o mesmo nome várias vezes. */
export function CheckboxGroup({
  label,
  name,
  options,
  defaultValues = [],
  required,
  hint,
}: {
  label: string;
  name: string;
  options: Option[];
  defaultValues?: string[];
  required?: boolean;
  hint?: string;
}) {
  const error = useFieldError(name);
  const id = useId();
  return (
    <fieldset className="space-y-2" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="text-[0.95rem] font-semibold">
        {label}
        {required ? <span className="text-erro"> *</span> : <span className="font-normal text-muted"> (opcional)</span>}
      </legend>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      {options.length === 0 && <p className="text-sm text-muted">Nenhuma opção disponível.</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label key={o.value} className="flex min-h-11 items-center gap-3 rounded-ctl border border-linha bg-papel px-3">
            <input
              type="checkbox"
              name={name}
              value={o.value}
              defaultChecked={defaultValues.includes(o.value)}
              className="size-5 accent-acento"
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-erro">
          {error}
        </p>
      )}
    </fieldset>
  );
}
