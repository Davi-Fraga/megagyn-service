import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/database.types";

export type Db = SupabaseClient<Database>;
type Role = Database["public"]["Enums"]["user_role"];

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function serviceClient(): Db {
  return createClient<Database>(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const uid = () => randomUUID();
const tag = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export type TestUser = { id: string; email: string; password: string; name: string; role: Role; db: Db };

export async function createUser(role: Role, name = `Teste ${role}`): Promise<TestUser> {
  const svc = serviceClient();
  const email = `${role}-${tag()}@teste.local`;
  const password = `Senha-${tag()}!`;
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser");
  const { error: pErr } = await svc.from("profiles").insert({ id: data.user.id, full_name: name, email, role });
  if (pErr) throw pErr;
  const db = createClient<Database>(url(), anon(), { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: sErr } = await db.auth.signInWithPassword({ email, password });
  if (sErr) throw sErr;
  return { id: data.user.id, email, password, name, role, db };
}

export async function createClientWithSite(label = "Demo") {
  const svc = serviceClient();
  const t = tag();
  const { data: client, error } = await svc
    .from("clients")
    .insert({ legal_name: `Cliente ${label} ${t}`, display_name: `Cliente ${label} ${t}` })
    .select()
    .single();
  if (error) throw error;
  const site = await createSite(client.id, `Obra ${label} ${t}`);
  return { client, site };
}

export async function createSite(clientId: string, name: string) {
  const svc = serviceClient();
  const { data, error } = await svc
    .from("sites")
    .insert({ client_id: clientId, name, code: `T-${tag()}`, site_type: "unidade_recorrente" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addMembership(profileId: string, siteId: string) {
  const { error } = await serviceClient().from("site_memberships").insert({ profile_id: profileId, site_id: siteId });
  if (error) throw error;
}

/** Registro de anexo como o servidor de upload faria (sem bytes: o teste é de regra no banco). */
const TINY_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(64).fill(0)]);

/**
 * Anexo como a rota /api/uploads cria: arquivo real no Storage e linha gravada com a
 * chave de serviço (usuários não têm INSERT em attachments). O dono é `user`.
 */
export async function fakePhoto(user: TestUser, siteId: string | null, bucket: "evidence" | "receipts" | "quotes" = "evidence") {
  const svc = serviceClient();
  const id = randomUUID();
  const key = `${bucket === "evidence" ? siteId : user.id}/2026/10/${id}.jpg`;
  const up = await svc.storage.from(bucket).upload(key, TINY_JPEG, { contentType: "image/jpeg" });
  if (up.error) throw up.error;
  const { data, error } = await svc
    .from("attachments")
    .insert({
      id,
      bucket,
      site_id: bucket === "evidence" ? siteId : null,
      storage_key: key,
      mime_type: "image/jpeg",
      size_bytes: TINY_JPEG.length,
      uploaded_by: user.id,
      client_upload_id: randomUUID(),
      visibility: bucket === "evidence" ? "client" : "internal",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function catalogId(table: "pending_reasons" | "priority_definitions" | "service_categories", name: string) {
  const { data, error } = await serviceClient().from(table).select("id").eq("name", name).single();
  if (error) throw error;
  return data.id;
}

/** Consulta SQL direta no container local (diagnósticos de catálogo, ex.: RLS ligada). */
export function sql(query: string): string {
  return execFileSync("docker", ["exec", "supabase_db_megagyn-service", "psql", "-U", "postgres", "-At", "-c", query], {
    encoding: "utf8",
  }).trim();
}

export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
