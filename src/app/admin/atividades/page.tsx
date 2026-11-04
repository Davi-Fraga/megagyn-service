import type { Metadata } from "next";
import Link from "next/link";
import {
  addDaysIso,
  formatDateBR,
  isValidIsoDate,
  todayIso,
} from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { markReviewedAction } from "@/server/actions/activities";
import { loadProfiles, loadSites } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { buttonClass } from "@/ui/button";
import { ActionForm } from "@/ui/form";
import { EmptyState, PageHeader } from "@/ui/page";
import { Badge } from "@/ui/status";

export const metadata: Metadata = { title: "Atividades" };

const REVIEW: Record<
  string,
  { label: string; tone: "neutral" | "ok" | "info" }
> = {
  enviado: { label: "A revisar", tone: "neutral" },
  revisado: { label: "Revisado", tone: "ok" },
  ajustado: { label: "Ajustado", tone: "info" },
};

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    cliente?: string;
    local?: string;
    pessoa?: string;
    de?: string;
    ate?: string;
    revisao?: string;
  }>;
}) {
  const sp = await searchParams;
  const today = todayIso();
  const from = sp.de && isValidIsoDate(sp.de) ? sp.de : addDaysIso(today, -14);
  const to = sp.ate && isValidIsoDate(sp.ate) ? sp.ate : today;
  const clientId = sp.cliente && UUID_RE.test(sp.cliente) ? sp.cliente : null;
  const db = await createSupabaseServer();
  // Com cliente: o embed "inner" filtra os lançamentos pelos locais dele (mesmo critério do painel).
  const siteEmbed = clientId
    ? "site:sites!inner(name, client_id)"
    : "site:sites(name, client_id)";
  let q = db
    .from("work_entries")
    .select(
      `id, activity_date, description, outcome, review_status, client_visible, author_id, service_request_id, task_occurrence_id, ${siteEmbed}, request:service_requests(number)`,
      { count: "exact" },
    )
    .gte("activity_date", from)
    .lte("activity_date", to)
    .order("activity_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);
  if (clientId) q = q.eq("site.client_id", clientId);
  if (sp.local && UUID_RE.test(sp.local)) q = q.eq("site_id", sp.local);
  if (sp.pessoa && UUID_RE.test(sp.pessoa)) q = q.eq("author_id", sp.pessoa);
  if (sp.revisao && ["enviado", "revisado", "ajustado"].includes(sp.revisao))
    q = q.eq(
      "review_status",
      sp.revisao as "enviado" | "revisado" | "ajustado",
    );
  const [{ data, count }, sites, profiles, clients] = await Promise.all([
    q,
    loadSites(db),
    loadProfiles(db),
    db.from("clients").select("id, display_name").order("display_name"),
  ]);
  const rows = data ?? [];
  const total = count ?? rows.length;

  return (
    <>
      <PageHeader
        title="Atividades registradas"
        description="Tudo o que a equipe lançou. Revise e, se precisar, ajuste com motivo — o envio original fica guardado."
      />
      <form
        method="get"
        className="mb-5 grid gap-3 rounded-panel border border-linha bg-papel p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
      >
        <label className="space-y-1 text-sm font-semibold">
          Cliente
          <select
            name="cliente"
            defaultValue={clientId ?? ""}
            className="campo-input"
          >
            <option value="">Todos</option>
            {(clients.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Obra ou unidade
          <select
            name="local"
            defaultValue={sp.local ?? ""}
            className="campo-input"
          >
            <option value="">Todas</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.clientName} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Quem registrou
          <select
            name="pessoa"
            defaultValue={sp.pessoa ?? ""}
            className="campo-input"
          >
            <option value="">Todos</option>
            {profiles.list
              .filter((p) => p.role !== "client")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          De
          <input
            type="date"
            name="de"
            defaultValue={from}
            className="campo-input"
          />
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Até
          <input
            type="date"
            name="ate"
            defaultValue={to}
            className="campo-input"
          />
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Revisão
          <select
            name="revisao"
            defaultValue={sp.revisao ?? ""}
            className="campo-input"
          >
            <option value="">Todas</option>
            <option value="enviado">A revisar</option>
            <option value="revisado">Revisado</option>
            <option value="ajustado">Ajustado</option>
          </select>
        </label>
        <button type="submit" className={buttonClass("dark")}>
          Filtrar
        </button>
      </form>

      <p className="mb-2 text-sm text-muted" aria-live="polite">
        {total} atividade(s) no período
        {total > rows.length
          ? `; mostrando as ${rows.length} mais recentes. Use os filtros para ver as demais`
          : ""}
        .
      </p>

      {rows.length === 0 ? (
        <EmptyState title="Nenhuma atividade no período." />
      ) : (
        <ActionForm
          action={markReviewedAction}
          submitLabel="Marcar selecionados como revisados"
          submitVariant="secondary"
        >
          <ul className="divide-y divide-linha overflow-hidden rounded-panel border border-linha bg-papel">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                {r.review_status === "enviado" ? (
                  <input
                    type="checkbox"
                    name="work_entry_ids"
                    value={r.id}
                    aria-label={`Selecionar ${r.description}`}
                    className="mt-1 size-5 accent-laranja"
                  />
                ) : (
                  <span className="size-5" />
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/atividades/${r.id}`}
                    className="font-semibold hover:underline"
                  >
                    {r.description}
                  </Link>
                  <p className="text-sm text-muted">
                    {formatDateBR(r.activity_date)} · {r.site?.name} ·{" "}
                    {profiles.name(r.author_id)}
                    {r.request
                      ? ` · chamado ${r.request.number}`
                      : r.task_occurrence_id
                        ? " · tarefa"
                        : " · avulsa"}
                    {r.outcome !== "executado"
                      ? r.outcome === "parcial"
                        ? " · feito em parte"
                        : " · não realizado"
                      : ""}
                    {!r.client_visible ? " · interno" : ""}
                  </p>
                </div>
                <Badge tone={REVIEW[r.review_status]?.tone ?? "neutral"}>
                  {REVIEW[r.review_status]?.label ?? r.review_status}
                </Badge>
              </li>
            ))}
          </ul>
        </ActionForm>
      )}
    </>
  );
}
