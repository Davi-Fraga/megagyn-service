/**
 * Dados de DEMONSTRAÇÃO fictícios (nada dos documentos reais). Uso: npm run seed
 * Idempotente o bastante para rodar de novo: reaproveita usuários, clientes e locais pelo e-mail/código.
 * Só para ambiente local/homologação — recusa rodar se APP_URL parecer produção.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { Database, Json } from "../src/server/db/database.types";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!;
  }
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
if (!URL_ || !SERVICE) throw new Error("Configure .env.local (npm run env:local).");
if (!/127\.0\.0\.1|localhost/.test(URL_) && process.env.SEED_ALLOW_REMOTE !== "1") {
  throw new Error("Seed de demonstração só roda contra Supabase local (defina SEED_ALLOW_REMOTE=1 para homologação).");
}

type Db = SupabaseClient<Database>;
const svc: Db = createClient<Database>(URL_, SERVICE, { auth: { persistSession: false } });
export const DEMO_PASSWORD = "Demo@Megagyn2026";

const must = <R extends { data: unknown; error: unknown }>(r: R, label: string): NonNullable<R["data"]> => {
  if (r.error || r.data === null || r.data === undefined) throw new Error(`${label}: ${JSON.stringify(r.error)}`);
  return r.data as NonNullable<R["data"]>;
};

async function ensureUser(email: string, fullName: string, role: Database["public"]["Enums"]["user_role"]) {
  const list = await svc.auth.admin.listUsers({ perPage: 1000 });
  let user = list.data.users.find((u) => u.email === email);
  if (!user) {
    const created = await svc.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(`usuário ${email}: ${created.error?.message}`);
    user = created.data.user;
  }
  await svc.from("profiles").upsert({ id: user.id, email, full_name: fullName, role, is_active: true });
  return user.id;
}

async function signedClient(email: string): Promise<Db> {
  const c = createClient<Database>(URL_, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw error;
  return c;
}

async function ensureClient(display: string, legal: string) {
  const found = await svc.from("clients").select("id").eq("display_name", display).maybeSingle();
  if (found.data) return found.data.id;
  return must(await svc.from("clients").insert({ display_name: display, legal_name: legal, kind: "pj" }).select("id").single(), display).id;
}

async function ensureSite(clientId: string, code: string, name: string, type: "obra_temporaria" | "unidade_recorrente", areas: string[]) {
  let id = (await svc.from("sites").select("id").eq("code", code).maybeSingle()).data?.id;
  if (!id) {
    id = must(
      await svc.from("sites").insert({ client_id: clientId, code, name, site_type: type, address_text: "Endereço fictício para demonstração" }).select("id").single(),
      code,
    ).id;
  }
  for (const [i, a] of areas.entries()) await svc.from("site_areas").upsert({ site_id: id, name: a, sort_order: i }, { onConflict: "site_id,name" });
  return id;
}

async function ensureMembership(profileId: string, siteId: string) {
  const found = await svc.from("site_memberships").select("id").eq("profile_id", profileId).eq("site_id", siteId).is("active_to", null).maybeSingle();
  if (!found.data) await svc.from("site_memberships").insert({ profile_id: profileId, site_id: siteId, active_from: "2026-01-01" });
}

const COLORS = ["#8a6f4d", "#5b7083", "#7d8b6a", "#9a6b5b", "#6d6a86", "#7b7f84"];
async function demoPhoto(siteId: string, uploader: string, label: string, n: number) {
  const id = randomUUID();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
    <rect width="1200" height="900" fill="${COLORS[n % COLORS.length]}"/>
    <rect x="40" y="40" width="1120" height="820" fill="none" stroke="#ffffff" stroke-width="6" stroke-dasharray="24 16"/>
    <text x="600" y="420" font-family="Arial" font-size="64" font-weight="bold" fill="#ffffff" text-anchor="middle">FOTO DEMONSTRATIVA</text>
    <text x="600" y="510" font-family="Arial" font-size="44" fill="#ffffff" text-anchor="middle">${label.replace(/[<&>]/g, "")}</text>
  </svg>`;
  const original = await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
  const thumb = await sharp(original).resize(480).jpeg({ quality: 76 }).toBuffer();
  // Mesmo formato das chaves da rota de upload (conferido por constraint no banco).
  const folder = `${siteId}/2026/09`;
  await svc.storage.from("evidence").upload(`${folder}/${id}.jpg`, original, { contentType: "image/jpeg", upsert: true });
  await svc.storage.from("evidence").upload(`${folder}/${id}_thumb.jpg`, thumb, { contentType: "image/jpeg", upsert: true });
  await svc.storage.from("evidence").upload(`${folder}/${id}_medium.jpg`, original, { contentType: "image/jpeg", upsert: true });
  must(
    await svc
      .from("attachments")
      .insert({
        id,
        bucket: "evidence",
        storage_key: `${folder}/${id}.jpg`,
        site_id: siteId,
        original_name: `demo-${n}.jpg`,
        mime_type: "image/jpeg",
        size_bytes: original.length,
        width: 1200,
        height: 900,
        caption: label,
        derivatives: { thumb: `${folder}/${id}_thumb.jpg`, medium: `${folder}/${id}_medium.jpg` },
        uploaded_by: uploader,
        client_upload_id: randomUUID(),
      })
      .select("id")
      .single(),
    "foto",
  );
  return id;
}

/** Instante em São Paulo (-03:00). */
const sp = (s: string) => new Date(`${s}-03:00`).toISOString();

async function historicalRequest(opts: {
  number: string;
  clientId: string;
  siteId: string;
  title: string;
  description: string;
  admin: string;
  worker: string;
  events: Array<{ type: Database["public"]["Enums"]["request_event_type"]; to?: Database["public"]["Enums"]["request_status"]; at: string; reason?: string; payload?: Record<string, unknown> }>;
}) {
  const exists = await svc.from("service_requests").select("id").eq("number", opts.number).maybeSingle();
  if (exists.data) return exists.data.id;
  const last = [...opts.events].reverse().find((e) => e.to)!;
  const req = must(
    await svc
      .from("service_requests")
      .insert({
        number: opts.number,
        client_id: opts.clientId,
        site_id: opts.siteId,
        origin: "cliente_externo",
        channel: "whatsapp",
        requester_name: "Síndica Demo (fictícia)",
        title: opts.title,
        description: opts.description,
        status: last.to!,
        opened_at: opts.events[0]!.at,
        closed_at: last.to === "concluida" ? last.at : null,
        scheduled_date: opts.events.find((e) => e.payload?.scheduled_date)?.payload?.scheduled_date as string | undefined,
        current_pending: last.to === "pendente" ? ((last.payload ?? null) as Json) : null,
        client_request_id: randomUUID(),
        created_by: opts.admin,
      })
      .select("id")
      .single(),
    opts.number,
  );
  await svc.from("request_assignments").insert({ service_request_id: req.id, profile_id: opts.worker, assigned_by: opts.admin });
  let prev: Database["public"]["Enums"]["request_status"] | null = null;
  for (const e of opts.events) {
    await svc.from("request_events").insert({
      service_request_id: req.id,
      event_type: e.type,
      from_status: e.to ? prev : null,
      to_status: e.to ?? null,
      actor_id: e.type === "validacao" || e.type === "abertura" || e.type === "classificacao" ? opts.admin : opts.worker,
      occurred_at: e.at,
      reason: e.reason ?? null,
      payload: (e.payload ?? {}) as { [key: string]: Json },
    });
    if (e.to) prev = e.to;
  }
  return req.id;
}

/** Logotipo oficial (src/assets/brand/logo.png) no bucket de marca, como a tela Configurações faria. */
async function ensureLogo(adminId: string) {
  const { data: settings } = await svc.from("company_settings").select("logo_attachment_id").eq("id", 1).single();
  if (settings?.logo_attachment_id) return;
  const original = readFileSync("src/assets/brand/logo.png");
  const meta = await sharp(original).metadata();
  const medium = await sharp(original).resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
  const thumb = await sharp(original).resize({ width: 480, height: 480, fit: "inside" }).jpeg({ quality: 76 }).toBuffer();
  const id = randomUUID();
  const folder = `${adminId}/2026/09`;
  const keys = { original: `${folder}/${id}.png`, medium: `${folder}/${id}_medium.jpg`, thumb: `${folder}/${id}_thumb.jpg` };
  for (const [key, bytes, contentType] of [
    [keys.original, original, "image/png"],
    [keys.medium, medium, "image/jpeg"],
    [keys.thumb, thumb, "image/jpeg"],
  ] as const) {
    const up = await svc.storage.from("branding").upload(key, bytes, { contentType, upsert: true });
    if (up.error) throw up.error;
  }
  must(
    await svc
      .from("attachments")
      .insert({
        id,
        bucket: "branding",
        storage_key: keys.original,
        site_id: null,
        original_name: "logo-megagyn-service.png",
        mime_type: "image/png",
        size_bytes: original.length,
        width: meta.width ?? null,
        height: meta.height ?? null,
        derivatives: { thumb: keys.thumb, medium: keys.medium },
        uploaded_by: adminId,
        client_upload_id: randomUUID(),
        visibility: "internal",
      })
      .select("id")
      .single(),
    "logotipo",
  );
  await svc.from("company_settings").update({ logo_attachment_id: id }).eq("id", 1);
  console.log("Logotipo oficial carregado em Configurações.");
}

async function main() {
  console.log("Criando dados de demonstração fictícios…");
  await svc
    .from("company_settings")
    .update({
      trade_name: "Megagyn (DEMO)",
      legal_name: "Razão social a confirmar (DEMO)",
      cnpj: "00.000.000/0000-00",
      address_text: "Endereço a confirmar — Goiânia, GO",
      phone: "(00) 00000-0000",
      website: "site-a-confirmar.example",
      technical_manager_name: "Responsável técnico a confirmar",
      technical_manager_title: "Eng.",
      crea: "A CONFIRMAR",
      report_footer_text: "Dados de demonstração",
      report_city: "Goiânia",
      quote_declaration_text:
        "Declaramos que nos preços estão incluídos os custos diretos e indiretos para a execução dos serviços, conforme especificado. (Texto de demonstração — edite em Configurações.)",
    })
    .eq("id", 1);

  const admin = await ensureUser("admin@demo.megagyn.local", "Ana Administração (demo)", "admin");
  await ensureLogo(admin);
  const foreman = await ensureUser("encarregado@demo.megagyn.local", "Carlos Encarregado (demo)", "foreman");
  const worker1 = await ensureUser("joao@demo.megagyn.local", "João Funcionário (demo)", "worker");
  const worker2 = await ensureUser("pedro@demo.megagyn.local", "Pedro Funcionário (demo)", "worker");

  const condo = await ensureClient("Condomínio Jardim Exemplo", "Condomínio Residencial Jardim Exemplo (DEMO)");
  const factory = await ensureClient("Indústria Modelo", "Indústria Modelo de Equipamentos Ltda (DEMO)");
  const torreA = await ensureSite(condo, "JEX-TA", "Torre A", "unidade_recorrente", ["Salão de festas", "Escritório", "Subsolo", "Piscina", "Elevadores"]);
  const torreB = await ensureSite(condo, "JEX-TB", "Torre B", "unidade_recorrente", ["Hall", "Garagem"]);
  const galpao = await ensureSite(factory, "IMO-GAL", "Galpão de montagem", "obra_temporaria", ["Cobertura", "Pátio"]);

  const contact = await svc.from("client_contacts").select("id").eq("client_id", condo).eq("name", "Síndica Demo (fictícia)").maybeSingle();
  if (!contact.data) await svc.from("client_contacts").insert({ client_id: condo, name: "Síndica Demo (fictícia)", role_title: "Síndica", phone: "(00) 90000-0000" });

  await ensureMembership(worker1, torreA);
  await ensureMembership(worker2, torreB);
  for (const s of [torreA, torreB, galpao]) await ensureMembership(foreman, s);

  const rule = await svc.from("billing_rules").select("id").eq("client_id", condo).maybeSingle();
  if (!rule.data) {
    await svc.from("billing_rules").insert({
      client_id: condo,
      site_id: torreA,
      unit_type: "diaria",
      unit_price_cents: 30000,
      valid_from: "2026-01-01",
      show_in_client_report: true,
      notes: "Valor fictício de demonstração",
    });
  }

  // Histórico atravessando setembro e outubro (para o fechamento mensal com snapshot).
  const existing = await svc.from("service_requests").select("id").eq("number", "2026-900001").maybeSingle();
  if (!existing.data) {
    const reasonId = (await svc.from("pending_reasons").select("id").eq("name", "Falta de material").single()).data!.id;
    await historicalRequest({
      number: "2026-900001",
      clientId: condo,
      siteId: torreA,
      admin,
      worker: worker1,
      title: "Vazamento no cano do subsolo",
      description: "Cano de água potável pingando próximo ao hidrômetro.",
      events: [
        { type: "abertura", to: "aberta", at: sp("2026-09-08T09:10:00") },
        { type: "classificacao", to: "programada", at: sp("2026-09-08T10:00:00"), payload: { scheduled_date: "2026-09-09", assignee_names: ["João Funcionário (demo)"] } },
        { type: "inicio", to: "em_execucao", at: sp("2026-09-09T08:00:00") },
        {
          type: "pendencia",
          to: "pendente",
          at: sp("2026-09-20T16:00:00"),
          reason: "Faltou luva de 50 mm",
          payload: {
            pending_reason_id: reasonId,
            pending_reason: "Falta de material",
            explanation: "Faltou luva de 50 mm para concluir o reparo.",
            next_action: "Comprar 2 luvas de 50 mm",
            next_action_owner_name: "Carlos Encarregado (demo)",
            expected_return_date: "2026-10-02",
          },
        },
        { type: "retomada", to: "em_execucao", at: sp("2026-10-02T08:00:00") },
        { type: "execucao_informada", to: "executada", at: sp("2026-10-03T11:00:00"), payload: { solution: "Luvas substituídas e vedação refeita." } },
        { type: "validacao", to: "concluida", at: sp("2026-10-05T09:00:00") },
      ],
    });
    await historicalRequest({
      number: "2026-900002",
      clientId: condo,
      siteId: torreA,
      admin,
      worker: worker1,
      title: "Troca de luminárias dos elevadores",
      description: "Duas luminárias queimadas no elevador social.",
      events: [
        { type: "abertura", to: "aberta", at: sp("2026-07-14T09:00:00") },
        { type: "classificacao", to: "programada", at: sp("2026-07-15T09:00:00"), payload: { scheduled_date: "2026-09-19", assignee_names: ["João Funcionário (demo)"] } },
        { type: "execucao_informada", to: "executada", at: sp("2026-09-19T15:00:00"), payload: { solution: "Luminárias substituídas." } },
        { type: "validacao", to: "concluida", at: sp("2026-09-21T10:00:00") },
      ],
    });
    await historicalRequest({
      number: "2026-900003",
      clientId: condo,
      siteId: torreA,
      admin,
      worker: worker1,
      title: "Pintura da parede da sala dos hidrômetros",
      description: "Pichação na parede da sala dos hidrômetros, 6º andar.",
      events: [
        { type: "abertura", to: "aberta", at: sp("2026-09-25T09:00:00") },
        { type: "classificacao", to: "programada", at: sp("2026-09-25T11:00:00"), payload: { scheduled_date: "2026-10-06", assignee_names: ["João Funcionário (demo)"] } },
      ],
    });

    // Diário de setembro na Torre A: lançamentos com fotos (fonte única do diário).
    const days = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-19", "2026-09-29", "2026-09-30"];
    const texts = [
      ["Continuidade nos acabamentos do salão de festas"],
      ["Continuidade nos acabamentos do salão de festas"],
      ["Remoção do entulho do salão de festas", "Limpeza do salão de festas", "Desentupimento do cano de água potável no subsolo"],
      ["Identificado vazamento no cano de água potável no subsolo"],
      ["Descarte de entulho na caçamba", "Desobstrução dos ralos do estacionamento"],
      ["Reparo do vazamento na cozinha do salão de festas"],
      ["Substituição de luminárias nos elevadores"],
      ["Massa corrida nas paredes do salão de festas"],
      ["Lixamento e massa corrida nas paredes do salão de festas"],
    ];
    let n = 0;
    for (const [i, day] of days.entries()) {
      for (const text of texts[i]!) {
        const photos = [await demoPhoto(torreA, worker1, `${text} — antes`, n++), await demoPhoto(torreA, worker1, `${text} — depois`, n++)];
        const entry = must(
          await svc
            .from("work_entries")
            .insert({
              site_id: torreA,
              activity_date: day,
              author_id: worker1,
              description: text,
              outcome: "executado",
              submitted_payload: { seed: true },
              client_request_id: randomUUID(),
              created_at: sp(`${day}T17:00:00`),
            })
            .select("id")
            .single(),
          "lançamento",
        );
        await svc.from("work_entry_participants").insert({ work_entry_id: entry.id, profile_id: worker1 });
        for (const [k, p] of photos.entries()) {
          await svc.from("attachment_links").insert({ attachment_id: p, entity_type: "work_entry", entity_id: entry.id, evidence_role: k === 0 ? "intermediaria" : "resultado", sort_order: k });
        }
      }
      await svc.from("time_entries").upsert(
        { profile_id: worker1, site_id: torreA, work_date: day, hours: 9, billable: true, billing_units: 1, source: "admin" },
        { onConflict: "profile_id,site_id,work_date" },
      );
    }
  }

  // Um chamado atual aberto pelo fluxo normal (RPC), aguardando triagem.
  const adminDb = await signedClient("admin@demo.megagyn.local");
  const already = await svc.from("service_requests").select("id").eq("title", "Infiltração no teto do hall (demo)").maybeSingle();
  if (!already.data) {
    const photo = await demoPhoto(torreB, admin, "Mancha de infiltração no teto", 99);
    await adminDb.rpc("request_open", {
      p_client_request_id: randomUUID(),
      p_site_id: torreB,
      p_title: "Infiltração no teto do hall (demo)",
      p_description: "Mancha de umidade crescendo no teto do hall de entrada.",
      p_requester_name: "Síndica Demo (fictícia)",
      p_channel: "telefone",
      p_photo_ids: [photo],
    });
  }

  console.log("\nPronto. Acessos de demonstração (senha para todos):", DEMO_PASSWORD);
  console.log("  Administração: admin@demo.megagyn.local");
  console.log("  Encarregado:   encarregado@demo.megagyn.local");
  console.log("  Funcionários:  joao@demo.megagyn.local, pedro@demo.megagyn.local");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
