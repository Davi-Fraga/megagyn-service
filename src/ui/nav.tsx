"use client";

import { Bell, ClipboardList, Hammer, Home, ListChecks, Menu, ShoppingCart, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Brand } from "./brand";
import { cn } from "./cn";

type Target = { href: string; exact?: boolean; also?: string[] };
type AdminItem = Target & { label: string };
type Item = AdminItem & { icon: LucideIcon };

/** Menu da administração agrupado pelo que a pessoa vai fazer (sem título no grupo "Hoje"). */
const ADMIN_GROUPS: Array<{ title: string | null; items: AdminItem[] }> = [
  { title: null, items: [{ href: "/admin", label: "Hoje", exact: true }] },
  {
    title: "Operação",
    items: [
      { href: "/admin/chamados", label: "Chamados e OS" },
      { href: "/admin/agenda", label: "Agenda" },
      { href: "/admin/diario", label: "Diário de obra" },
      { href: "/admin/atividades", label: "Atividades" },
      { href: "/admin/horas", label: "Horas e diárias" },
      { href: "/admin/despesas", label: "Compras e despesas" },
      { href: "/admin/reembolsos", label: "Reembolsos" },
    ],
  },
  {
    title: "Comercial",
    items: [
      { href: "/admin/orcamentos", label: "Orçamentos" },
      { href: "/admin/fechamentos", label: "Fechamento mensal" },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { href: "/admin/clientes", label: "Clientes e locais", also: ["/admin/locais"] },
      { href: "/admin/usuarios", label: "Usuários" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { href: "/admin/relatorios", label: "Relatórios" },
      { href: "/admin/configuracoes", label: "Configurações" },
      { href: "/admin/auditoria", label: "Auditoria" },
    ],
  },
];

function isActive(pathname: string, item: Target) {
  if (item.exact) return pathname === item.href;
  return [item.href, ...(item.also ?? [])].some((h) => pathname === h || pathname.startsWith(`${h}/`));
}

export function AdminNav({ userName, unread, signOutAction }: { userName: string; unread: number; signOutAction: () => Promise<void> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = (
    <nav aria-label="Menu da administração">
      {ADMIN_GROUPS.map((g) => (
        <div key={g.title ?? "hoje"} className={cn(g.title && "mt-5 lg:mt-4")}>
          {g.title && <p className="px-6 pb-1 text-[0.8125rem] font-medium text-muted">{g.title}</p>}
          <ul>
            {g.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      // Mais baixo no computador para o menu inteiro caber em monitor Full HD; no celular segue 40 px.
                      "relative flex min-h-10 items-center px-6 text-[0.9375rem] lg:min-h-9",
                      active
                        ? "bg-papel font-[680] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-acento"
                        : "hover:bg-papel/55",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-linha bg-concreto px-4 py-2 lg:hidden">
        <Link href="/admin" aria-label="Painel" className="flex min-h-11 items-center">
          <Brand compact />
        </Link>
        <div className="flex items-center gap-1">
          <BellLink href="/admin/notificacoes" unread={unread} />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="admin-mobile-menu"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-ctl hover:bg-concreto-2"
          >
            {open ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
            <span className="sr-only">{open ? "Fechar menu" : "Abrir menu"}</span>
          </button>
        </div>
      </header>
      {open && (
        <div id="admin-mobile-menu" className="border-b border-linha bg-concreto pb-5 pt-2 lg:hidden" onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}>
          {links}
          <SignOut userName={userName} action={signOutAction} className="mt-6 pt-4" />
        </div>
      )}

      {/* O fundo fica na coluna inteira; o menu fica preso no topo dentro dela.
          Em tela baixa só a lista rola: quem está logado e o "Sair" ficam sempre à vista. */}
      <div className="hidden bg-concreto lg:block">
        <aside className="sticky top-0 flex h-dvh flex-col py-5">
          <div className="mb-3 flex items-center justify-between pl-6 pr-3">
            <Link href="/admin" aria-label="Painel">
              <Brand />
            </Link>
            <BellLink href="/admin/notificacoes" unread={unread} />
          </div>
          {/* Barra fina: em notebook a lista rola, e a barra é o sinal de que há mais itens abaixo. */}
          <div className="min-h-0 flex-1 overflow-y-auto pb-2 [scrollbar-width:thin]">{links}</div>
          <SignOut userName={userName} action={signOutAction} className="border-t border-linha pt-3" />
        </aside>
      </div>
    </>
  );
}

function SignOut({ userName, action, className }: { userName: string; action: () => Promise<void>; className: string }) {
  return (
    <form action={action} className={cn("px-6", className)}>
      <p className="truncate text-[0.9375rem] font-semibold leading-snug">{userName}</p>
      <p className="text-[0.8125rem] text-muted">Administração</p>
      <button type="submit" className="mt-1 min-h-10 text-[0.8125rem] text-acento underline decoration-1 underline-offset-[3px] hover:decoration-2">
        Sair
      </button>
    </form>
  );
}

function BellLink({ href, unread }: { href: string; unread: number }) {
  return (
    <Link
      href={href}
      className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-ctl text-grafite hover:bg-concreto-2"
      aria-label={unread > 0 ? `Notificações: ${unread} não lidas` : "Notificações"}
    >
      <Bell aria-hidden className="size-5" />
      {unread > 0 && (
        <span className="tipo-condensada absolute right-0.5 top-1 min-w-5 rounded-ctl bg-acento px-1 text-center text-xs text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

export function FieldNav({ isForeman, unread, userName, signOutAction }: { isForeman: boolean; unread: number; userName: string; signOutAction: () => Promise<void> }) {
  const pathname = usePathname();
  const items: Item[] = [
    { href: "/campo", label: "Hoje", icon: Home, exact: true },
    { href: "/campo/chamados", label: "Chamados", icon: ClipboardList },
    { href: "/campo/tarefas", label: "Agenda", icon: ListChecks },
    { href: "/campo/atividades", label: "Feito", icon: Hammer },
    ...(isForeman ? [{ href: "/campo/compras", label: "Compras", icon: ShoppingCart }] : []),
  ];
  return (
    <>
      <header className="sticky top-0 z-30 bg-concreto">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2">
          <Link href="/campo" aria-label="Início" className="flex min-h-11 items-center">
            <Brand compact />
          </Link>
          <div className="flex items-center gap-1">
            <BellLink href="/campo/notificacoes" unread={unread} />
            <form action={signOutAction}>
              <button type="submit" className="min-h-11 rounded-ctl px-3 text-[0.9375rem] font-medium text-muted hover:bg-concreto-2" title={userName}>
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <nav
        aria-label="Menu do campo"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-linha bg-papel pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto flex max-w-3xl">
          {items.map((item) => {
            const active = isActive(pathname, item);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-16 flex-col items-center justify-center gap-1 text-[0.8125rem]",
                    active
                      ? "font-bold text-grafite before:absolute before:inset-x-[24%] before:-top-px before:h-[3px] before:bg-acento"
                      : "font-medium text-muted",
                  )}
                >
                  <item.icon aria-hidden className="size-6" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
