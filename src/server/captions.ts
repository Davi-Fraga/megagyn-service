import type { ActionState } from "@/domain/action-errors";
import { fdCaptions } from "@/domain/form-data";
import { errorInfo, log } from "@/server/log";
import type { ServerDb } from "@/server/supabase/server";

export const CAPTION_FAILED = "Não foi possível salvar a legenda das fotos. Nada foi registrado: tente de novo.";

/**
 * B-32: as ações chamam isto ANTES de gravar o registro. A legenda fica no anexo, que já foi enviado,
 * então não depende do registro. Se falhar, a ação devolve o erro e nada é gravado, em vez de dizer
 * "salvo" sem a legenda. No reenvio, a chave do formulário evita registro duplicado.
 * Devolve null quando gravou todas (ou não havia legenda).
 */
export async function saveCaptions(db: Pick<ServerDb, "rpc">, fd: FormData): Promise<ActionState | null> {
  const captions = fdCaptions(fd);
  const expected = Object.keys(captions).length;
  if (expected === 0) return null;
  const { data, error } = await db.rpc("attachment_set_captions", { p_captions: captions });
  if (!error && data === expected) return null;
  // A função ignora a foto que não é de quem envia (nem da administração): conta a menos é falha também.
  log.error("attachment.captions_fail", { expected, saved: data ?? null, ...(error ? errorInfo(error) : {}) });
  return { ok: false, message: CAPTION_FAILED };
}
