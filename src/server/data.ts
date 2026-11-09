import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDateTimeBR } from "@/domain/dates";
import type { Database } from "@/server/db/database.types";
import type { GridPhoto } from "@/ui/photo-grid";
import { chunk, fetchAll } from "./paginate";
import { orThrow } from "./query";

type Tables = Database["public"]["Tables"];
/** Cliente com sessão do usuário (RLS) ou de serviço (relatórios no servidor). */
export type ServerDb = SupabaseClient<Database>;
export type RequestRow = Tables["service_requests"]["Row"];
export type EventRow = Tables["request_events"]["Row"];
export type WorkEntryRow = Tables["work_entries"]["Row"];
export type AttachmentEntity = Database["public"]["Enums"]["attachment_entity"];

/** Pessoas da equipe (lista pequena): resolve nomes sem joins ambíguos. */
export async function loadProfiles(db: ServerDb) {
  const { data } = await db
    .from("profiles")
    .select("id, full_name, role, is_active, email, phone")
    .order("full_name");
  const list = data ?? [];
  const names = new Map(list.map((p) => [p.id, p.full_name]));
  return {
    list,
    name: (id: string | null | undefined) =>
      id ? (names.get(id) ?? "—") : "—",
  };
}

export async function loadSites(
  db: ServerDb,
  options: { onlyActive?: boolean } = {},
) {
  let q = db
    .from("sites")
    .select(
      "id, name, code, status, site_type, address_text, client_id, client:clients(id, display_name)",
    )
    .order("name");
  if (options.onlyActive) q = q.eq("status", "ativa");
  const { data } = await q;
  return (data ?? []).map((s) => ({
    ...s,
    clientName: s.client?.display_name ?? "—",
  }));
}

export async function loadCatalogs(db: ServerDb) {
  const [priorities, categories, reasons, kinds] = await Promise.all([
    db
      .from("priority_definitions")
      .select("id, name, level, sla_days")
      .eq("is_active", true)
      .order("sort_order"),
    db
      .from("service_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order"),
    db
      .from("pending_reasons")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order"),
    db
      .from("task_kinds")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  return {
    priorities: priorities.data ?? [],
    categories: categories.data ?? [],
    pendingReasons: reasons.data ?? [],
    taskKinds: kinds.data ?? [],
  };
}

/** Pessoas com vínculo ativo em cada local (para atribuições). */
export async function loadMemberships(db: ServerDb) {
  const { data } = await db
    .from("site_memberships")
    .select("profile_id, site_id, active_from, active_to")
    .is("active_to", null);
  const bySite = new Map<string, string[]>();
  for (const m of data ?? []) {
    const list = bySite.get(m.site_id) ?? [];
    list.push(m.profile_id);
    bySite.set(m.site_id, list);
  }
  return bySite;
}

/** Fotos/arquivos vinculados a entidades, já filtrados pela RLS de attachments. */
export async function loadPhotos(
  db: ServerDb,
  entityType: AttachmentEntity,
  entityIds: string[],
) {
  const result = new Map<string, GridPhoto[]>();
  if (entityIds.length === 0) return result;
  type Link = {
    attachment_id: string;
    entity_id: string;
    evidence_role: string;
    sort_order: number;
  };
  const links: Link[] = [];
  for (const batch of chunk([...new Set(entityIds)], 150)) {
    links.push(
      ...(await fetchAll<Link>((from, to) =>
        db
          .from("attachment_links")
          .select("attachment_id, entity_id, evidence_role, sort_order")
          .eq("entity_type", entityType)
          .in("entity_id", batch)
          .order("sort_order")
          .order("id")
          .range(from, to),
      )),
    );
  }
  const ids = [...new Set(links.map((l) => l.attachment_id))];
  if (ids.length === 0) return result;
  type Att = {
    id: string;
    caption: string | null;
    mime_type: string;
    revoked_at: string | null;
    bucket: string;
    visibility: string;
    uploaded_by: string;
    uploaded_at: string;
  };
  const atts: Att[] = [];
  for (const batch of chunk(ids, 150)) {
    const { data } = await db
      .from("attachments")
      .select(
        "id, caption, mime_type, revoked_at, bucket, visibility, uploaded_by, uploaded_at",
      )
      .in("id", batch);
    atts.push(...((data ?? []) as Att[]));
  }
  const names = new Map<string, string>();
  for (const batch of chunk([...new Set(atts.map((a) => a.uploaded_by))], 150)) {
    const { data } = await db
      .from("profiles")
      .select("id, full_name")
      .in("id", batch);
    for (const p of data ?? []) names.set(p.id, p.full_name);
  }
  const byId = new Map(atts.map((a) => [a.id, a]));
  for (const l of links) {
    const a = byId.get(l.attachment_id);
    if (!a) continue;
    const list = result.get(l.entity_id) ?? [];
    list.push({
      id: a.id,
      caption: a.caption,
      role: l.evidence_role,
      mime: a.mime_type,
      revoked: !!a.revoked_at,
      bucket: a.bucket,
      visibility: a.visibility,
      meta: [names.get(a.uploaded_by), formatDateTimeBR(a.uploaded_at)]
        .filter(Boolean)
        .join(" · "),
    });
    result.set(l.entity_id, list);
  }
  return result;
}

export async function getRequestDetail(db: ServerDb, id: string) {
  const request = orThrow(
    await db
      .from("service_requests")
      .select(
        "*, site:sites(id, name, code, address_text, site_type, access_hours, access_instructions, responsible_profile_id), client:clients(id, display_name, legal_name), area:site_areas(id, name), category:service_categories(id, name), priority:priority_definitions(id, name, level)",
      )
      .eq("id", id)
      .maybeSingle(),
  );
  if (!request) return null;

  const [events, comments, assignments, entries] = await Promise.all([
    db
      .from("request_events")
      .select("*")
      .eq("service_request_id", id)
      .order("occurred_at")
      .order("id"),
    db
      .from("request_comments")
      .select("*")
      .eq("service_request_id", id)
      .order("created_at"),
    db
      .from("request_assignments")
      .select("profile_id, assigned_at")
      .eq("service_request_id", id)
      .is("unassigned_at", null),
    db
      .from("work_entries")
      .select("*, participants:work_entry_participants(profile_id)")
      .eq("service_request_id", id)
      .order("activity_date")
      .order("created_at"),
  ]);

  const entryIds = (entries.data ?? []).map((e) => e.id);
  const [requestPhotos, entryPhotos] = await Promise.all([
    loadPhotos(db, "service_request", [id]),
    loadPhotos(db, "work_entry", entryIds),
  ]);

  return {
    request,
    events: events.data ?? [],
    comments: comments.data ?? [],
    assigneeIds: (assignments.data ?? []).map((a) => a.profile_id),
    entries: entries.data ?? [],
    requestPhotos: requestPhotos.get(id) ?? [],
    entryPhotos,
  };
}

export type RequestDetail = NonNullable<
  Awaited<ReturnType<typeof getRequestDetail>>
>;
