import { fieldError, type ActionState } from "@/domain/action-errors";
import { fdUuids } from "@/domain/form-data";
import { DEFAULT_FILE_LIMITS, tooManyFilesMessage, type FileLimits } from "@/domain/upload";
import type { ServerDb } from "@/server/supabase/server";

/** B-31: limites de envio das Configurações (tamanho por tipo e arquivos por envio). */
export async function loadFileLimits(db: Pick<ServerDb, "from">): Promise<FileLimits> {
  const { data } = await db.from("company_settings").select("max_image_mb, max_pdf_mb, max_files_per_upload").maybeSingle();
  if (!data) return DEFAULT_FILE_LIMITS;
  return { maxImageMb: data.max_image_mb, maxPdfMb: data.max_pdf_mb, maxFiles: data.max_files_per_upload };
}

/**
 * B-31: a rota de envio recebe um arquivo por chamada e não sabe quantos o formulário juntou. A
 * quantidade é conferida aqui, nas ações que recebem a lista, campo a campo (cada campo de fotos é um envio).
 */
export async function checkFileCount(db: Pick<ServerDb, "from">, fd: FormData, fields: string[]): Promise<ActionState | null> {
  const counts = fields.map((field) => ({ field, count: fdUuids(fd, field).length })).filter((c) => c.count > 1);
  if (counts.length === 0) return null;
  const { maxFiles } = await loadFileLimits(db);
  const over = counts.find((c) => c.count > maxFiles);
  return over ? fieldError(over.field, tooManyFilesMessage(maxFiles)) : null;
}
