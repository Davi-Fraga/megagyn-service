import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateBR, formatDateTimeBR } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { adjustWorkEntryAction } from "@/server/actions/activities";
import { loadPhotos, loadProfiles } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { ActionForm, CheckboxField, TextAreaField, TextField } from "@/ui/form";
import { DescriptionList, PageHeader, Panel } from "@/ui/page";
import { PhotoGrid } from "@/ui/photo-grid";
import { rowOrNotFound } from "@/server/query";

export const metadata: Metadata = { title: "Atividade" };

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const db = await createSupabaseServer();
  const e = rowOrNotFound(await db
    .from("work_entries")
    .select("*, site:sites(name), area:site_areas(name), request:service_requests(id, number, title), participants:work_entry_participants(profile_id)")
    .eq("id", id)
    .maybeSingle());
  const [profiles, photos, { data: history }] = await Promise.all([
    loadProfiles(db),
    loadPhotos(db, "work_entry", [id]),
    db.from("audit_events").select("actor_id, created_at, reason, before, after").eq("entity_type", "work_entries").eq("entity_id", id).order("created_at"),
  ]);
  const original = (e.submitted_payload ?? {}) as Record<string, unknown>;

  return (
    <div className="max-w-5xl">
      <PageHeader back={{ href: "/admin/atividades", label: "Atividades" }} title={e.description} description={`${e.site?.name ?? ""} · ${formatDateBR(e.activity_date)}`} />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Panel title="Registro">
            <DescriptionList
              items={[
                { label: "Data do serviço", value: formatDateBR(e.activity_date) },
                { label: "Enviado em", value: formatDateTimeBR(e.created_at) },
                { label: "Quem registrou", value: profiles.name(e.author_id) },
                { label: "Participantes", value: (e.participants ?? []).map((p) => profiles.name(p.profile_id)).join(", ") },
                { label: "Ambiente", value: e.area?.name ?? "—" },
                { label: "Horas", value: e.hours_worked === null ? "—" : String(e.hours_worked).replace(".", ",") },
                {
                  label: "Chamado",
                  value: e.request ? (
                    <Link href={`/admin/chamados/${e.request.id}`} className="text-info underline">
                      {e.request.number} — {e.request.title}
                    </Link>
                  ) : (
                    "Atividade avulsa"
                  ),
                },
                { label: "Visível ao cliente", value: e.client_visible ? "Sim" : "Não (interno)" },
              ]}
            />
            <div className="mt-4">
              <PhotoGrid photos={photos.get(id) ?? []} emptyText="Sem fotos." />
            </div>
          </Panel>
          <Panel title="Como o trabalhador enviou">
            <p className="whitespace-pre-line">{String(original.description ?? "—")}</p>
            {typeof original.solution === "string" && original.solution && <p className="mt-2">Solução: {original.solution}</p>}
            {typeof original.materials === "string" && original.materials && <p>Materiais: {original.materials}</p>}
          </Panel>
          {(history ?? []).length > 0 && (
            <Panel title="Ajustes registrados">
              <ul className="space-y-2 text-sm">
                {(history ?? []).map((h, i) => (
                  <li key={i}>
                    {formatDateTimeBR(h.created_at)} — {profiles.name(h.actor_id)}
                    {h.reason ? `: ${h.reason}` : ""}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
        <Panel title="Ajustar">
          <ActionForm action={adjustWorkEntryAction} submitLabel="Salvar ajuste">
            <input type="hidden" name="work_entry_id" value={e.id} />
            <TextAreaField label="O que foi feito" name="description" required defaultValue={e.description} rows={4} />
            <TextAreaField label="Solução" name="solution" defaultValue={e.solution ?? ""} rows={2} />
            <TextField label="Materiais" name="materials" defaultValue={e.materials ?? ""} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Data do serviço" name="activity_date" type="date" required defaultValue={e.activity_date} />
              <TextField label="Horas" name="hours_worked" inputMode="decimal" defaultValue={e.hours_worked === null ? "" : String(e.hours_worked).replace(".", ",")} />
            </div>
            <CheckboxField label="Visível ao cliente (diário e fechamento)" name="client_visible" defaultChecked={e.client_visible} />
            <TextAreaField label="Motivo do ajuste" name="reason" required rows={2} />
          </ActionForm>
        </Panel>
      </div>
    </div>
  );
}
