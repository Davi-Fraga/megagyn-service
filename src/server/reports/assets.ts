import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/database.types";
import type { ReportHeader } from "@/reports/layout";
import { quoteBrandingIds, type QuoteBranding } from "@/domain/quote-snapshot";

type Admin = SupabaseClient<Database>;

/** Baixa a versão "medium" (sem metadados) de cada foto para o diretório temporário do PDF. */
export async function loadImageAssets(admin: Admin, ids: string[]) {
  const unique = [...new Set(ids)];
  const assets = new Map<string, Buffer>();
  const src = new Map<string, string>();
  if (unique.length === 0) return { assets, src: (id: string) => src.get(id) };

  const { data } = await admin.from("attachments").select("id, bucket, storage_key, derivatives, mime_type").in("id", unique);
  const rows = (data ?? []).filter((a) => a.mime_type.startsWith("image/"));
  const queue = [...rows];
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const a = queue.shift()!;
      const key = ((a.derivatives ?? {}) as Record<string, string>).medium ?? a.storage_key;
      const { data: blob } = await admin.storage.from(a.bucket).download(key);
      if (!blob) continue;
      const name = `${a.id}.jpg`;
      assets.set(name, Buffer.from(await blob.arrayBuffer()));
      src.set(a.id, name);
    }
  });
  await Promise.all(workers);
  return { assets, src: (id: string) => src.get(id) };
}

export async function attachmentDataUri(admin: Admin, attachmentId: string | null): Promise<string | null> {
  if (!attachmentId) return null;
  const { data: a } = await admin.from("attachments").select("bucket, storage_key, derivatives").eq("id", attachmentId).maybeSingle();
  if (!a) return null;
  const key = ((a.derivatives ?? {}) as Record<string, string>).medium ?? a.storage_key;
  const { data: blob } = await admin.storage.from(a.bucket).download(key);
  if (!blob) return null;
  return `data:image/jpeg;base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`;
}

/** Cabeçalho dos relatórios. Com `branding` (versão de orçamento), logo e assinatura vêm dela. */
export async function loadReportHeader(admin: Admin, branding?: QuoteBranding): Promise<ReportHeader> {
  const { data: s } = await admin.from("company_settings").select("*").eq("id", 1).single();
  const ids = quoteBrandingIds({ branding }, s ?? null);
  return {
    tradeName: s?.trade_name || "Megagyn",
    legalName: s?.legal_name ?? "",
    cnpj: s?.cnpj ?? null,
    addressText: s?.address_text ?? null,
    phone: s?.phone ?? null,
    email: s?.email ?? null,
    website: s?.website ?? null,
    technicalManagerName: s?.technical_manager_name ?? null,
    technicalManagerTitle: s?.technical_manager_title ?? null,
    crea: s?.crea ?? null,
    footerText: s?.report_footer_text ?? null,
    city: s?.report_city ?? null,
    logoDataUri: await attachmentDataUri(admin, ids.logo_attachment_id),
    signatureDataUri: await attachmentDataUri(admin, ids.signature_attachment_id),
  };
}
