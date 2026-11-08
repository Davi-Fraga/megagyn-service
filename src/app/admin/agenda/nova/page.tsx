import type { Metadata } from "next";
import { isValidIsoDate, todayIso } from "@/domain/dates";
import { createTaskAction } from "@/server/actions/tasks";
import { loadCatalogs, loadProfiles, loadSites } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { ActionForm, CheckboxGroup, SelectField, TextAreaField, TextField } from "@/ui/form";
import { PageHeader } from "@/ui/page";
import { TaskSitePicker } from "./site-picker";

export const metadata: Metadata = { title: "Nova tarefa" };

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ data?: string; chamado?: string }> }) {
  const sp = await searchParams;
  const db = await createSupabaseServer();
  const [sites, profiles, catalogs, requests, areas] = await Promise.all([
    loadSites(db, { onlyActive: true }),
    loadProfiles(db),
    loadCatalogs(db),
    db.from("service_requests").select("id, number, title, site:sites(name)").in("status", ["aberta", "programada", "em_execucao", "pendente"]).order("opened_at", { ascending: false }).limit(200),
    db.from("site_areas").select("id, name, site_id").eq("is_active", true).order("sort_order").order("name"),
  ]);
  const siteNames = new Map(sites.map((s) => [s.id, s.name]));
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
        <TaskSitePicker sites={sites.map((s) => ({ id: s.id, name: s.name, clientId: s.client_id, clientName: s.clientName }))} />
        <SelectField
          label="Setor"
          name="site_area"
          options={(areas.data ?? [])
            .filter((a) => siteNames.has(a.site_id))
            .map((a) => ({ value: `${a.site_id}:${a.id}`, label: `${siteNames.get(a.site_id)} — ${a.name}` }))}
          hint="Vale só para o local do setor, se a tarefa tiver vários locais."
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
