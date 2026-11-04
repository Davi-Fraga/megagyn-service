import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";

export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-8 space-y-3">
      {back && (
        <Link
          href={back.href}
          className="-ml-1 inline-flex min-h-11 items-center gap-1 pr-1 text-[0.9375rem] font-medium text-acento underline decoration-1 underline-offset-[3px] hover:decoration-2"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 space-y-2">
          {eyebrow && <div className="text-muted">{eyebrow}</div>}
          <h1 className="text-[1.75rem] sm:text-[2.125rem]">{title}</h1>
          {description && <div className="max-w-prose text-muted">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Bloco da página: título na expandida e uma linha fina em cima, sem caixa. */
export function Panel({
  title,
  actions,
  children,
  className,
  id,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("border-t border-linha pt-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-[1.3125rem]">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="border-y border-linha py-8">
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-prose text-muted">{text}</p>}
      {action && <div className="mt-4 flex">{action}</div>}
    </div>
  );
}

export function DescriptionList({ items }: { items: Array<{ label: string; value: ReactNode; hidden?: boolean }> }) {
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {items
        .filter((i) => !i.hidden)
        .map((i) => (
          <div key={i.label} className="min-w-0">
            <dt className="text-[0.8125rem] text-muted">{i.label}</dt>
            <dd className="font-medium break-words">{i.value ?? "—"}</dd>
          </div>
        ))}
    </dl>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "alerta" | "ok" | "erro"; children: ReactNode }) {
  const cls = {
    info: "border-info bg-info-claro text-info",
    alerta: "border-alerta bg-alerta-claro text-alerta",
    ok: "border-ok bg-ok-claro text-ok",
    erro: "border-erro bg-erro-claro text-erro",
  }[tone];
  return <div className={cn("border-l-[3px] px-3 py-2 text-sm font-medium", cls)}>{children}</div>;
}

/** Lista com divisórias finas (celular e desktop); cada linha pode ser um link. */
export function RowList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-linha border-y border-linha">{children}</ul>;
}
