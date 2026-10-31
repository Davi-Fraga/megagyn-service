import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { UUID_RE } from "@/domain/ids";
import { MAX_IMAGE_SIDE, requestTooLarge, validateUpload, type UploadPurpose } from "@/domain/upload";
import { imageDerivatives, storedImage } from "@/server/images";
import { errorInfo, log } from "@/server/log";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { createSupabaseServer } from "@/server/supabase/server";

export const runtime = "nodejs";

const BUCKET = { photo: "evidence", receipt: "receipts", logo: "branding", quote: "quotes" } as const;

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/**
 * Recebe UM arquivo por requisição (fila no celular), valida o conteúdo real,
 * grava no bucket privado e registra em public.attachments com a chave de serviço, só depois de
 * conferir sessão, papel e acesso ao local. Não há política de INSERT para usuários: um anexo
 * nunca existe sem o arquivo validado por esta rota.
 * Reenvio com o mesmo clientUploadId devolve o mesmo anexo (idempotente).
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sua sessão expirou. Entre novamente.", 401);
  const { data: role } = await supabase.rpc("current_app_role");
  if (!role || role === "client") return fail("Acesso não autorizado.", 403);

  const { data: settings } = await supabase.from("company_settings").select("max_image_mb, max_pdf_mb").maybeSingle();
  const limits = { maxImageMb: settings?.max_image_mb ?? 15, maxPdfMb: settings?.max_pdf_mb ?? 20 };
  if (requestTooLarge(request.headers.get("content-length"), limits)) {
    return fail(`Arquivo grande demais. Limite: ${Math.max(limits.maxImageMb, limits.maxPdfMb)} MB.`, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Envio incompleto. Tente de novo.");
  }
  const file = form.get("file");
  const purpose = String(form.get("purpose") ?? "photo") as UploadPurpose;
  const clientUploadId = String(form.get("clientUploadId") ?? "");
  const siteId = form.get("siteId") ? String(form.get("siteId")) : null;

  if (!(file instanceof File)) return fail("Nenhum arquivo recebido.");
  if (!Object.hasOwn(BUCKET, purpose)) return fail("Tipo de envio inválido.");
  if (!UUID_RE.test(clientUploadId)) return fail("Identificador de envio inválido.");
  if (siteId && !UUID_RE.test(siteId)) return fail("Local inválido.");

  const { data: existing } = await supabase
    .from("attachments")
    .select("id, mime_type, width, height")
    .eq("uploaded_by", user.id)
    .eq("client_upload_id", clientUploadId)
    .maybeSingle();
  if (existing) return NextResponse.json({ id: existing.id, mime: existing.mime_type, duplicate: true });

  const bucket = BUCKET[purpose];
  if (bucket === "evidence") {
    if (!siteId) return fail("Escolha o local antes de enviar fotos.");
    const { data: allowed } = await supabase.rpc("has_site_access", { p_site: siteId });
    if (!allowed) return fail("Você não tem acesso a este local.", 403);
  }
  if (bucket === "receipts" && role !== "admin" && role !== "foreman") return fail("Acesso não autorizado.", 403);
  if ((bucket === "branding" || bucket === "quotes") && role !== "admin") return fail("Acesso não autorizado.", 403);

  const bytes = Buffer.from(await file.arrayBuffer());
  const check = validateUpload({
    bytes: new Uint8Array(bytes.subarray(0, 64)),
    size: bytes.length,
    declaredMime: file.type,
    purpose,
    limits,
  });
  if (!check.ok) return fail(check.error, 415);

  const id = randomUUID();
  const now = new Date();
  const folder = `${bucket === "evidence" ? siteId : user.id}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const admin = createSupabaseAdmin();
  const stored: string[] = [];
  const derivatives: Record<string, string> = {};
  let width: number | null = null;
  let height: number | null = null;
  // Foto e comprovante: guarda só a versão reduzida, sem metadados, e a miniatura. O logotipo mantém o original.
  let body = bytes;
  let mime: string = check.mime;
  let extension: string = check.extension;

  try {
    if (check.mime !== "application/pdf") {
      const previews: Array<["thumb" | "medium", Buffer]> = [];
      try {
        if (purpose === "logo") {
          const d = await imageDerivatives(bytes);
          width = d.width;
          height = d.height;
          previews.push(["thumb", d.thumb], ["medium", d.medium]);
        } else {
          const s = await storedImage(bytes, MAX_IMAGE_SIDE[purpose]);
          width = s.width;
          height = s.height;
          body = s.main;
          mime = "image/jpeg";
          extension = "jpg";
          previews.push(["thumb", s.thumb]);
        }
      } catch {
        return fail("A imagem está corrompida ou incompleta. Tire a foto de novo.", 415);
      }
      for (const [variant, buffer] of previews) {
        const dkey = `${folder}/${id}_${variant}.jpg`;
        const { error } = await admin.storage.from(bucket).upload(dkey, buffer, { contentType: "image/jpeg", upsert: false });
        if (error) throw error;
        stored.push(dkey);
        derivatives[variant] = dkey;
      }
    }
    const key = `${folder}/${id}.${extension}`;
    const { error: upErr } = await admin.storage.from(bucket).upload(key, body, { contentType: mime, upsert: false });
    if (upErr) throw upErr;
    stored.push(key);

    const { error: insErr } = await admin.from("attachments").insert({
      id,
      bucket,
      storage_key: key,
      site_id: bucket === "evidence" ? siteId : null,
      original_name: file.name.slice(0, 200),
      mime_type: mime,
      size_bytes: body.length,
      width,
      height,
      content_hash: createHash("sha256").update(body).digest("hex"),
      derivatives,
      uploaded_by: user.id,
      client_upload_id: clientUploadId,
      visibility: bucket === "evidence" ? "client" : "internal",
    });
    if (insErr) {
      if (insErr.code === "23505") {
        const { data: again } = await admin
          .from("attachments")
          .select("id, mime_type")
          .eq("uploaded_by", user.id)
          .eq("client_upload_id", clientUploadId)
          .maybeSingle();
        await admin.storage.from(bucket).remove(stored);
        if (again) return NextResponse.json({ id: again.id, mime: again.mime_type, duplicate: true });
      }
      throw insErr;
    }
    log.info("upload.ok", { id, bucket, size: body.length, user: user.id });
    return NextResponse.json({ id, mime, width, height });
  } catch (error) {
    if (stored.length) await admin.storage.from(bucket).remove(stored);
    log.error("upload.fail", { bucket, user: user.id, ...errorInfo(error) });
    return fail("Não foi possível guardar o arquivo. Tente de novo.", 500);
  }
}
