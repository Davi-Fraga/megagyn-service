import type { CSSProperties } from "react";
import { formatDateTimeBR } from "@/domain/dates";
import type { RequestStatus } from "@/domain/request-status";
import { statusRuler, type RulerStage, type RulerStepState } from "@/domain/status-ruler";
import { cn } from "./cn";

const STATE_SR: Record<RulerStepState, string> = {
  feita: "etapa cumprida",
  atual: "etapa atual",
  pausada: "pausada",
  futura: "a fazer",
};

/**
 * Régua da situação da O.S. (Aberta → Programada → Em execução → Executada → Concluída).
 * O nome da situação aparece sempre em texto; a régua desenhada é só reforço visual.
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
  const r = statusRuler(status);
  const summary = note ? `${r.label}: ${note}` : r.label;
  const tone = r.cancelled ? "text-erro" : r.paused ? "text-alerta" : "text-grafite";

  if (dates) {
    return (
      <div className={cn("regua regua--grande regua--animada", r.cancelled && "is-cancelada", className)}>
        {r.cancelled && <p className={cn("tipo-condensada mb-2.5 text-[1.0625rem] leading-tight", tone)}>{summary}</p>}
        <ol className="regua-trena" aria-label={`Situação: ${summary}`}>
          {r.steps.map((s, i) => (
            <li key={s.stage} className={cn("regua-etapa", `is-${s.state}`)} style={{ "--i": i } as CSSProperties}>
              <span aria-hidden className="regua-t">
                <span className="regua-barra" />
              </span>
              <span
                className={cn(
                  "tipo-condensada mt-2.5 block pr-1 text-[0.8125rem] leading-tight break-words sm:text-[1.0625rem]",
                  s.state === "futura" ? "font-medium text-muted" : "text-grafite",
                )}
              >
                {s.label}
                <span className="sr-only">, {STATE_SR[s.state]}</span>
              </span>
              {dates[s.stage] && (
                <span className="tipo-condensada block pr-1 text-[0.8125rem] font-medium leading-snug text-muted sm:text-[0.9375rem]">
                  {formatDateTimeBR(dates[s.stage])}
                </span>
              )}
              {s.state === "pausada" && (
                <span className={cn("tipo-condensada mt-1 block pr-1 text-[0.8125rem] leading-tight sm:text-[0.9375rem]", tone)}>{summary}</span>
              )}
              {s.state === "atual" && note && (
                <span className="tipo-condensada mt-1 block pr-1 text-[0.8125rem] leading-tight sm:text-[0.9375rem]">{note}</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className={cn("regua", size === "grande" ? "regua--grande" : "regua--compacta", r.cancelled && "is-cancelada", className)}>
      <ol aria-hidden className="regua-trena">
        {r.steps.map((s) => (
          <li key={s.stage} className={cn("regua-etapa", `is-${s.state}`)}>
            <span className="regua-t">
              <span className="regua-barra" />
            </span>
          </li>
        ))}
      </ol>
      <p className={cn("tipo-condensada mt-2 text-[0.9375rem] leading-tight", tone)}>{summary}</p>
    </div>
  );
}
