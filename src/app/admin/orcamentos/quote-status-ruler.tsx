import type { QuoteStatus } from "@/domain/quote";
import { quoteRuler } from "@/domain/quote-ruler";
import { Ruler } from "@/ui/ruler";

/**
 * Situação do orçamento como régua (Rascunho → Enviado → Aprovado).
 * - compacta: lista de orçamentos.
 * - grande com `stages`: detalhe, com o nome de cada etapa.
 */
export function QuoteStatusRuler({
  status,
  size = "compacta",
  stages = false,
  note,
}: {
  /** Situação efetiva (já com "expirado" calculado). */
  status: QuoteStatus;
  size?: "compacta" | "grande";
  stages?: boolean;
  note?: string | null;
}) {
  return <Ruler view={quoteRuler(status)} size={size} note={note} dates={stages ? {} : undefined} />;
}
