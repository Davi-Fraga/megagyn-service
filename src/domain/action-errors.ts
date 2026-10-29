/**
 * Converte erros do banco/RPC em estado de formulário. Mensagens das nossas funções
 * (códigos de regra de negócio) são em português e seguras para o usuário; qualquer
 * outro erro vira uma mensagem genérica (o detalhe vai só para o log do servidor).
 */

export type ActionState<T = unknown> = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
};

type DbError = { code?: string; message?: string; hint?: string | null };

const SAFE_CODES = new Set(["P0001", "P0002", "42501", "23514"]);

/** Nomes de campo usados pelo banco que diferem do padrão camelCase → snake_case dos formulários. */
const FIELD_ALIAS: Record<string, string> = { photos: "photo_ids", receipts: "receipt_ids" };

/** "resultPhotoIds" → "result_photo_ids" (nome do input no formulário). */
export function formFieldName(hint: string): string {
  return FIELD_ALIAS[hint] ?? hint.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function toActionError(error: unknown): ActionState<never> {
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return { ok: false, message: "Sem conexão com o servidor. Verifique a internet e tente de novo." };
  }
  const e = (error ?? {}) as DbError;
  if (e.code === "23505") return { ok: false, message: "Já existe um registro com esses dados." };
  if (e.code && SAFE_CODES.has(e.code) && e.message) {
    const field = e.hint?.trim();
    return field ? { ok: false, message: e.message, fieldErrors: { [formFieldName(field)]: e.message } } : { ok: false, message: e.message };
  }
  return { ok: false, message: "Não foi possível concluir a operação. Tente novamente." };
}

export function fieldError(field: string, message: string): ActionState<never> {
  return { ok: false, message, fieldErrors: { [field]: message } };
}
