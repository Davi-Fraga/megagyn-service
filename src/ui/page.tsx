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
    <header className="mb-6 space-y-2">
      {back && (
        <Link href={back.href} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted hover:text-grafite">
          <ChevronLeft aria-hidden className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {eyebrow && <div className="text-sm text-muted">{eyebrow}</div>}
          <h1 className="text-2xl font-bold sm:text-[1.75rem]">{title}</h1>
          {description && <div className="max-w-prose text-muted">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

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
    <section id={id} className={cn("rounded-panel border border-linha bg-papel", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linha px-4 py-3">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="rounded-panel border border-dashed border-linha bg-papel px-4 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-prose text-muted">{text}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function DescriptionList({ items }: { items: Array<{ label: string; value: ReactNode; hidden?: boolean }> }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items
        .filter((i) => !i.hidden)
        .map((i) => (
          <div key={i.label} className="min-w-0">
            <dt className="text-sm text-muted">{i.label}</dt>
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
  return <div className={cn("rounded-ctl border px-3 py-2 text-sm font-medium", cls)}>{children}</div>;
}

/** Lista com divisórias (celular e desktop); cada linha pode ser um link. */
export function RowList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-linha overflow-hidden rounded-panel border border-linha bg-papel">{children}</ul>;
}
