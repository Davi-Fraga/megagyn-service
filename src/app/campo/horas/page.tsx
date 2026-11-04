import type { Metadata } from "next";
import { addDaysIso, formatDateBR, todayIso } from "@/domain/dates";
import { requireProfile } from "@/server/auth";
import { saveTimeEntryAction } from "@/server/actions/time";
import { loadFieldContext } from "@/server/field";
import { createSupabaseServer } from "@/server/supabase/server";
import { ActionForm, SelectField, TextField } from "@/ui/form";
import { EmptyState, PageHeader, Panel } from "@/ui/page";
import { Badge } from "@/ui/status";

export const metadata: Metadata = { title: "Minhas horas" };

export default async function MyHoursPage() {
  const profile = await requireProfile(["worker", "foreman", "admin"]);
  const db = await createSupabaseServer();
  const today = todayIso();
  const [ctx, { data }] = await Promise.all([
    loadFieldContext(db),
    db
      .from("time_entries")
      .select("id, work_date, hours, approved_at, site:sites(name)")
      .eq("profile_id", profile.id)
      .gte("work_date", addDaysIso(today, -14))
      .order("work_date", { ascending: false }),
  ]);
  return (
    <>
      <PageHeader back={{ href: "/campo/atividades", label: "O que eu fiz" }} title="Minhas horas" description="Informe a jornada do dia em cada local. A administração confere." />
      <Panel title="Informar jornada">
        <ActionForm action={saveTimeEntryAction} submitLabel="Salvar jornada" submitSize="lg" successMessage="Jornada salva.">
          <SelectField
            label="Local"
            name="site_id"
            required
            defaultValue={ctx.sites.length === 1 ? ctx.sites[0]!.id : ""}
            options={ctx.sites.map((s) => ({ value: s.id, label: s.label }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Dia" name="work_date" type="date" required defaultValue={today} max={today} min={addDaysIso(today, -ctx.backdateDays)} />
            <TextField label="Horas" name="hours" inputMode="decimal" required placeholder="Ex.: 9" />
          </div>
        </ActionForm>
      </Panel>
      <h2 className="mb-2 mt-6 font-bold">Últimos 14 dias</h2>
      {(data ?? []).length === 0 ? (
        <EmptyState title="Nenhuma jornada informada." />
      ) : (
        <ul className="divide-y divide-linha overflow-hidden rounded-panel border border-linha bg-papel">
          {(data ?? []).map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 px-4 py-3">
              <span>
                <span className="block font-semibold">{formatDateBR(t.work_date)}</span>
                <span className="text-sm text-muted">{t.site?.name}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="tipo-condensada text-[1.0625rem]">{t.hours === null ? "—" : `${String(t.hours).replace(".", ",")} h`}</span>
                {t.approved_at && <Badge tone="ok">Conferida</Badge>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
