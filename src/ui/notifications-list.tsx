import Link from "next/link";
import { formatDateTimeBR } from "@/domain/dates";
import { markAllReadAction } from "@/server/actions/notifications";
import { createSupabaseServer } from "@/server/supabase/server";
import { cn } from "./cn";
import { ActionForm } from "./form";
import { EmptyState, PageHeader } from "./page";

/** Avisos internos (o MVP não envia e-mail, WhatsApp nem push). */
export async function NotificationsList({ base }: { base: "/admin" | "/campo" }) {
  const db = await createSupabaseServer();
  const { data } = await db.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  const list = data ?? [];
  const unread = list.filter((n) => !n.read_at).length;
  const fix = (link: string | null) => {
    if (!link) return null;
    if (base === "/admin" && link.startsWith("/campo/chamados/")) return link.replace("/campo/", "/admin/");
    if (base === "/campo" && link.startsWith("/admin/chamados/")) return link.replace("/admin/", "/campo/");
    return link;
  };
  return (
    <>
      <PageHeader title="Notificações" description="Avisos dentro do sistema sobre atribuições, pendências, validações e compras." />
      {unread > 0 && (
        <div className="mb-4">
          <ActionForm action={markAllReadAction} submitLabel={`Marcar ${unread} como lida(s)`} submitVariant="secondary">
            <span />
          </ActionForm>
        </div>
      )}
      {list.length === 0 ? (
        <EmptyState title="Nenhuma notificação." />
      ) : (
        <ul className="divide-y divide-linha overflow-hidden rounded-panel border border-linha bg-papel">
          {list.map((n) => {
            const href = fix(n.link);
            const content = (
              <>
                <p className={cn(!n.read_at && "font-bold")}>
                  {!n.read_at && <span className="mr-2 inline-block size-2 rounded-full bg-acento" aria-label="Não lida" />}
                  {n.title}
                </p>
                {n.body && <p className="text-sm">{n.body}</p>}
                <p className="text-xs text-muted">{formatDateTimeBR(n.created_at)}</p>
              </>
            );
            return (
              <li key={n.id}>
                {href ? (
                  <Link href={href} className="block px-4 py-3 hover:bg-concreto">
                    {content}
                  </Link>
                ) : (
                  <div className="px-4 py-3">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
