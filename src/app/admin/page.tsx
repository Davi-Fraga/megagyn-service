import type { Metadata } from "next";
import Link from "next/link";
import { addDaysIso, formatDateBR, isValidIsoDate, longDatePt, todayIso } from "@/domain/dates";
import { expenseFiltersToQuery } from "@/domain/expense-filters";
import { headlineTotals } from "@/domain/expense-totals";
import { UUID_RE } from "@/domain/ids";
import { formatBRL } from "@/domain/money";
import { REQUEST_STATUSES, STATUS_LABEL } from "@/domain/request-status";
import { dashboardExpenseFilters, loadDashboardRows } from "@/server/dashboard";
import { loadProfiles, loadSites } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { ButtonLink, buttonClass } from "@/ui/button";
import { cn } from "@/ui/cn";
import { AlertEdge } from "@/ui/status";
import { StatusRuler } from "@/ui/status-ruler";
import { DataTable } from "@/ui/data-table";

export const metadata: Metadata = { title: "Painel" };

/**
 * Indicador do painel: o número abre a lista com o mesmo total (B-11). Sem caixa: uma
 * linha fina em cima, o título como link que cobre o bloco e o número na expandida.
 */
function Card({
  title,
  value,
  window,
  rule,
  href,
  alert,
  children,
}: {
  title: string;
  value: React.ReactNode;
  window: string;
  rule: string;
  href?: string;
  alert?: boolean;
  children?: React.ReactNode;
}) {
  // Link "esticado" no título: o card inteiro é clicável sem aninhar <a> (links internos ficam acima).
  return (
    <div className={cn("relative border-t border-linha pt-4", href && "hover:border-grafite")}>
      {alert && <span aria-hidden className="faixa-alerta absolute inset-x-0 -top-px h-1.5" />}
      <p className="text-[0.9375rem] font-semibold leading-snug">
        {href ? (
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-acento">
            {title}
          </Link>
        ) : (
          title
        )}
      </p>
      <p className="tipo-placa mt-2 text-[2.125rem]">{value}</p>
      {children}
      <p className="mt-3 text-[0.8125rem] leading-snug text-muted">
        <span className="font-semibold">Janela:</span> {window}. <span className="font-semibold">Regra:</span> {rule}
      </p>
    </div>
  );
}

/** Ação de cada linha de "O que precisa de você"; a ordem da fila vem do banco (dashboard_summary). */
const QUEUE_ACTION: Record<string, string> = {
  aberta: "Fazer triagem",
  programada: "Reprogramar",
  em_execucao: "Abrir a ordem",
  pendente: "Ver pendência",
  executada: "Validar serviço",
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; local?: string; pessoa?: string; de?: string; ate?: string }>;
}) {
  const sp = await searchParams;
  const today = todayIso();
  const from = sp.de && isValidIsoDate(sp.de) ? sp.de : addDaysIso(today, -29);
  const to = sp.ate && isValidIsoDate(sp.ate) ? sp.ate : today;
  const clientId = sp.cliente && UUID_RE.test(sp.cliente) ? sp.cliente : null;
  const siteId = sp.local && UUID_RE.test(sp.local) ? sp.local : null;
  const personId = sp.pessoa && UUID_RE.test(sp.pessoa) ? sp.pessoa : null;
  const db = await createSupabaseServer();
  const filters = { clientId, siteId, personId, from, to, today };

  const [rows, sites, profiles, clients] = await Promise.all([
    loadDashboardRows(db, filters),
    loadSites(db),
    loadProfiles(db),
    db.from("clients").select("id, display_name").order("display_name"),
  ]);

  // Contagens feitas no banco, com os mesmos filtros das listas que os cartões abrem.
  const { summary } = rows;
  const byStatus = Object.fromEntries(REQUEST_STATUSES.map((s) => [s, summary.requests.by_status[s] ?? 0]));
  const { new_today: newToday, overdue, not_closed: notClosed } = summary.requests;
  const pendingCount = byStatus.pendente ?? 0;
  const byReason = summary.requests.pending_by_reason.map((p) => ({ label: p.label ?? "Sem motivo", count: p.count }));
  const byOwner = summary.requests.pending_by_owner.map((p) => ({ label: p.label ?? "—", count: p.count }));

  // Mesma consulta e mesmo critério da agenda (local, cliente e profissional).
  const occurrences = rows.occurrences;
  const occBy = (s: string) => occurrences.filter((o) => o.status === s).length;

  const siteName = new Map(sites.map((s) => [s.id, `${s.name} (${s.clientName})`]));

  // Custo interno: a mesma lista e a mesma soma da tela de despesas (com obra ou cliente,
  // soma das parcelas atribuídas; sem filtro, total das compras).
  const expenseFilters = dashboardExpenseFilters(filters);
  const expenses = headlineTotals(rows.expenses.totals, siteId, clientId).values;
  const expLink = (status: "aprovado" | "enviado_para_conferencia") => `/admin/despesas?${expenseFiltersToQuery({ ...expenseFilters, status })}`;

  const filterQs = new URLSearchParams();
  if (clientId) filterQs.set("cliente", clientId);
  if (siteId) filterQs.set("local", siteId);
  if (personId) filterQs.set("responsavel", personId);
  const reqLink = (extra: Record<string, string>) => {
    const q = new URLSearchParams(filterQs);
    Object.entries(extra).forEach(([k, v]) => q.set(k, v));
    return `/admin/chamados?${q.toString()}`;
  };
  // Link de outra lista com os filtros do painel que ela entende (valores nulos ficam de fora).
  const listLink = (path: string, params: Record<string, string | null>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && q.set(k, v));
    return `${path}?${q.toString()}`;
  };
  const periodLabel = `${formatDateBR(from)} a ${formatDateBR(to)}`;
  const agendaToday = listLink("/admin/agenda", { data: today, visao: "dia", cliente: clientId, local: siteId, pessoa: personId });

  // Fila do dia: os mesmos chamados dos indicadores; vencidos primeiro, depois validar, destravar e triar.
  const queue = summary.attention.rows;
  const queueTotal = summary.attention.total;
  const siteById = new Map(sites.map((s) => [s.id, s]));

  return (
    <>
      <header className="mb-10 flex flex-col items-start gap-x-10 gap-y-5 lg:flex-row lg:justify-between">
        <div className="min-w-0 max-w-5xl lg:flex-1">
          <h1 className="text-[2rem] sm:text-[2.75rem]">Hoje, {longDatePt(today).replace(/ de \d{4}$/, "")}</h1>
        </div>
        <ButtonLink href="/admin/chamados/novo" className="shrink-0 lg:mt-1">
          Abrir chamado
        </ButtonLink>
      </header>

      {/* B-28: os 4 indicadores do caderno (GPT p. 5), cada um com a janela e a regra escritas. */}
      <section aria-labelledby="ind-principais" className="mb-12">
        <h2 id="ind-principais" className="sr-only">
          Indicadores principais
        </h2>
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            title="O.S. em aberto"
            value={notClosed}
            window="agora"
            rule="não encerradas no momento da consulta, inclusive pendentes e executadas sem validação."
            href={reqLink({ status: "abertos" })}
          />
          <Card
            title="Prazo vencido"
            value={overdue}
            window="agora"
            rule="prazo anterior a hoje e O.S. não encerrada. É um alerta: não muda a situação."
            href={reqLink({ atrasados: "1" })}
            alert={overdue > 0}
          />
          <Card
            title="Aguardam validação"
            value={byStatus.executada}
            window="agora"
            rule="executadas pela equipe; falta a Megagyn validar."
            href={reqLink({ status: "executada" })}
          />
          <Card
            title="Tarefas de hoje"
            value={occurrences.length}
            window={`hoje, ${formatDateBR(today)}`}
            rule="ocorrências de tarefa em cada local, pela data programada."
            href={agendaToday}
          >
            <p className="mt-1 text-[0.9375rem]">
              {occBy("prevista")} previstas, {occBy("iniciada")} iniciadas, {occBy("concluida")} finalizadas e {occBy("nao_realizada")} não realizadas
            </p>
          </Card>
        </div>
      </section>

      <form method="get" className="mb-14 flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-linha pb-6">
        <label className="w-full space-y-1 text-[0.8125rem] font-medium text-muted sm:w-48">
          Cliente
          <select name="cliente" defaultValue={clientId ?? ""} className="campo-input">
            <option value="">Todos</option>
            {(clients.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="w-full space-y-1 text-[0.8125rem] font-medium text-muted sm:w-56">
          Obra ou unidade
          <select name="local" defaultValue={siteId ?? ""} className="campo-input">
            <option value="">Todas</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.clientName} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="w-full space-y-1 text-[0.8125rem] font-medium text-muted sm:w-48">
          Profissional
          <select name="pessoa" defaultValue={personId ?? ""} className="campo-input">
            <option value="">Todos</option>
            {profiles.list
              .filter((p) => p.role !== "client" && p.is_active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
          </select>
        </label>
        <label className="w-[calc(50%-0.5rem)] space-y-1 text-[0.8125rem] font-medium text-muted sm:w-[9.5rem]">
          Período de
          <input type="date" name="de" defaultValue={from} className="campo-input" />
        </label>
        <label className="w-[calc(50%-0.5rem)] space-y-1 text-[0.8125rem] font-medium text-muted sm:w-[9.5rem]">
          até
          <input type="date" name="ate" defaultValue={to} className="campo-input" />
        </label>
        <button type="submit" className={buttonClass("dark")}>
          Aplicar
        </button>
      </form>

      <section aria-labelledby="fila" className="mb-16">
        <h2 id="fila" className="mb-4 text-[1.6875rem]">
          O que precisa de você
        </h2>
        {queue.length === 0 ? (
          <p className="border-y border-linha py-6 text-muted">Nada vencido, nada para validar, triar ou destravar com esses filtros.</p>
        ) : (
          <DataTable
            variant="ruler"
            minWidth="min-w-[60rem]"
            rows={queue.map((r) => ({
              r,
              site: siteById.get(r.site_id),
              people: r.assignee_ids.map((id) => profiles.name(id)),
              reason: r.pending_reason,
              href: `/admin/chamados/${r.id}`,
            }))}
            rowKey={(q) => q.r.id}
            columns={[
              {
                header: "O.S.",
                className: "relative",
                cell: ({ r, href }) => (
                  <>
                    {r.overdue && <AlertEdge />}
                    <Link href={href} className="tipo-condensada whitespace-nowrap text-[1.0625rem] underline-offset-4 hover:underline">
                      {r.number}
                    </Link>
                  </>
                ),
              },
              {
                header: "Serviço e local",
                cell: ({ r, site }) => (
                  <>
                    <p className="text-[1.0625rem] font-semibold leading-snug">{r.title}</p>
                    <p className="mt-0.5 text-[0.9375rem] text-muted">{site ? `${site.clientName}, ${site.name}` : "—"}</p>
                  </>
                ),
              },
              {
                header: "Responsável",
                className: ({ people }) => cn("text-[0.9375rem]", people.length === 0 && "text-muted"),
                cell: ({ people }) => (people.length ? people.join(", ") : "A definir"),
              },
              {
                header: "Prazo",
                className: "tipo-condensada whitespace-nowrap text-[0.9375rem]",
                cell: ({ r }) => (
                  <>
                    <span className={cn("block", !r.due_date && "text-muted")}>{r.due_date ? formatDateBR(r.due_date) : "Sem prazo"}</span>
                    {r.overdue && <span className="block text-erro">Prazo vencido</span>}
                  </>
                ),
              },
              {
                header: "Situação",
                className: "w-56 pt-[1.3rem]",
                cell: ({ r, reason }) => <StatusRuler status={r.status} note={reason || null} />,
              },
              {
                header: <span className="sr-only">Ação</span>,
                padY: "py-2",
                className: "text-right",
                cell: ({ r, href }) => (
                  <Link
                    href={href}
                    className="inline-flex min-h-11 items-center whitespace-nowrap px-0.5 font-semibold text-acento underline decoration-1 underline-offset-4 hover:decoration-2"
                  >
                    {QUEUE_ACTION[r.status] ?? "Abrir a ordem"}
                    <span className="sr-only"> {r.number}</span>
                  </Link>
                ),
              },
            ]}
          />
        )}
        {queueTotal > queue.length && (
          <p className="mt-4 text-[0.9375rem] text-muted">
            {plural(queueTotal - queue.length, "outra ordem também precisa", "outras ordens também precisam")} de você.{" "}
            <Link href={reqLink({ status: "abertos" })} className="font-semibold text-acento underline decoration-1 underline-offset-[3px] hover:decoration-2">
              Ver as ordens em aberto
            </Link>
          </p>
        )}
      </section>

      <section aria-labelledby="ind-chamados" className="mb-14">
        <h2 id="ind-chamados" className="mb-5 text-[1.3125rem]">
          Chamados e OS
        </h2>
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Aguardando triagem" value={byStatus.aberta} window="agora" rule="situação Aberta." href={reqLink({ status: "aberta" })} />
          <Card title="Novos hoje" value={newToday} window={`hoje, ${formatDateBR(today)}`} rule="aberto a partir de 00:00 (Brasília)." href={reqLink({ de: today, ate: today })} />
          <Card title="Por situação" value={notClosed} window="agora" rule="todos os não encerrados." href={reqLink({ status: "abertos" })}>
            <ul className="tipo-condensada mt-2 grid grid-cols-2 gap-x-4 text-[0.9375rem]">
              {REQUEST_STATUSES.map((s) => (
                <li key={s} className="flex justify-between">
                  <span className="font-medium">{STATUS_LABEL[s]}</span>
                  <span>{byStatus[s]}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Pendências por motivo" value={pendingCount} window="agora" rule="situação Pendente, pelo motivo informado." href={reqLink({ status: "pendente" })}>
            <ul className="tipo-condensada mt-2 space-y-0.5 text-[0.9375rem]">
              {byReason.map(({ label, count }) => (
                <li key={label} className="flex justify-between gap-2">
                  <span className="font-medium">{label}</span>
                  <span>{count}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Pendências por responsável" value={pendingCount} window="agora" rule="situação Pendente, por quem faz a próxima ação." href={reqLink({ status: "pendente" })}>
            <ul className="tipo-condensada mt-2 space-y-0.5 text-[0.9375rem]">
              {byOwner.map(({ label, count }) => (
                <li key={label} className="flex justify-between gap-2">
                  <span className="font-medium">{label}</span>
                  <span>{count}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      <section aria-labelledby="ind-obras" className="mb-14">
        <h2 id="ind-obras" className="mb-5 text-[1.3125rem]">
          Obras e atividades
        </h2>
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Obras e unidades ativas" value={summary.active_sites} window="agora" rule="locais com situação Ativa." href={listLink("/admin/locais", { situacao: "ativa", cliente: clientId })} />
          <Card
            title="Atividades registradas"
            value={summary.work_entries.total}
            window={periodLabel}
            rule="lançamentos pela data do serviço; cada lançamento conta uma vez."
            href={listLink("/admin/atividades", { de: from, ate: to, cliente: clientId, local: siteId, pessoa: personId })}
          >
            <ul className="mt-2 space-y-0.5 text-[0.9375rem]">
              {summary.work_entries.by_site.slice(0, 5).map(({ site_id: id, count: n }) => (
                <li key={id} className="flex justify-between gap-2">
                  <Link href={`/admin/diario?local=${id}&de=${from}&ate=${to}`} className="relative z-10 truncate text-acento underline decoration-1 underline-offset-[3px] hover:decoration-2">
                    {siteName.get(id) ?? "—"}
                  </Link>
                  <span className="tipo-condensada">{n}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      <section aria-labelledby="ind-valores">
        <h2 id="ind-valores" className="text-[1.3125rem]">
          Valores
        </h2>
        <p className="mb-5 mt-1 text-[0.9375rem] text-muted">Categorias diferentes: os valores não se somam.</p>
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            title="Despesas aprovadas (custo interno)"
            value={formatBRL(expenses.approved)}
            window={`compras de ${periodLabel}`}
            rule={siteId || clientId ? "soma das parcelas atribuídas ao filtro." : "soma do total das compras (sem duplicar rateios)."}
            href={expLink("aprovado")}
          />
          <Card
            title="Despesas em conferência (custo interno)"
            value={formatBRL(expenses.inReview)}
            window={`compras de ${periodLabel}`}
            rule="enviadas e ainda não aprovadas; separado das aprovadas."
            href={expLink("enviado_para_conferencia")}
          />
          <Card
            title="Orçamentos em aberto (valor comercial)"
            value={summary.open_quotes.count}
            window="agora"
            rule="propostas enviadas e dentro da validade; valor proposto não é receita."
            href={listLink("/admin/orcamentos", { status: "enviado", cliente: clientId })}
          >
            <p className="mt-1 text-[0.9375rem]">{formatBRL(summary.open_quotes.total_cents)} propostos</p>
          </Card>
        </div>
      </section>
    </>
  );
}
