import { Camera, Hammer, ListChecks, PencilLine, ShoppingCart, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDateBR, longDatePt, todayIso } from "@/domain/dates";
import { isOverdue } from "@/domain/request-status";
import { requireProfile } from "@/server/auth";
import { fieldRequestsQuery } from "@/server/field-queries";
import { createSupabaseServer } from "@/server/supabase/server";
import { ButtonLink } from "@/ui/button";
import { cn } from "@/ui/cn";
import { Notice } from "@/ui/page";
import { AlertEdge, Badge } from "@/ui/status";
import { StatusRuler } from "@/ui/status-ruler";

export const metadata: Metadata = { title: "Hoje" };

const DONE: Record<string, string> = {
  registro: "Registro salvo. Ele já aparece no diário do dia.",
  compra: "Compra enviada para conferência.",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function FieldTodayPage({ searchParams }: { searchParams: Promise<{ feito?: string }> }) {
  const profile = await requireProfile(["worker", "foreman", "admin"]);
  const { feito } = await searchParams;
  const db = await createSupabaseServer();
  const today = todayIso();

  const [requests, myAssignments, occurrences] = await Promise.all([
    fieldRequestsQuery(db, ["programada", "em_execucao", "pendente"], profile.role === "admin" ? null : profile.id)
      .or(`status.eq.pendente,scheduled_date.is.null,scheduled_date.lte.${today}`)
      .order("scheduled_date", { ascending: true, nullsFirst: false })
      .limit(100),
    db.from("request_assignments").select("service_request_id").eq("profile_id", profile.id).is("unassigned_at", null),
    db
      .from("task_occurrences")
      .select("id, scheduled_date, status, task:tasks(id, title), site:sites(name)")
      .lte("scheduled_date", today)
      .in("status", ["prevista", "iniciada"])
      .order("scheduled_date"),
  ]);

  const mine = new Set((myAssignments.data ?? []).map((a) => a.service_request_id));
  const list = requests.data ?? [];
  const pendingCount = list.filter((r) => r.status === "pendente" && mine.has(r.id)).length;
  const tasksToday = (occurrences.data ?? []).length;

  // Título da tela: a obra do dia (com duas, as duas; com mais, quantas são).
  const siteNames = [...new Set([...list.map((r) => r.site?.name), ...(occurrences.data ?? []).map((o) => o.site?.name)].filter((n): n is string => !!n))];
  const firstName = profile.fullName.split(" ")[0];
  const day = longDatePt(today).replace(/ de \d{4}$/, "");
  const title = siteNames.length === 0 ? `Olá, ${firstName}` : siteNames.length <= 2 ? siteNames.join(" e ") : `${siteNames.length} obras hoje`;
  const context = siteNames.length === 0 ? `${day.charAt(0).toUpperCase()}${day.slice(1)}` : `Olá, ${firstName}. ${day.charAt(0).toUpperCase()}${day.slice(1)}`;
  const oneSite = siteNames.length === 1;

  const shortcuts = [
    { href: "/campo/tarefas", label: "Hoje na agenda", icon: ListChecks, count: tasksToday },
    { href: "/campo/registrar?foto=1", label: "Enviar foto", icon: Camera },
    { href: "/campo/atividades", label: "Minhas atividades", icon: Hammer },
    { href: "/campo/chamados?filtro=pendentes", label: "Pendências", icon: TriangleAlert, count: pendingCount },
    ...(profile.role !== "worker" ? [{ href: "/campo/compras/nova", label: "Registrar compra", icon: ShoppingCart }] : []),
  ];

  return (
    // Espaço no fim para o último item não ficar atrás do botão fixo.
    <div className="pb-24">
      <header className="-mx-4 -mt-5 bg-concreto px-4 pb-5 pt-3">
        <p className="text-[0.9375rem] font-medium text-muted">{context}</p>
        <h1 className="mt-1 text-[2.125rem] leading-[1.04]">{title}</h1>
        <p className="mt-2 text-[0.9375rem]">
          {plural(list.length, "chamado para hoje", "chamados para hoje")} e {plural(tasksToday, "tarefa na agenda", "tarefas na agenda")}.
        </p>
      </header>
      {feito && DONE[feito] && (
        <div className="mt-4">
          <Notice tone="ok">{DONE[feito]}</Notice>
        </div>
      )}

      <section className="mt-6">
        <h2 className="tipo-normal mb-2 text-[0.9375rem] font-[650]">Chamados para hoje</h2>
        {list.length === 0 ? (
          <p className="-mx-4 border-y border-linha px-4 py-5 text-muted">
            Nenhum chamado programado para você hoje. Use “Registrar o que foi feito” para serviços sem chamado.
          </p>
        ) : (
          <ul className="-mx-4 divide-y divide-linha border-y border-linha">
            {list.map((r) => {
              const overdue = isOverdue(r.due_date, r.status, today);
              const place = oneSite ? (r.area?.name ?? r.site?.name) : [r.site?.name, r.area?.name].filter(Boolean).join(", ");
              return (
                <li key={r.id} className="relative">
                  {overdue && <AlertEdge />}
                  <Link href={`/campo/chamados/${r.id}`} className="block py-4 pl-5 pr-4 hover:bg-concreto/45">
                    <span className="tipo-condensada flex justify-between gap-3 text-[0.9375rem]">
                      <span>{r.number}</span>
                      {overdue ? (
                        <span className="text-erro">Prazo vencido em {formatDateBR(r.due_date).slice(0, 5)}</span>
                      ) : (
                        r.due_date && <span className="text-muted">Prazo {formatDateBR(r.due_date).slice(0, 5)}</span>
                      )}
                    </span>
                    <h3 className="mt-1 text-[1.1875rem] font-semibold leading-tight">{r.title}</h3>
                    {place && <p className="mt-0.5 text-[0.9375rem] text-muted">{place}</p>}
                    <StatusRuler status={r.status} size="grande" className="mt-3.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {tasksToday > 0 && (
        <section className="mt-7">
          <h2 className="tipo-normal mb-2 text-[0.9375rem] font-[650]">Tarefas na agenda</h2>
          <ul className="-mx-4 divide-y divide-linha border-y border-linha">
            {(occurrences.data ?? []).map((o) => (
              <li key={o.id}>
                <Link href={`/campo/tarefas/${o.id}`} className="flex min-h-16 items-center justify-between gap-3 py-3 pl-5 pr-4 hover:bg-concreto/45">
                  <span className="min-w-0">
                    <span className="block text-[1.0625rem] font-semibold leading-snug">{o.task?.title}</span>
                    <span className="tipo-condensada mt-0.5 block text-[0.9375rem] font-medium text-muted">
                      {o.scheduled_date < today ? `Desde ${formatDateBR(o.scheduled_date)}` : "Hoje"}
                      {!oneSite && o.site?.name ? `, ${o.site.name}` : ""}
                    </span>
                  </span>
                  <Badge tone={o.status === "iniciada" ? "acento" : "neutral"}>{o.status === "iniciada" ? "Iniciada" : "Prevista"}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav aria-label="Ações principais" className="mt-8 grid grid-cols-2 gap-2">
        {shortcuts.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="flex min-h-12 items-center gap-2.5 rounded-ctl border border-controle bg-papel px-3 text-[0.9375rem] font-semibold leading-tight hover:bg-concreto"
          >
            <t.icon aria-hidden className="size-5 shrink-0 text-acento" />
            <span>
              {t.label}
              {typeof t.count === "number" && t.count > 0 && <span className={cn("ml-1", t.href.includes("pendentes") && "text-alerta")}>({t.count})</span>}
            </span>
          </Link>
        ))}
      </nav>

      <div className="fixed inset-x-0 bottom-[var(--sticky-offset,0px)] z-20 border-t border-linha bg-papel px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <ButtonLink href="/campo/registrar" size="lg" icon={<PencilLine aria-hidden className="size-5" />}>
            Registrar o que foi feito
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
