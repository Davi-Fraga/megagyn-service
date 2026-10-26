import type { Metadata } from "next";
import Link from "next/link";
import { addDaysIso, formatDateBR, isValidIsoDate, todayIso, zonedMidnightUtc } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { formatBRL } from "@/domain/money";
import { REQUEST_STATUSES, STATUS_LABEL, isOverdue } from "@/domain/request-status";
import { loadDashboardRows } from "@/server/dashboard";
import { loadProfiles, loadSites } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { buttonClass } from "@/ui/button";
import { cn } from "@/ui/cn";
import { PageHeader } from "@/ui/page";

export const metadata: Metadata = { title: "Painel" };

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
    <div className={cn("relative overflow-hidden rounded-panel border border-linha bg-papel p-4", href && "hover:border-grafite-2")}>
      {alert && <span aria-hidden className="faixa-alerta absolute inset-x-0 top-0 h-1.5" />}
      <p className="font-semibold">
        {href ? (
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-3 focus-visible:after:outline-info">
            {title}
          </Link>
        ) : (
          title
        )}
      </p>
      <p className="tipo-placa mt-1 text-3xl">{value}</p>
      {children}
      <p className="mt-2 text-xs text-muted">
        <span className="font-semibold">Janela:</span> {window}. <span className="font-semibold">Regra:</span> {rule}
      </p>
    </div>
  );
}

const dayStart = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return zonedMidnightUtc(y, m, d).toISOString();
};

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

  const [rows, sites, profiles, clients] = await Promise.all([
    loadDashboardRows(db, { clientId, siteId, personId, from, to, today }),
    loadSites(db),
    loadProfiles(db),
    db.from("clients").select("id, display_name").order("display_name"),
  ]);

  let requests = rows.requests;
  if (personId) requests = requests.filter((r) => (r.assignees ?? []).some((a) => a.profile_id === personId && a.unassigned_at === null));
  const byStatus = Object.fromEntries(REQUEST_STATUSES.map((s) => [s, requests.filter((r) => r.status === s).length]));
  const newToday = requests.filter((r) => r.opened_at >= dayStart(today)).length;
  const overdue = requests.filter((r) => isOverdue(r.due_date, r.status, today)).length;
  const pending = requests.filter((r) => r.status === "pendente");
  const byReason = new Map<string, { id: string; count: number }>();
  const byOwner = new Map<string, number>();
  for (const r of pending) {
    const p = (r.current_pending ?? {}) as Record<string, string>;
    const key = p.pending_reason ?? "Sem motivo";
    byReason.set(key, { id: p.pending_reason_id ?? "", count: (byReason.get(key)?.count ?? 0) + 1 });
    const owner = p.next_action_owner_name ?? "—";
    byOwner.set(owner, (byOwner.get(owner) ?? 0) + 1);
  }

  const occurrences = rows.occurrences.filter(
    (o) => !personId || ((o.task as { assignments?: Array<{ profile_id: string }> } | null)?.assignments ?? []).some((a) => a.profile_id === personId),
  );
  const occBy = (s: string) => occurrences.filter((o) => o.status === s).length;

  const siteName = new Map(sites.map((s) => [s.id, `${s.name} (${s.clientName})`]));
  const entriesBySite = new Map<string, number>();
  for (const e of rows.workEntries) {
    if (clientId && sites.find((s) => s.id === e.site_id)?.client_id !== clientId) continue;
    entriesBySite.set(e.site_id, (entriesBySite.get(e.site_id) ?? 0) + 1);
  }
  const activeSites = sites.filter((s) => s.status === "ativa" && (!clientId || s.client_id === clientId)).length;

  // Custo interno: com filtro de obra, soma das parcelas atribuídas; sem filtro, total das compras.
  const sumExp = (status: string) =>
    siteId || clientId
      ? rows.allocations
          .filter((a) => (a.expense as { review_status: string }).review_status === status && (!clientId || sites.find((s) => s.id === a.site_id)?.client_id === clientId))
          .reduce((n, a) => n + a.amount_cents, 0)
      : rows.expenses.filter((e) => e.review_status === status).reduce((n, e) => n + e.total_cents, 0);
  const openQuotes = rows.quotes.filter((q) => !q.valid_until || q.valid_until >= today);

  const filterQs = new URLSearchParams();
  if (clientId) filterQs.set("cliente", clientId);
  if (siteId) filterQs.set("local", siteId);
  if (personId) filterQs.set("responsavel", personId);
  const reqLink = (extra: Record<string, string>) => {
    const q = new URLSearchParams(filterQs);
    Object.entries(extra).forEach(([k, v]) => q.set(k, v));
    return `/admin/chamados?${q.toString()}`;
  };
  const periodLabel = `${formatDateBR(from)} a ${formatDateBR(to)}`;

  return (
    <>
      <PageHeader title="Painel" description="Situação da operação. Cada número informa a janela de tempo e a regra de contagem e abre a lista correspondente." />

      <form method="get" className="mb-6 grid gap-3 rounded-panel border border-linha bg-papel p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <label className="space-y-1 text-sm font-semibold">
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
        <label className="space-y-1 text-sm font-semibold">
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
        <label className="space-y-1 text-sm font-semibold">
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
        <label className="space-y-1 text-sm font-semibold">
          Período de
          <input type="date" name="de" defaultValue={from} className="campo-input" />
        </label>
        <label className="space-y-1 text-sm font-semibold">
          até
          <input type="date" name="ate" defaultValue={to} className="campo-input" />
        </label>
        <button type="submit" className={buttonClass("dark")}>
          Aplicar
        </button>
      </form>

      <h2 className="mb-3 text-lg font-bold">Chamados e OS</h2>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Aguardando triagem" value={byStatus.aberta} window="agora" rule="situação Aberta." href={reqLink({ status: "aberta" })} />
        <Card title="Aguardando validação" value={byStatus.executada} window="agora" rule="situação Executada (falta a Megagyn validar)." href={reqLink({ status: "executada" })} />
        <Card title="Com prazo vencido" value={overdue} window="agora" rule="prazo anterior a hoje e não concluído nem cancelado." href={reqLink({ atrasados: "1" })} alert={overdue > 0} />
        <Card title="Novos hoje" value={newToday} window={`hoje, ${formatDateBR(today)}`} rule="aberto a partir de 00:00 (Brasília)." href={reqLink({ de: today, ate: today })} />
        <Card title="Por situação" value={requests.filter((r) => r.status !== "concluida" && r.status !== "cancelada").length} window="agora" rule="todos os não encerrados." href={reqLink({ status: "abertos" })}>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 text-sm">
            {REQUEST_STATUSES.map((s) => (
              <li key={s} className="flex justify-between">
                <span>{STATUS_LABEL[s]}</span>
                <span className="font-semibold">{byStatus[s]}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Pendências por motivo" value={pending.length} window="agora" rule="situação Pendente, pelo motivo informado." href={reqLink({ status: "pendente" })} alert={pending.length > 0}>
          <ul className="mt-2 space-y-0.5 text-sm">
            {[...byReason.entries()].map(([reason, v]) => (
              <li key={reason} className="flex justify-between gap-2">
                <span>{reason}</span>
                <span className="font-semibold">{v.count}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Pendências por responsável" value={byOwner.size} window="agora" rule="quem faz a próxima ação de cada pendência." href={reqLink({ status: "pendente" })}>
          <ul className="mt-2 space-y-0.5 text-sm">
            {[...byOwner.entries()].map(([owner, count]) => (
              <li key={owner} className="flex justify-between gap-2">
                <span>{owner}</span>
                <span className="font-semibold">{count}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Tarefas e visitas de hoje" value={occurrences.length} window={`hoje, ${formatDateBR(today)}`} rule="ocorrências de tarefa programadas para hoje." href={`/admin/agenda?data=${today}&visao=dia${siteId ? `&local=${siteId}` : ""}`}>
          <p className="mt-1 text-sm">
            {occBy("prevista")} previstas · {occBy("iniciada")} iniciadas · {occBy("concluida")} finalizadas · {occBy("nao_realizada")} não realizadas
          </p>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-bold">Obras e atividades</h2>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Obras e unidades ativas" value={activeSites} window="agora" rule="locais com situação Ativa." href="/admin/clientes" />
        <Card
          title="Atividades registradas"
          value={[...entriesBySite.values()].reduce((n, v) => n + v, 0)}
          window={periodLabel}
          rule="lançamentos pela data do serviço; cada lançamento conta uma vez."
          href={`/admin/atividades?de=${from}&ate=${to}${siteId ? `&local=${siteId}` : ""}${personId ? `&pessoa=${personId}` : ""}`}
        >
          <ul className="mt-2 space-y-0.5 text-sm">
            {[...entriesBySite.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([id, n]) => (
                <li key={id} className="flex justify-between gap-2">
                  <Link href={`/admin/diario?local=${id}&de=${from}&ate=${to}`} className="relative z-10 truncate underline">
                    {siteName.get(id) ?? "—"}
                  </Link>
                  <span className="font-semibold">{n}</span>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-bold">Valores (categorias diferentes — não se somam)</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          title="Despesas aprovadas (custo interno)"
          value={formatBRL(sumExp("aprovado"))}
          window={`compras de ${periodLabel}`}
          rule={siteId || clientId ? "soma das parcelas atribuídas ao filtro." : "soma do total das compras (sem duplicar rateios)."}
          href="/admin/despesas"
        />
        <Card
          title="Despesas em conferência (custo interno)"
          value={formatBRL(sumExp("enviado_para_conferencia"))}
          window={`compras de ${periodLabel}`}
          rule="enviadas e ainda não aprovadas; separado das aprovadas."
          href="/admin/despesas"
          alert={sumExp("enviado_para_conferencia") > 0}
        />
        <Card
          title="Orçamentos em aberto (valor comercial)"
          value={openQuotes.length}
          window="agora"
          rule="propostas enviadas e dentro da validade; valor proposto não é receita."
          href="/admin/orcamentos"
        >
          <p className="mt-1 text-sm">{formatBRL(openQuotes.reduce((n, q) => n + q.total_cents, 0))} propostos</p>
        </Card>
      </div>
    </>
  );
}
