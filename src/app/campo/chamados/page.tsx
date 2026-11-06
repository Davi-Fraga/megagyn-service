import type { Metadata } from "next";
import Link from "next/link";
import { formatDateBR, todayIso } from "@/domain/dates";
import { isOverdue, type RequestStatus } from "@/domain/request-status";
import { requireProfile } from "@/server/auth";
import { fieldRequestsQuery } from "@/server/field-queries";
import { createSupabaseServer } from "@/server/supabase/server";
import { cn } from "@/ui/cn";
import { EmptyState } from "@/ui/page";
import { AlertEdge } from "@/ui/status";
import { StatusRuler } from "@/ui/status-ruler";

export const metadata: Metadata = { title: "Chamados" };

const TABS: Array<{ key: string; label: string; statuses: RequestStatus[] }> = [
  { key: "abertos", label: "Em andamento", statuses: ["programada", "em_execucao", "executada"] },
  { key: "pendentes", label: "Pendentes", statuses: ["pendente"] },
  { key: "triagem", label: "Aguardando triagem", statuses: ["aberta"] },
  { key: "encerrados", label: "Encerrados", statuses: ["concluida", "cancelada"] },
];

export default async function FieldRequestsPage({ searchParams }: { searchParams: Promise<{ filtro?: string; meus?: string }> }) {
  const profile = await requireProfile(["worker", "foreman", "admin"]);
  const { filtro, meus } = await searchParams;
  const tab = TABS.find((t) => t.key === filtro) ?? TABS[0]!;
  const onlyMine = meus !== "0";
  const db = await createSupabaseServer();
  const today = todayIso();

  // Na triagem ninguém foi atribuído ainda: a aba mostra todos os chamados dos locais da pessoa.
  const assignedTo = onlyMine && tab.key !== "triagem" ? profile.id : null;
  const { data } = await fieldRequestsQuery(db, tab.statuses, assignedTo)
    .order(tab.key === "encerrados" ? "updated_at" : "scheduled_date", { ascending: tab.key !== "encerrados", nullsFirst: false })
    .limit(100);
  const rows = data ?? [];

  return (
    <>
      <h1 className="mb-4 text-[2.125rem] leading-[1.04]">Chamados</h1>
      <nav aria-label="Filtro de chamados" className="-mx-4 mb-4 flex overflow-x-auto border-b border-linha px-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/campo/chamados?filtro=${t.key}${onlyMine ? "" : "&meus=0"}`}
            aria-current={t.key === tab.key ? "page" : undefined}
            className={cn(
              "relative inline-flex min-h-12 shrink-0 items-center px-3 text-[0.9375rem]",
              t.key === tab.key
                ? "font-bold text-grafite after:absolute after:inset-x-3 after:-bottom-px after:h-[3px] after:bg-acento"
                : "font-medium text-muted",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab.key !== "triagem" && (
        <p className="mb-4 text-[0.9375rem]">
          {onlyMine ? "Mostrando os chamados atribuídos a você. " : "Mostrando todos os chamados dos seus locais. "}
          <Link href={`/campo/chamados?filtro=${tab.key}${onlyMine ? "&meus=0" : ""}`} className="font-semibold text-acento underline decoration-1 underline-offset-[3px]">
            {onlyMine ? "Ver todos do local" : "Ver só os meus"}
          </Link>
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState title="Nada por aqui." text="Quando a administração programar um chamado para você, ele aparece nesta lista." />
      ) : (
        <ul className="-mx-4 divide-y divide-linha border-y border-linha">
          {rows.map((r) => {
            const overdue = isOverdue(r.due_date, r.status, today);
            return (
              <li key={r.id} className="relative">
                {overdue && <AlertEdge />}
                <Link href={`/campo/chamados/${r.id}`} className="block py-4 pl-5 pr-4 hover:bg-concreto/45">
                  <span className="tipo-condensada flex justify-between gap-3 text-[0.9375rem]">
                    <span>{r.number}</span>
                    {overdue ? (
                      <span className="text-erro">Prazo vencido em {formatDateBR(r.due_date).slice(0, 5)}</span>
                    ) : (
                      r.scheduled_date && <span className="text-muted">Programado para {formatDateBR(r.scheduled_date).slice(0, 5)}</span>
                    )}
                  </span>
                  <h2 className="tipo-normal mt-1 text-[1.1875rem] font-semibold leading-tight">{r.title}</h2>
                  <p className="mt-0.5 text-[0.9375rem] text-muted">{[r.site?.name, r.area?.name].filter(Boolean).join(", ")}</p>
                  <StatusRuler status={r.status} size="grande" className="mt-3.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
