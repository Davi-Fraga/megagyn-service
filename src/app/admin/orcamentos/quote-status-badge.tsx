import { Ban, CircleCheck, CircleX, FilePen, Hourglass, Send, type LucideIcon } from "lucide-react";
import { QUOTE_STATUS_LABEL, type QuoteStatus } from "@/domain/quote";
import { Badge, type Tone } from "@/ui/status";

const STYLE: Record<QuoteStatus, { tone: Tone; icon: LucideIcon }> = {
  rascunho: { tone: "neutral", icon: FilePen },
  enviado: { tone: "info", icon: Send },
  aprovado: { tone: "ok", icon: CircleCheck },
  rejeitado: { tone: "erro", icon: CircleX },
  expirado: { tone: "alerta", icon: Hourglass },
  cancelado: { tone: "neutral", icon: Ban },
};

/** Situação efetiva (já com "Expirado" calculado na leitura). */
export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const s = STYLE[status];
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {QUOTE_STATUS_LABEL[status]}
    </Badge>
  );
}
