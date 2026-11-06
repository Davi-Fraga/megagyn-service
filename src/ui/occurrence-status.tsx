import { Badge, type Tone } from "./status";

export const OCCURRENCE_LABEL: Record<string, { label: string; tone: Tone }> = {
  prevista: { label: "Prevista", tone: "neutral" },
  iniciada: { label: "Iniciada", tone: "acento" },
  concluida: { label: "Finalizada", tone: "ok" },
  nao_realizada: { label: "Não realizada", tone: "alerta" },
  cancelada: { label: "Cancelada", tone: "neutral" },
};

export function OccurrenceBadge({ status }: { status: string }) {
  const s = OCCURRENCE_LABEL[status] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
