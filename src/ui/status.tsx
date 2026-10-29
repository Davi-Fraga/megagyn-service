import {
  Ban,
  CalendarClock,
  CircleCheck,
  CircleDot,
  ClipboardCheck,
  Hammer,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { RequestStatus } from "@/domain/request-status";
import { STATUS_LABEL } from "@/domain/request-status";
import { cn } from "./cn";

const STATUS_STYLE: Record<RequestStatus, { icon: LucideIcon; cls: string }> = {
  aberta: { icon: CircleDot, cls: "bg-info-claro text-info border-info/40" },
  programada: { icon: CalendarClock, cls: "bg-concreto-2 text-grafite border-linha" },
  em_execucao: { icon: Hammer, cls: "bg-laranja-claro text-laranja-escuro border-laranja/40" },
  pendente: { icon: TriangleAlert, cls: "bg-alerta-claro text-alerta border-alerta/50" },
  executada: { icon: ClipboardCheck, cls: "bg-info-claro text-info border-info/40" },
  concluida: { icon: CircleCheck, cls: "bg-ok-claro text-ok border-ok/40" },
  cancelada: { icon: Ban, cls: "bg-concreto-2 text-muted border-linha" },
};

export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  const { icon: Icon, cls } = STATUS_STYLE[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold", cls, className)}>
      <Icon aria-hidden className="size-4" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export type Tone = "neutral" | "ok" | "alerta" | "erro" | "info" | "laranja";
const TONE: Record<Tone, string> = {
  neutral: "bg-concreto-2 text-grafite border-linha",
  ok: "bg-ok-claro text-ok border-ok/40",
  alerta: "bg-alerta-claro text-alerta border-alerta/50",
  erro: "bg-erro-claro text-erro border-erro/40",
  info: "bg-info-claro text-info border-info/40",
  laranja: "bg-laranja-claro text-laranja-escuro border-laranja/40",
};

export function Badge({ tone = "neutral", children, icon: Icon }: { tone?: Tone; children: React.ReactNode; icon?: LucideIcon }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold", TONE[tone])}>
      {Icon && <Icon aria-hidden className="size-4" />}
      {children}
    </span>
  );
}

/** Alerta de prazo vencido ou impedimento: fita zebrada + texto (nunca só cor). */
export function AlertTape({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-stretch overflow-hidden rounded-ctl border border-grafite text-sm font-semibold">
      <span aria-hidden className="faixa-alerta w-3" />
      <span className="bg-papel px-2 py-0.5">{children}</span>
    </span>
  );
}
