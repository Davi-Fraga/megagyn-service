import type { Metadata } from "next";
import { buildBillingStatement, formatUnits } from "@/domain/billing";
import { daysOfMonth, formatDateBR, monthName, todayIso } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { formatBRL, formatCentsPlain } from "@/domain/money";
import { approveTimeEntriesAction, createBillingRuleAction, endBillingRuleAction, saveTimeEntryAction } from "@/server/actions/time";
import { loadProfiles, loadSites } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { buttonClass } from "@/ui/button";
import { ActionForm, CheckboxField, SelectField, TextField } from "@/ui/form";
import { EmptyState, Notice, PageHeader, Panel } from "@/ui/page";
import { Badge } from "@/ui/status";
import { List } from "@/ui/list";

export const metadata: Metadata = { title: "Horas e diárias" };

export default async function HoursPage({ searchParams }: { searchParams: Promise<{ local?: string; mes?: string; ano?: string }> }) {
  const sp = await searchParams;
  const [ty, tm] = todayIso().split("-").map(Number) as [number, number];
  const month = Number(sp.mes) >= 1 && Number(sp.mes) <= 12 ? Number(sp.mes) : tm;
  const year = Number(sp.ano) >= 2020 ? Number(sp.ano) : ty;
  const days = daysOfMonth(year, month);
  const db = await createSupabaseServer();
  const [sites, profiles, clients, rules] = await Promise.all([
    loadSites(db),
    loadProfiles(db),
    db.from("clients").select("id, display_name").order("display_name"),
    db.from("billing_rules").select("*, client:clients(display_name), site:sites(name)").order("valid_from", { ascending: false }),
  ]);
  const siteId = sp.local && UUID_RE.test(sp.local) ? sp.local : null;
  const site = sites.find((s) => s.id === siteId);
  const { data: entries } = siteId
    ? await db.from("time_entries").select("*").eq("site_id", siteId).gte("work_date", days[0]!).lte("work_date", days[days.length - 1]!).order("work_date")
    : { data: [] };
  const siteRules = site ? (rules.data ?? []).filter((r) => r.client_id === site.client_id && (r.site_id === null || r.site_id === site.id)) : [];
  const unitType = (siteRules.find((r) => r.site_id === siteId) ?? siteRules[0])?.unit_type as "diaria" | "hora" | undefined;
  const statement =
    site && unitType
      ? buildBillingStatement({
          entries: (entries ?? []).map((t) => ({
            workDate: t.work_date,
            siteId: t.site_id,
            hours: t.hours === null ? null : Number(t.hours),
            billable: t.billable,
            billingUnitsCenti: Math.round(Number(t.billing_units) * 100),
          })),
          rules: siteRules.map((r) => ({ id: r.id, siteId: r.site_id, unitType: r.unit_type as "diaria" | "hora", unitPriceCents: r.unit_price_cents, validFrom: r.valid_from, validTo: r.valid_to })),
          siteId: site.id,
          unitType,
        })
      : null;
  const totalHours = (entries ?? []).reduce((n, t) => n + Number(t.hours ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Horas e diárias"
        description="Jornada por pessoa e dia (horas trabalhadas) e diárias faturáveis por contrato. São coisas diferentes: horas não viram diárias automaticamente."
      />
      <form method="get" className="mb-5 grid gap-3 rounded-panel border border-linha bg-papel p-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <label className="space-y-1 text-sm font-semibold">
          Obra ou unidade
          <select name="local" defaultValue={siteId ?? ""} className="campo-input" required>
            <option value="">Selecione…</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.clientName} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Mês
          <select name="mes" defaultValue={String(month)} className="campo-input">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Ano
          <input type="number" name="ano" defaultValue={year} className="campo-input" />
        </label>
        <button type="submit" className={buttonClass("dark")}>
          Ver
        </button>
      </form>

      {site && (
        <div className="mb-8 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Panel title={`Jornadas — ${site.name}`} actions={<span className="text-sm text-muted">{String(Math.round(totalHours * 100) / 100).replace(".", ",")} h no mês</span>}>
            {(entries ?? []).length === 0 ? (
              <p className="text-muted">Nenhuma jornada no mês.</p>
            ) : (
              <ActionForm action={approveTimeEntriesAction} submitLabel="Marcar selecionadas como conferidas" submitVariant="secondary">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-left text-[0.95rem]">
                    <thead className="border-b border-linha text-sm text-muted">
                      <tr>
                        <th className="py-1" />
                        <th className="py-1">Dia</th>
                        <th className="py-1">Pessoa</th>
                        <th className="py-1 text-right">Horas</th>
                        <th className="py-1 text-right">Diárias</th>
                        <th className="py-1">Situação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-linha">
                      {(entries ?? []).map((t) => (
                        <tr key={t.id}>
                          <td className="py-1.5">
                            {!t.approved_at && <input type="checkbox" name="time_entry_ids" value={t.id} className="size-5 accent-acento" aria-label="Selecionar jornada" />}
                          </td>
                          <td className="py-1.5">{formatDateBR(t.work_date)}</td>
                          <td className="py-1.5">{profiles.name(t.profile_id)}</td>
                          <td className="py-1.5 text-right">{t.hours === null ? "—" : String(t.hours).replace(".", ",")}</td>
                          <td className="py-1.5 text-right">{t.billable ? String(t.billing_units).replace(".", ",") : "não faturável"}</td>
                          <td className="py-1.5">{t.approved_at ? <Badge tone="ok">Conferida</Badge> : <Badge>A conferir</Badge>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ActionForm>
            )}
            <details className="mt-4">
              <summary className="cursor-pointer font-semibold text-info">Lançar ou ajustar jornada de alguém</summary>
              <div className="mt-3">
                <ActionForm action={saveTimeEntryAction} submitLabel="Salvar jornada">
                  <input type="hidden" name="site_id" value={site.id} />
                  <SelectField
                    label="Pessoa"
                    name="profile_id"
                    required
                    options={profiles.list.filter((p) => p.is_active && p.role !== "client").map((p) => ({ value: p.id, label: p.full_name }))}
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <TextField label="Dia" name="work_date" type="date" required defaultValue={todayIso()} />
                    <TextField label="Horas" name="hours" inputMode="decimal" />
                    <TextField label="Diárias" name="billing_units" inputMode="decimal" defaultValue="1" hint="Ex.: 0,5" />
                  </div>
                  <CheckboxField label="Dia faturável" name="billable" defaultChecked />
                </ActionForm>
              </div>
            </details>
          </Panel>

          <Panel title="Demonstrativo do mês">
            {!statement ? (
              <Notice tone="alerta">Este cliente não tem regra de valor. Cadastre abaixo para calcular o demonstrativo.</Notice>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-sm text-muted">{statement.unitType === "diaria" ? "Diárias faturáveis" : "Horas faturáveis"}</dt>
                    <dd className="tipo-placa text-2xl">{formatUnits(statement.unitsTotalCenti)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted">Valor de serviço</dt>
                    <dd className="tipo-placa text-2xl">{formatBRL(statement.totalCents)}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-sm text-muted">Valor faturável ao cliente. Não inclui nem se soma a despesas internas.</p>
                {statement.missingRuleDates.length > 0 && (
                  <p className="mt-2 text-sm text-alerta">Dias sem regra vigente: {statement.missingRuleDates.map(formatDateBR).join(", ")}.</p>
                )}
              </>
            )}
          </Panel>
        </div>
      )}

      <h2 className="mb-2 text-lg font-bold">Regras de valor por contrato</h2>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {(rules.data ?? []).length === 0 ? (
          <EmptyState title="Nenhuma regra cadastrada." text="Contratos que não cobram por diária ou hora podem ficar sem regra." />
        ) : (
          <List variant="boxed">
            {(rules.data ?? []).map((r) => (
              <li key={r.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="block font-semibold">
                      {r.client?.display_name} — {r.site?.name ?? "todas as unidades"}
                    </span>
                    <span className="text-sm text-muted">
                      {formatBRL(r.unit_price_cents)} por {r.unit_type === "diaria" ? "diária" : "hora"} · de {formatDateBR(r.valid_from)} {r.valid_to ? `até ${formatDateBR(r.valid_to)}` : "sem data final"}
                      {r.show_in_client_report ? " · aparece no relatório" : ""}
                    </span>
                  </span>
                </div>
                {!r.valid_to && (
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold text-info">Encerrar vigência</summary>
                    <div className="mt-2 max-w-xs">
                      <ActionForm action={endBillingRuleAction} submitLabel="Encerrar" submitSize="sm">
                        <input type="hidden" name="rule_id" value={r.id} />
                        <TextField label="Último dia" name="valid_to" type="date" required defaultValue={todayIso()} />
                      </ActionForm>
                    </div>
                  </details>
                )}
              </li>
            ))}
          </List>
        )}
        <Panel title="Nova regra">
          <ActionForm action={createBillingRuleAction} submitLabel="Criar regra" resetOnSuccess>
            <SelectField label="Cliente" name="client_id" required options={(clients.data ?? []).map((c) => ({ value: c.id, label: c.display_name }))} />
            <SelectField label="Unidade (opcional)" name="site_id" options={sites.map((s) => ({ value: s.id, label: `${s.clientName} — ${s.name}` }))} placeholder="Todas as unidades do cliente" />
            <SelectField
              label="Cobrança por"
              name="unit_type"
              required
              placeholder=""
              options={[
                { value: "diaria", label: "Diária" },
                { value: "hora", label: "Hora" },
              ]}
            />
            <TextField label="Valor (R$)" name="unit_price" required inputMode="decimal" placeholder={formatCentsPlain(33300)} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Vigência a partir de" name="valid_from" type="date" required defaultValue={todayIso()} />
              <TextField label="Até" name="valid_to" type="date" />
            </div>
            <CheckboxField label="Mostrar demonstrativo no relatório do cliente" name="show_in_client_report" />
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
