import type { SupabaseClient } from "@supabase/supabase-js";
import { describeEvent, EVENT_LABEL } from "@/domain/request-events";
import type { Database } from "@/server/db/database.types";
import { getRequestDetail, loadProfiles } from "@/server/data";
import type { SafeHtml } from "@/reports/html";
import type { ReportHeader } from "@/reports/layout";
import { serviceOrderBody } from "@/reports/templates/service-order";

type Admin = SupabaseClient<Database>;
export const REPORT_KINDS = [
  "os_individual",
  "fechamento_detalhado",
  "fechamento_resumo",
  "diario",
  "atividades_pessoa",
  "despesas_internas",
  "orcamento",
] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export type BuiltReport = {
  title: string;
  footerLabel: string;
  photoIds: string[];
  /** Cabeçalho congelado (fechamentos usam o da versão emitida). */
  header?: Partial<ReportHeader>;
  body: (src: (id: string) => string | undefined) => SafeHtml;
};

export type ReportJob = {
  id: string;
  kind: string;
  source_id: string | null;
  params: unknown;
  requested_by: string | null;
  requested_at: string;
};

const ORIGIN_LABEL: Record<string, string> = {
  cliente_externo: "Pedido do cliente",
  cliente_portal: "Portal do cliente",
  interna: "Demanda interna",
  programada: "Atividade programada",
};

async function buildServiceOrder(admin: Admin, job: ReportJob): Promise<BuiltReport> {
  const detail = await getRequestDetail(admin, job.source_id!);
  if (!detail) throw new Error("Chamado não encontrado para o PDF.");
  const profiles = await loadProfiles(admin);
  const r = detail.request;
  const comments = new Map(detail.comments.filter((c) => !c.is_internal).map((c) => [c.id, c.body]));
  // Notas internas não são impressas: o PDF da OS pode ser entregue ao cliente.
  const events = detail.events
    .filter((e) => !e.is_internal)
    .map((e) => {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      return {
        at: e.occurred_at,
        label: EVENT_LABEL[e.event_type] ?? e.event_type,
        actor: profiles.name(e.actor_id),
        detail: describeEvent(e, typeof p.comment_id === "string" ? comments.get(p.comment_id) : null),
      };
    });
  const entries = detail.entries.map((e) => ({
    date: e.activity_date,
    author: profiles.name(e.author_id),
    participants: (e.participants ?? []).map((p) => profiles.name(p.profile_id)),
    description: e.description,
    solution: e.solution,
    materials: e.materials,
    hours: e.hours_worked === null ? null : Number(e.hours_worked),
    photos: (detail.entryPhotos.get(e.id) ?? []).filter((p) => !p.revoked).map((p) => ({ id: p.id, caption: p.caption ?? null, role: p.role ?? "" })),
  }));
  const initialPhotos = detail.requestPhotos.filter((p) => !p.revoked).map((p) => ({ id: p.id, caption: p.caption ?? null }));

  return {
    title: `OS ${r.number}`,
    footerLabel: `OS ${r.number}`,
    photoIds: [...initialPhotos.map((p) => p.id), ...entries.flatMap((e) => e.photos.map((p) => p.id))],
    body: (src) =>
      serviceOrderBody(
        {
          number: r.number,
          title: r.title,
          description: r.description,
          status: r.status,
          clientName: r.client?.display_name ?? "",
          siteName: r.site?.name ?? "",
          areaName: r.area?.name ?? null,
          requesterName: r.requester_name,
          originLabel: ORIGIN_LABEL[r.origin] ?? r.origin,
          openedAt: r.opened_at,
          closedAt: r.closed_at,
          scheduledDate: r.scheduled_date,
          dueDate: r.due_date,
          categoryName: r.category?.name ?? null,
          priorityName: r.priority?.name ?? null,
          assignees: detail.assigneeIds.map((id) => profiles.name(id)),
          initialPhotos,
          pending: r.status === "pendente" ? ((r.current_pending ?? null) as Record<string, string> | null) : null,
          events,
          entries,
          issuedAt: job.requested_at,
          issuedBy: profiles.name(job.requested_by),
        },
        src,
      ),
  };
}

type Builder = (admin: Admin, job: ReportJob) => Promise<BuiltReport>;
const BUILDERS: Partial<Record<ReportKind, Builder>> = {
  os_individual: buildServiceOrder,
};

export function registerBuilder(kind: ReportKind, builder: Builder) {
  BUILDERS[kind] = builder;
}

export async function buildReport(admin: Admin, job: ReportJob): Promise<BuiltReport> {
  const builder = BUILDERS[job.kind as ReportKind];
  if (!builder) throw new Error(`Relatório "${job.kind}" ainda não disponível.`);
  return builder(admin, job);
}
