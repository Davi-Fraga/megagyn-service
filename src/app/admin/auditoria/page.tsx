import type { Metadata } from "next";
import { addDaysIso, formatDateTimeBR, isValidIsoDate, todayIso, zonedMidnightUtc } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { loadProfiles } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { buttonClass } from "@/ui/button";
import { EmptyState, PageHeader } from "@/ui/page";

export const metadata: Metadata = { title: "Auditoria" };

const ENTITY: Record<string, string> = {
  service_requests: "Chamado",
  work_entries: "Atividade",
  expenses: "Despesa",
  expense_allocations: "Rateio",
  reimbursements: "Reembolso",
  billing_rules: "Regra de valor",
  quotes: "Orçamento",
  monthly_closings: "Fechamento",
  closing_versions: "Versão de fechamento",
  report_publications: "Entrega de relatório",
  profiles: "Usuário",
  site_memberships: "Vínculo com local",
  company_settings: "Configuração da empresa",
  clients: "Cliente",
  sites: "Local",
  client_contacts: "Contato",
  client_contact_sites: "Vínculo do responsável com local",
  site_areas: "Setor ou ambiente",
  service_categories: "Categoria de serviço",
  priority_definitions: "Prioridade",
  pending_reasons: "Motivo de pendência",
  task_kinds: "Tipo de tarefa",
  suppliers: "Fornecedor",
  expense_categories: "Categoria de despesa",
  payment_methods: "Forma de pagamento",
  quote_items: "Item de orçamento",
  attachments: "Anexo",
  attachment_links: "Vínculo de foto",
  request_assignments: "Atribuição de chamado",
  tasks: "Tarefa",
  task_assignments: "Atribuição de tarefa",
  task_occurrences: "Ocorrência de tarefa",
  time_entries: "Jornada",
};
const ACTION: Record<string, string> = {
  insert: "Criou",
  update: "Alterou",
  delete: "Removeu",
  auth_criar: "Criou o login do",
  auth_convidar: "Convidou por e-mail o",
  auth_bloquear: "Bloqueou o login do",
  auth_reativar: "Reativou o login do",
  auth_senha_provisoria: "Definiu senha provisória do",
  auth_link_senha: "Enviou link de senha ao",
};
const IGNORE = new Set(["updated_at", "version", "created_at"]);

function changedKeys(before: unknown, after: unknown): string[] {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  return [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => !IGNORE.has(k) && JSON.stringify(b[k]) !== JSON.stringify(a[k]));
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entidade?: string; pessoa?: string; de?: string; ate?: string }> }) {
  const sp = await searchParams;
  const today = todayIso();
  const from = sp.de && isValidIsoDate(sp.de) ? sp.de : addDaysIso(today, -7);
  const to = sp.ate && isValidIsoDate(sp.ate) ? sp.ate : today;
  const start = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
    return zonedMidnightUtc(y, m, d).toISOString();
  };
  const db = await createSupabaseServer();
  let q = db
    .from("audit_events")
    .select("id, actor_id, actor_role, entity_type, entity_id, action, before, after, reason, created_at")
    .gte("created_at", start(from))
    .lt("created_at", start(addDaysIso(to, 1)))
    .order("created_at", { ascending: false })
    .limit(300);
  if (sp.entidade && ENTITY[sp.entidade]) q = q.eq("entity_type", sp.entidade);
  if (sp.pessoa && UUID_RE.test(sp.pessoa)) q = q.eq("actor_id", sp.pessoa);
  const [{ data }, profiles] = await Promise.all([q, loadProfiles(db)]);

  return (
    <>
      <PageHeader title="Auditoria" description="Alterações sensíveis com autor, data e motivo. Os registros de auditoria não podem ser alterados nem apagados." />
      <form method="get" className="mb-5 grid gap-3 rounded-panel border border-linha bg-papel p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <label className="space-y-1 text-sm font-semibold">
          O quê
          <select name="entidade" defaultValue={sp.entidade ?? ""} className="campo-input">
            <option value="">Tudo</option>
            {Object.entries(ENTITY).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Quem
          <select name="pessoa" defaultValue={sp.pessoa ?? ""} className="campo-input">
            <option value="">Todos</option>
            {profiles.list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          De
          <input type="date" name="de" defaultValue={from} className="campo-input" />
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Até
          <input type="date" name="ate" defaultValue={to} className="campo-input" />
        </label>
        <button type="submit" className={buttonClass("dark")}>
          Filtrar
        </button>
      </form>
      {(data ?? []).length === 0 ? (
        <EmptyState title="Nenhum registro no período." />
      ) : (
        <ul className="divide-y divide-linha overflow-hidden rounded-panel border border-linha bg-papel">
          {(data ?? []).map((e) => {
            const keys = e.action === "update" ? changedKeys(e.before, e.after) : [];
            return (
              <li key={e.id} className="px-4 py-3">
                <p>
                  <span className="font-semibold">{ACTION[e.action] ?? e.action}</span> {ENTITY[e.entity_type] ?? e.entity_type}{" "}
                  <span className="text-sm text-muted">({e.entity_id.slice(0, 8)})</span>
                </p>
                <p className="text-sm text-muted">
                  {formatDateTimeBR(e.created_at)} — {e.actor_id ? profiles.name(e.actor_id) : "sistema"}
                  {e.reason ? ` · Motivo: ${e.reason}` : ""}
                </p>
                {keys.length > 0 && <p className="text-sm">Campos alterados: {keys.join(", ")}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
