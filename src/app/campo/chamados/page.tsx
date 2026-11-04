import type { Metadata } from "next";
import Link from "next/link";
import { formatDateBR, todayIso } from "@/domain/dates";
import { isOverdue, type RequestStatus } from "@/domain/request-status";
import { requireProfile } from "@/server/auth";
import { fieldRequestsQuery } from "@/server/field-queries";
import { createSupabaseServer } from "@/server/supabase/server";
import { cn } from "@/ui/cn";
import { EmptyState } from "@/ui/page";
import { AlertTape, StatusBadge } from "@/ui/status";

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
      <h1 className="mb-3 text-2xl font-bold">Chamados</h1>
      <nav aria-label="Filtro de chamados" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/campo/chamados?filtro=${t.key}${onlyMine ? "" : "&meus=0"}`}
            aria-current={t.key === tab.key ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold",
              t.key === tab.key ? "border-grafite bg-grafite text-white" : "border-linha bg-papel",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab.key !== "triagem" && (
        <p className="mb-3 text-sm">
          {onlyMine ? "Mostrando os chamados atribuídos a você. " : "Mostrando todos os chamados dos seus locais. "}
          <Link href={`/campo/chamados?filtro=${tab.key}${onlyMine ? "&meus=0" : ""}`} className="font-semibold text-info underline">
            {onlyMine ? "Ver todos do local" : "Ver só os meus"}
          </Link>
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState title="Nada por aqui." text="Quando a administração programar um chamado para você, ele aparece nesta lista." />
      ) : (
        <ul className="divide-y divide-linha overflow-hidden rounded-panel border border-linha bg-papel">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/campo/chamados/${r.id}`} className="block space-y-1.5 px-4 py-3 hover:bg-concreto">
                <div className="flex items-center justify-between gap-2">
                  <span className="tipo-condensada">{r.number}</span>
                  <StatusBadge status={r.status} />
                </div>
                <p className="font-semibold">{r.title}</p>
                <p className="text-sm text-muted">
                  {r.site?.name}
                  {r.area ? ` · ${r.area.name}` : ""}
                  {r.scheduled_date ? ` · programado ${formatDateBR(r.scheduled_date)}` : ""}
                </p>
                {isOverdue(r.due_date, r.status, today) && <AlertTape>Prazo vencido</AlertTape>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
