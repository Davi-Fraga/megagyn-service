import type { Metadata } from "next";
import { isValidIsoDate, todayIso } from "@/domain/dates";
import { createTaskAction } from "@/server/actions/tasks";
import { loadCatalogs, loadProfiles, loadSites } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { ActionForm, CheckboxGroup, SelectField, TextAreaField, TextField } from "@/ui/form";
import { PageHeader } from "@/ui/page";

export const metadata: Metadata = { title: "Nova tarefa" };

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ data?: string; chamado?: string }> }) {
  const sp = await searchParams;
  const db = await createSupabaseServer();
  const [sites, profiles, catalogs, requests] = await Promise.all([
    loadSites(db, { onlyActive: true }),
    loadProfiles(db),
    loadCatalogs(db),
    db.from("service_requests").select("id, number, title, site:sites(name)").in("status", ["aberta", "programada", "em_execucao", "pendente"]).order("opened_at", { ascending: false }).limit(200),
  ]);
  const staff = profiles.list.filter((p) => p.is_active && p.role !== "client");
  return (
    <div className="max-w-3xl">
      <PageHeader
        back={{ href: "/admin/agenda", label: "Agenda" }}
        title="Nova tarefa"
        description="Escolha um ou mais locais: cada local vira uma ocorrência própria, ligada a esta tarefa. Os responsáveis precisam ter vínculo com os locais."
      />
      <ActionForm action={createTaskAction} submitLabel="Criar tarefa" stickySubmit>
        <TextField label="O que fazer" name="title" required maxLength={140} placeholder="Ex.: Vistoria da cobertura e compra de material" />
        <TextAreaField label="Detalhes" name="description" rows={3} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Tipo" name="kind_id" options={catalogs.taskKinds.map((k) => ({ value: k.id, label: k.name }))} />
          <SelectField label="Prioridade" name="priority_id" options={catalogs.priorities.map((p) => ({ value: p.id, label: p.name }))} />
          <TextField label="Dia" name="scheduled_date" type="date" required defaultValue={sp.data && isValidIsoDate(sp.data) ? sp.data : todayIso()} />
          <TextField label="Prazo" name="due_date" type="date" />
        </div>
        <CheckboxGroup
          label="Locais"
          name="site_ids"
          required
          options={sites.map((s) => ({ value: s.id, label: `${s.clientName} — ${s.name}` }))}
        />
        <CheckboxGroup
          label="Responsáveis"
          name="assignee_ids"
          required
          options={staff.map((p) => ({ value: p.id, label: `${p.full_name}${p.role === "foreman" ? " (encarregado)" : p.role === "admin" ? " (administração)" : ""}` }))}
        />
        <SelectField
          label="Ligada a um chamado"
          name="service_request_id"
          defaultValue={sp.chamado ?? ""}
          options={(requests.data ?? []).map((r) => ({ value: r.id, label: `${r.number} — ${r.title} (${r.site?.name ?? ""})` }))}
          hint="O registro feito na tarefa entra no chamado sem duplicar."
        />
      </ActionForm>
    </div>
  );
}
