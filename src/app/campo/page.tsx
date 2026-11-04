import { Camera, ClipboardList, Hammer, ListChecks, PencilLine, ShoppingCart, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDateBR, longDatePt, todayIso } from "@/domain/dates";
import { isOverdue } from "@/domain/request-status";
import { requireProfile } from "@/server/auth";
import { fieldRequestsQuery } from "@/server/field-queries";
import { createSupabaseServer } from "@/server/supabase/server";
import { cn } from "@/ui/cn";
import { Notice } from "@/ui/page";
import { AlertTape, Badge } from "@/ui/status";
import { StatusRuler } from "@/ui/status-ruler";

export const metadata: Metadata = { title: "Hoje" };

const DONE: Record<string, string> = {
  registro: "Registro salvo. Ele já aparece no diário do dia.",
  compra: "Compra enviada para conferência.",
};

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

  const tiles = [
    { href: "/campo/registrar", label: "Registrar o que foi feito", icon: PencilLine, primary: true },
    { href: "/campo/tarefas", label: "Hoje na agenda", icon: ListChecks, count: tasksToday },
    { href: "/campo/registrar?foto=1", label: "Enviar foto", icon: Camera },
    { href: "/campo/atividades", label: "Minhas atividades", icon: Hammer },
    { href: "/campo/chamados?filtro=pendentes", label: "Pendências", icon: TriangleAlert, count: pendingCount, alert: pendingCount > 0 },
    ...(profile.role !== "worker" ? [{ href: "/campo/compras/nova", label: "Registrar compra", icon: ShoppingCart }] : []),
  ];

  return (
    <>
      <div className="mb-4">
        <p className="text-muted">{longDatePt(today)}</p>
        <h1 className="text-2xl font-bold">Olá, {profile.fullName.split(" ")[0]}</h1>
      </div>
      {feito && DONE[feito] && (
        <div className="mb-4">
          <Notice tone="ok">{DONE[feito]}</Notice>
        </div>
      )}

      <nav aria-label="Ações principais" className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "relative flex min-h-28 flex-col justify-between overflow-hidden rounded-panel border-[1.5px] p-4",
              t.primary ? "col-span-2 min-h-24 border-transparent bg-acento text-white" : "border-linha bg-papel text-grafite hover:border-grafite-2",
            )}
          >
            {t.alert && <span aria-hidden className="faixa-alerta absolute inset-x-0 top-0 h-2" />}
            <t.icon aria-hidden className={cn("size-8", !t.primary && "text-acento")} />
            <span className={cn("tipo-placa text-lg leading-tight", t.primary && "text-xl")}>
              {t.label}
              {typeof t.count === "number" && t.count > 0 && <span className="ml-1">({t.count})</span>}
            </span>
          </Link>
        ))}
      </nav>

      <section className="mt-7">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
          <ClipboardList aria-hidden className="size-5" /> Chamados para hoje
        </h2>
        {list.length === 0 ? (
          <p className="rounded-panel border border-dashed border-linha bg-papel p-4 text-muted">
            Nenhum chamado programado para você hoje. Use “Registrar o que foi feito” para serviços sem chamado.
          </p>
        ) : (
          <ul className="divide-y divide-linha overflow-hidden rounded-panel border border-linha bg-papel">
            {list.map((r) => (
              <li key={r.id}>
                <Link href={`/campo/chamados/${r.id}`} className="block space-y-1.5 px-4 py-3 hover:bg-concreto">
                  <div className="flex items-center justify-between gap-2">
                    <span className="tipo-condensada">{r.number}</span>
                  </div>
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-sm text-muted">
                    {r.site?.name}
                    {r.area ? ` · ${r.area.name}` : ""}
                    {r.due_date ? ` · prazo ${formatDateBR(r.due_date)}` : ""}
                  </p>
                  <StatusRuler status={r.status} size="grande" className="pt-1" />
                  {isOverdue(r.due_date, r.status, today) && <AlertTape>Prazo vencido</AlertTape>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {tasksToday > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
            <ListChecks aria-hidden className="size-5" /> Tarefas na agenda
          </h2>
          <ul className="divide-y divide-linha overflow-hidden rounded-panel border border-linha bg-papel">
            {(occurrences.data ?? []).map((o) => (
              <li key={o.id}>
                <Link href={`/campo/tarefas/${o.id}`} className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-concreto">
                  <span>
                    <span className="block font-semibold">{o.task?.title}</span>
                    <span className="text-sm text-muted">
                      {o.site?.name} · {formatDateBR(o.scheduled_date)}
                    </span>
                  </span>
                  <Badge tone={o.status === "iniciada" ? "acento" : "neutral"}>{o.status === "iniciada" ? "Iniciada" : "Prevista"}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
