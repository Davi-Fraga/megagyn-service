import type { LucideIcon } from "lucide-react";
import type { RequestStatus } from "@/domain/request-status";
import { STATUS_LABEL } from "@/domain/request-status";
import { cn } from "./cn";

export type Tone = "neutral" | "ok" | "alerta" | "erro" | "info" | "acento";
const TONE: Record<Tone, { text: string; mark: string }> = {
  neutral: { text: "text-grafite", mark: "bg-muted" },
  ok: { text: "text-ok", mark: "bg-ok" },
  alerta: { text: "text-alerta", mark: "bg-alerta" },
  erro: { text: "text-erro", mark: "bg-erro" },
  info: { text: "text-info", mark: "bg-info" },
  acento: { text: "text-acento-escuro", mark: "bg-acento" },
};

const STATUS_TONE: Record<RequestStatus, Tone> = {
  aberta: "info",
  programada: "neutral",
  em_execucao: "acento",
  pendente: "alerta",
  executada: "info",
  concluida: "ok",
  cancelada: "erro",
};

/**
 * Selo de situação: texto condensado na cor do tom, com um marcador quadrado
 * (ou o ícone). Sem pílula nem fundo: o nome da situação é sempre o que informa.
 */
export function Badge({ tone = "neutral", children, icon: Icon, className }: { tone?: Tone; children: React.ReactNode; icon?: LucideIcon; className?: string }) {
  const t = TONE[tone];
  return (
    <span className={cn("tipo-condensada inline-flex items-center gap-1.5 text-[0.9375rem] leading-tight", t.text, className)}>
      {Icon ? <Icon aria-hidden className="size-4 shrink-0" /> : <span aria-hidden className={cn("size-[7px] shrink-0", t.mark)} />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status]} className={className}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/** Prazo vencido: fita zebrada fina + texto (nunca só cor). */
export function AlertTape({ children }: { children: React.ReactNode }) {
  return (
    <span className="tipo-condensada inline-flex items-stretch gap-2 text-[0.9375rem] leading-tight text-erro">
      <span aria-hidden className="faixa-alerta w-1.5 shrink-0" />
      <span className="py-0.5">{children}</span>
    </span>
  );
}
