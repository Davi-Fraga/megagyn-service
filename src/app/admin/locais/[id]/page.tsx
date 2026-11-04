import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateBR, todayIso } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { SITE_TYPE_LABEL } from "@/domain/registry";
import { ROLE_LABEL } from "@/server/auth";
import {
  addMembershipAction,
  createAreaAction,
  endMembershipAction,
  setAreaActiveAction,
  updateAreaAction,
  updateSiteAction,
} from "@/server/actions/registry";
import { loadProfiles } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { ActionForm, SelectField, TextField } from "@/ui/form";
import { DescriptionList, Notice, PageHeader, Panel } from "@/ui/page";
import { Badge } from "@/ui/status";
import { ActiveBadge, SiteFields, SiteStatusBadge } from "../../clientes/_shared/fields";
import { RowAction } from "../../clientes/_shared/row-action";
import { rowOrNotFound } from "@/server/query";

export const metadata: Metadata = { title: "Local" };

const DONE: Record<string, string> = {
  criado: "Local cadastrado. Agora inclua os setores e dê acesso à equipe que vai trabalhar aqui.",
};

export default async function SitePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feito?: string }>;
}) {
  const { id } = await params;
  const { feito } = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const db = await createSupabaseServer();
  const site = rowOrNotFound(await db.from("sites").select("*, client:clients(id, display_name, is_active)").eq("id", id).maybeSingle());

  const [areasRes, membershipsRes, profiles] = await Promise.all([
    db.from("site_areas").select("id, name, sort_order, is_active").eq("site_id", id).order("sort_order").order("name"),
    db
      .from("site_memberships")
      .select("id, profile_id, active_from, active_to, created_by")
      .eq("site_id", id)
      .order("active_from", { ascending: false }),
    loadProfiles(db),
  ]);
  const today = todayIso();
  const areas = areasRes.data ?? [];
  const memberships = membershipsRes.data ?? [];
  const current = memberships.filter((m) => !m.active_to || m.active_to >= today);
  const past = memberships.filter((m) => m.active_to && m.active_to < today);
  const openIds = new Set(memberships.filter((m) => !m.active_to).map((m) => m.profile_id));
  const byId = new Map(profiles.list.map((p) => [p.id, p]));
  const candidates = profiles.list
    .filter((p) => p.is_active && (p.role === "worker" || p.role === "foreman") && !openIds.has(p.id))
    .map((p) => ({ value: p.id, label: `${p.full_name} — ${ROLE_LABEL[p.role]}` }));

  return (
    <>
      <PageHeader
        back={{ href: `/admin/clientes/${site.client_id}`, label: site.client?.display_name ?? "Cliente" }}
        eyebrow={<span className="tipo-placa text-2xl text-grafite">{site.code}</span>}
        title={site.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <SiteStatusBadge status={site.status} />
            <span>{SITE_TYPE_LABEL[site.site_type]}</span>
          </span>
        }
      />

      {feito && DONE[feito] && (
        <div className="mb-4">
          <Notice tone="ok">{DONE[feito]}</Notice>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Panel title="Equipe com acesso">
            <div className="mb-4">
              <Notice tone="info">
                Funcionários e encarregados só veem os locais em que estão vinculados aqui (chamados, tarefas, fotos e diário). A
                administração vê todos os locais.
              </Notice>
            </div>
            {current.length === 0 ? (
              <p className="mb-4 text-muted">Ninguém da equipe de campo tem acesso a este local.</p>
            ) : (
              <ul className="mb-4 divide-y divide-linha rounded-panel border border-linha">
                {current.map((m) => {
                  const p = byId.get(m.profile_id);
                  return (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <Link href={`/admin/usuarios/${m.profile_id}`} className="font-semibold hover:underline">
                          {p?.full_name ?? "—"}
                        </Link>
                        <p className="text-sm text-muted">
                          {p ? ROLE_LABEL[p.role] : ""} · desde {formatDateBR(m.active_from)}
                          {p && !p.is_active ? " · usuário desativado" : ""}
                        </p>
                      </div>
                      {m.active_to ? (
                        <Badge tone="alerta">Acesso até {formatDateBR(m.active_to)}</Badge>
                      ) : (
                        <RowAction
                          action={endMembershipAction}
                          hidden={{ membership_id: m.id }}
                          label="Encerrar acesso"
                          confirm={{
                            intro: `${p?.full_name ?? "A pessoa"} deixa de ver este local a partir de amanhã. Chamados atribuídos a ela aqui precisam ser reprogramados. O histórico continua registrado.`,
                            label: "Confirmar encerramento",
                            variant: "dark",
                          }}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="rounded-ctl border border-linha p-3">
              <h3 className="mb-3 font-semibold">Dar acesso a uma pessoa</h3>
              {candidates.length === 0 ? (
                <p className="text-sm text-muted">
                  Todos os funcionários e encarregados ativos já têm acesso. Para incluir alguém novo, cadastre em{" "}
                  <Link href="/admin/usuarios" className="font-semibold text-info underline">
                    Usuários
                  </Link>
                  .
                </p>
              ) : (
                <ActionForm action={addMembershipAction} submitLabel="Dar acesso" resetOnSuccess>
                  <input type="hidden" name="site_id" value={site.id} />
                  <SelectField label="Pessoa" name="profile_id" required options={candidates} />
                  <TextField label="Acesso a partir de" name="active_from" type="date" required defaultValue={today} max={today} />
                </ActionForm>
              )}
            </div>

            {past.length > 0 && (
              <details className="mt-4 rounded-ctl border border-linha">
                <summary className="cursor-pointer px-3 py-2.5 font-semibold">Histórico de acessos ({past.length})</summary>
                <ul className="divide-y divide-linha border-t border-linha">
                  {past.map((m) => (
                    <li key={m.id} className="px-3 py-2 text-sm">
                      <Link href={`/admin/usuarios/${m.profile_id}`} className="font-semibold hover:underline">
                        {profiles.name(m.profile_id)}
                      </Link>{" "}
                      — {formatDateBR(m.active_from)} a {formatDateBR(m.active_to)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Panel>

          <Panel title="Setores e ambientes">
            <p className="mb-4 text-sm text-muted">Partes do local onde os serviços acontecem (ex.: Hall, Subsolo, Cobertura).</p>
            {areas.length === 0 ? (
              <p className="mb-4 text-muted">Nenhum setor cadastrado.</p>
            ) : (
              <ul className="mb-4 divide-y divide-linha rounded-panel border border-linha">
                {areas.map((a) => (
                  <li key={a.id} className="space-y-2 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">
                        {a.name} <span className="text-sm font-normal text-muted">· ordem {a.sort_order}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {!a.is_active && <ActiveBadge active={false} />}
                        <RowAction
                          action={setAreaActiveAction}
                          hidden={{ area_id: a.id, active: a.is_active ? "0" : "1" }}
                          label={a.is_active ? "Desativar" : "Reativar"}
                        />
                      </div>
                    </div>
                    <details className="rounded-ctl border border-linha">
                      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Renomear {a.name}</summary>
                      <div className="border-t border-linha p-3">
                        <ActionForm action={updateAreaAction} submitLabel="Salvar setor">
                          <input type="hidden" name="area_id" value={a.id} />
                          <TextField label="Nome do setor" name="name" required maxLength={120} defaultValue={a.name} />
                          <TextField label="Ordem na lista" name="sort_order" type="number" min={0} max={9999} defaultValue={a.sort_order} />
                        </ActionForm>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded-ctl border border-linha p-3">
              <h3 className="mb-3 font-semibold">Adicionar setor ou ambiente</h3>
              <ActionForm action={createAreaAction} submitLabel="Adicionar setor" resetOnSuccess>
                <input type="hidden" name="site_id" value={site.id} />
                <TextField label="Nome do novo setor" name="name" required maxLength={120} />
                <TextField label="Ordem na lista" name="sort_order" type="number" min={0} max={9999} hint="Em branco, vai para o fim da lista." />
              </ActionForm>
            </div>
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel title="Dados do local">
            <div className="mb-4">
              <DescriptionList
                items={[
                  { label: "Cliente", value: <Link href={`/admin/clientes/${site.client_id}`} className="text-info underline">{site.client?.display_name}</Link> },
                  { label: "Período previsto", value: `${formatDateBR(site.planned_start)} a ${formatDateBR(site.planned_end)}` },
                ]}
              />
            </div>
            <ActionForm action={updateSiteAction} submitLabel="Salvar dados do local">
              <input type="hidden" name="site_id" value={site.id} />
              <SiteFields site={site} />
            </ActionForm>
          </Panel>
        </div>
      </div>
    </>
  );
}
