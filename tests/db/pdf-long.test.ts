import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reportFileName } from "@/server/reports/file-names";
import { processReport } from "@/server/reports/jobs";
import { closeRenderer } from "@/server/reports/render";
import { createClientWithSite, createUser, serviceClient, uid, type TestUser } from "./helpers";

/**
 * E-pdf-long (F5.3 / T-A11): mês cheio de registros com várias fotos por dia gera um
 * fechamento A4 longo, pelo mesmo caminho da tela (fila report_artifacts → processReport).
 * O relatório real de referência tem 35 páginas e ~100 fotos.
 */

const YEAR = 2026;
const MONTH = 8;
const PHOTOS_PER_DAY = 6;
const COLORS = ["#c2410c", "#1e2326", "#475569", "#0f766e"];

let admin: TestUser;
let clientId: string;
let siteId: string;

async function storedPhoto(image: Buffer, medium: Buffer, thumb: Buffer): Promise<string> {
  const svc = serviceClient();
  const id = randomUUID();
  const folder = `${siteId}/${YEAR}/${String(MONTH).padStart(2, "0")}`;
  const keys = { original: `${folder}/${id}.jpg`, medium: `${folder}/${id}_medium.jpg`, thumb: `${folder}/${id}_thumb.jpg` };
  for (const [key, bytes] of [
    [keys.original, image],
    [keys.medium, medium],
    [keys.thumb, thumb],
  ] as const) {
    const up = await svc.storage.from("evidence").upload(key, bytes, { contentType: "image/jpeg" });
    if (up.error) throw up.error;
  }
  const { error } = await svc.from("attachments").insert({
    id,
    bucket: "evidence",
    site_id: siteId,
    storage_key: keys.original,
    mime_type: "image/jpeg",
    size_bytes: image.length,
    width: 1600,
    height: 1200,
    derivatives: { thumb: keys.thumb, medium: keys.medium },
    uploaded_by: admin.id,
    client_upload_id: randomUUID(),
    visibility: "client",
  });
  if (error) throw error;
  return id;
}

beforeAll(async () => {
  admin = await createUser("admin", "Admin PDF Longo");
  const created = await createClientWithSite("PdfLongo");
  clientId = created.client.id;
  siteId = created.site.id;

  const images = await Promise.all(
    COLORS.map(async (background) => {
      const image = await sharp({ create: { width: 1600, height: 1200, channels: 3, background } }).jpeg({ quality: 80 }).toBuffer();
      return { image, medium: image, thumb: await sharp(image).resize(480).jpeg().toBuffer() };
    }),
  );

  // Dias úteis de agosto/2026 (segunda a sábado), cada um com um registro e 6 fotos.
  const days: string[] = [];
  for (let d = 1; d <= 31; d++) {
    if (new Date(Date.UTC(YEAR, MONTH - 1, d)).getUTCDay() !== 0) days.push(`${YEAR}-08-${String(d).padStart(2, "0")}`);
  }
  for (const [i, day] of days.entries()) {
    const photoIds: string[] = [];
    for (let p = 0; p < PHOTOS_PER_DAY; p++) {
      const img = images[(i + p) % images.length]!;
      photoIds.push(await storedPhoto(img.image, img.medium, img.thumb));
    }
    const { error } = await admin.db.rpc("work_entry_create", {
      p_client_request_id: uid(),
      p_site_id: siteId,
      p_activity_date: day,
      p_description: `Manutenção preventiva do dia ${day}: inspeção de cobertura, limpeza de calhas e registro fotográfico.`,
      p_hours_worked: 8,
      p_photo_ids: photoIds,
    });
    if (error) throw error;
  }
}, 300_000);

afterAll(async () => {
  await closeRenderer();
});

describe("PDF longo do fechamento mensal", () => {
  it("mês com ~150 fotos gera 30+ páginas A4 com mês e ano no nome do arquivo", async () => {
    const svc = serviceClient();
    const params = { clientId, siteId: null, year: YEAR, month: MONTH, includeBilling: false };
    const fileName = await reportFileName(svc, { kind: "fechamento_detalhado", params });
    expect(fileName).toMatch(/^Relatorio_Cliente_PdfLongo_.+_Agosto_2026_Previa\.pdf$/);

    const { data: artifact, error } = await svc
      .from("report_artifacts")
      .insert({
        kind: "fechamento_detalhado",
        source_type: "closing_version",
        params,
        file_name: fileName!,
        requested_by: admin.id,
        audience: "cliente",
      })
      .select("id")
      .single();
    if (error) throw error;

    expect(await processReport(artifact.id)).toBe("pronto");
    const { data: done } = await svc.from("report_artifacts").select("status, page_count, size_bytes, storage_key").eq("id", artifact.id).single();
    expect(done?.status).toBe("pronto");
    expect(done?.page_count).toBeGreaterThanOrEqual(30);
    console.info(`PDF longo: ${done?.page_count} páginas, ${Math.round((done?.size_bytes ?? 0) / 1024)} KB, ${done?.storage_key}`);
  }, 300_000);
});
