"use client";

import {
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  FileText,
  Hammer,
  Home,
  LayoutDashboard,
  ListChecks,
  Menu,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Brand } from "./brand";
import { cn } from "./cn";

type Item = { href: string; label: string; icon: LucideIcon; exact?: boolean; also?: string[] };

const ADMIN_GROUPS: Array<{ title: string; items: Item[] }> = [
  {
    title: "Operação",
    items: [
      { href: "/admin", label: "Painel", icon: LayoutDashboard, exact: true },
      { href: "/admin/chamados", label: "Chamados e OS", icon: ClipboardList },
      { href: "/admin/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/admin/diario", label: "Diário de obra", icon: BookOpen },
      { href: "/admin/atividades", label: "Atividades", icon: Hammer },
    ],
  },
  {
    title: "Financeiro interno",
    items: [
      { href: "/admin/despesas", label: "Compras e despesas", icon: Receipt },
      { href: "/admin/reembolsos", label: "Reembolsos", icon: Wallet },
      { href: "/admin/horas", label: "Horas e diárias", icon: Clock },
    ],
  },
  {
    title: "Documentos",
    items: [
      { href: "/admin/orcamentos", label: "Orçamentos", icon: FileText },
      { href: "/admin/fechamentos", label: "Fechamento mensal", icon: FileSpreadsheet },
      { href: "/admin/relatorios", label: "Relatórios", icon: ScrollText },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { href: "/admin/clientes", label: "Clientes e locais", icon: Building2, also: ["/admin/locais"] },
      { href: "/admin/usuarios", label: "Usuários", icon: Users },
      { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
      { href: "/admin/auditoria", label: "Auditoria", icon: ShieldCheck },
    ],
  },
];

function isActive(pathname: string, item: Item) {
  if (item.exact) return pathname === item.href;
  return [item.href, ...(item.also ?? [])].some((h) => pathname === h || pathname.startsWith(`${h}/`));
}

export function AdminNav({ userName, unread, signOutAction }: { userName: string; unread: number; signOutAction: () => Promise<void> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = (
    <nav aria-label="Menu da administração" className="space-y-5">
      {ADMIN_GROUPS.map((g) => (
        <div key={g.title}>
          <p className="mb-1 px-3 text-xs font-semibold text-white/55">{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 items-center gap-3 rounded-ctl px-3 text-[0.95rem]",
                      active ? "bg-white font-semibold text-grafite" : "text-white/85 hover:bg-white/10",
                    )}
                  >
                    <item.icon aria-hidden className={cn("size-[1.15rem]", active && "text-acento")} />
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
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-grafite px-4 py-2.5 text-white lg:hidden">
        <Link href="/admin" aria-label="Painel">
          <Brand inverted compact />
        </Link>
        <div className="flex items-center gap-1">
          <BellLink href="/admin/notificacoes" unread={unread} />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="admin-mobile-menu"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-ctl hover:bg-white/10"
          >
            {open ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
            <span className="sr-only">{open ? "Fechar menu" : "Abrir menu"}</span>
          </button>
        </div>
      </header>
      {open && (
        <div id="admin-mobile-menu" className="bg-grafite px-3 pb-5 pt-2 lg:hidden" onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}>
          {links}
          <SignOut userName={userName} action={signOutAction} />
        </div>
      )}

      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto bg-grafite px-3 py-5 text-white lg:flex">
        <div className="mb-6 flex items-center justify-between px-2">
          <Link href="/admin" aria-label="Painel">
            <Brand inverted />
          </Link>
          <BellLink href="/admin/notificacoes" unread={unread} />
        </div>
        <div className="flex-1">{links}</div>
        <SignOut userName={userName} action={signOutAction} />
      </aside>
    </>
  );
}

function SignOut({ userName, action }: { userName: string; action: () => Promise<void> }) {
  return (
    <form action={action} className="mt-6 border-t border-white/15 px-3 pt-4 text-sm">
      <p className="truncate text-white/70">{userName}</p>
      <button type="submit" className="mt-1 min-h-10 font-semibold text-white underline">
        Sair
      </button>
    </form>
  );
}

function BellLink({ href, unread, dark = false }: { href: string; unread: number; dark?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-ctl",
        dark ? "text-grafite hover:bg-concreto-2" : "text-white hover:bg-white/10",
      )}
      aria-label={unread > 0 ? `Notificações: ${unread} não lidas` : "Notificações"}
    >
      <Bell aria-hidden className="size-5" />
      {unread > 0 && (
        <span className="absolute right-1 top-1 min-w-5 rounded-full bg-acento px-1 text-center text-xs font-bold text-white">
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
      <header className="sticky top-0 z-30 border-b border-linha bg-papel">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2">
          <Link href="/campo" aria-label="Início" className="flex min-h-11 items-center">
            <Brand compact />
          </Link>
          <div className="flex items-center gap-1">
            <BellLink href="/campo/notificacoes" unread={unread} dark />
            <form action={signOutAction}>
              <button type="submit" className="min-h-11 rounded-ctl px-3 text-sm font-semibold text-muted hover:bg-concreto-2" title={userName}>
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
                    "flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold",
                    active ? "text-acento" : "text-muted",
                  )}
                >
                  <item.icon aria-hidden className="size-6" />
                  {item.label}
                  <span aria-hidden className={cn("mt-0.5 h-1 w-8 rounded-full", active ? "bg-acento" : "bg-transparent")} />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
