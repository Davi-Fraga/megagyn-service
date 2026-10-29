import type { ExpenseReviewStatus } from "./expense-totals";

export type ReimbursementStatus = "pendente" | "parcial" | "quitado";
export type ExpenseReviewAction = "enviada" | "reenviada" | "editada" | "aprovada" | "devolvida" | "invalidada";
type ToneName = "neutral" | "ok" | "alerta" | "erro" | "info" | "laranja";

export const EXPENSE_STATUS_LABEL: Record<ExpenseReviewStatus, string> = {
  rascunho: "Rascunho",
  enviado_para_conferencia: "Em conferência",
  aprovado: "Aprovada",
  devolvido_para_correcao: "Devolvida para correção",
};

export const EXPENSE_STATUS_TONE: Record<ExpenseReviewStatus, ToneName> = {
  rascunho: "neutral",
  enviado_para_conferencia: "info",
  aprovado: "ok",
  devolvido_para_correcao: "alerta",
};

export const REIMBURSEMENT_STATUS_LABEL: Record<ReimbursementStatus, string> = {
  pendente: "Reembolso pendente",
  parcial: "Reembolso parcial",
  quitado: "Reembolso quitado",
};

export const REIMBURSEMENT_STATUS_TONE: Record<ReimbursementStatus, ToneName> = {
  pendente: "alerta",
  parcial: "laranja",
  quitado: "ok",
};

export const REVIEW_ACTION_LABEL: Record<ExpenseReviewAction, string> = {
  enviada: "Enviada para conferência",
  reenviada: "Reenviada para conferência",
  editada: "Dados alterados",
  aprovada: "Aprovada",
  devolvida: "Devolvida para correção",
  invalidada: "Aprovação desfeita por alteração de valor, data, pagador ou rateio",
};
