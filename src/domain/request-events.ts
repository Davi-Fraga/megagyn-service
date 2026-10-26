import { formatDateBR } from "./dates";

export const EVENT_LABEL: Record<string, string> = {
  abertura: "Chamado aberto",
  classificacao: "Triagem: responsável e data definidos",
  atribuicao: "Responsáveis alterados",
  reprogramacao: "Reprogramado",
  prorrogacao: "Prazo alterado",
  inicio: "Serviço iniciado",
  atividade: "Atividade registrada",
  pendencia: "Pendência informada",
  retomada: "Serviço retomado",
  execucao_informada: "Execução informada — aguardando validação",
  devolucao: "Devolvido para correção",
  validacao: "Validado e concluído",
  cancelamento: "Cancelado",
  reabertura: "Reaberto",
  comentario: "Comentário",
  anexo_adicionado: "Fotos adicionadas",
  anexo_revogado: "Anexo removido",
  edicao: "Dados alterados",
};

type Ev = { event_type: string; reason: string | null; payload: unknown };

/** Resumo textual do evento (usado no PDF da OS e em listagens). */
export function describeEvent(ev: Ev, commentBody?: string | null): string {
  const p = (ev.payload ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  switch (ev.event_type) {
    case "abertura":
      return [p.requester_name ? `Solicitante: ${s(p.requester_name)}` : "", p.channel ? `Canal: ${s(p.channel)}` : ""].filter(Boolean).join(" · ");
    case "classificacao":
    case "reprogramacao":
      return [
        p.scheduled_date ? `Programado para ${formatDateBR(s(p.scheduled_date))}` : "",
        Array.isArray(p.assignee_names) ? `Responsáveis: ${(p.assignee_names as string[]).join(", ")}` : "",
        ev.reason ? `Motivo: ${ev.reason}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
    case "pendencia":
      return `${s(p.pending_reason)}: ${s(p.explanation)} · Providência: ${s(p.next_action)} (${s(p.next_action_owner_name)}) · Previsão: ${formatDateBR(s(p.expected_return_date))}`;
    case "execucao_informada":
      return p.solution ? `Solução: ${s(p.solution)}` : "";
    case "comentario":
      return commentBody ?? "";
    case "anexo_adicionado":
      return typeof p.count === "number" ? `${p.count} foto(s)` : "";
    default:
      return ev.reason ? `Motivo: ${ev.reason}` : "";
  }
}
