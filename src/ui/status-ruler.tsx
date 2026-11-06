import type { RequestStatus } from "@/domain/request-status";
import { statusRuler, type RulerStage } from "@/domain/status-ruler";
import { Ruler } from "./ruler";

/**
 * Régua da situação da O.S. (Aberta → Programada → Em execução → Executada → Concluída).
 * - compacta: listas e tabelas largas.
 * - grande: celular; com `dates`, mostra o nome e a data de cada etapa (detalhe da O.S.).
 */
export function StatusRuler({
  status,
  size = "compacta",
  note,
  dates,
  className,
}: {
  status: RequestStatus;
  size?: "compacta" | "grande";
  /** Complemento do nome da situação: motivo da pendência, "aguarda validação"... */
  note?: string | null;
  dates?: Partial<Record<RulerStage, string>>;
  className?: string;
}) {
  return <Ruler view={statusRuler(status)} size={size} note={note} dates={dates} className={className} />;
}
