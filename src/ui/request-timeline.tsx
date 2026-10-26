import {
  Ban,
  CalendarClock,
  CircleCheck,
  CircleDot,
  ClipboardCheck,
  Hammer,
  ImagePlus,
  Lock,
  MessageSquare,
  Pencil,
  RotateCcw,
  TriangleAlert,
  Undo2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { formatDateBR, formatDateTimeBR } from "@/domain/dates";
import { EVENT_LABEL } from "@/domain/request-events";
import { STATUS_LABEL, type RequestStatus } from "@/domain/request-status";
import type { RequestDetail } from "@/server/data";
import { PhotoGrid } from "./photo-grid";

const ICON: Record<string, LucideIcon> = {
  abertura: CircleDot,
  classificacao: CalendarClock,
  atribuicao: Users,
  reprogramacao: CalendarClock,
  prorrogacao: CalendarClock,
  inicio: Hammer,
  atividade: Hammer,
  pendencia: TriangleAlert,
  retomada: RotateCcw,
  execucao_informada: ClipboardCheck,
  devolucao: Undo2,
  validacao: CircleCheck,
  cancelamento: Ban,
  reabertura: RotateCcw,
  comentario: MessageSquare,
  anexo_adicionado: ImagePlus,
  anexo_revogado: Ban,
  edicao: Pencil,
};

const FIELD_LABEL: Record<string, string> = {
  title: "Título",
  description: "Descrição",
  priority_id: "Prioridade",
  service_category_id: "Categoria",
  due_date: "Prazo",
  site_area_id: "Ambiente",
  is_internal: "Demanda interna",
};

type Props = {
  detail: RequestDetail;
  name: (id: string | null | undefined) => string;
  showInternal: boolean;
};

/** Linha do tempo imutável do chamado/OS: eventos, comentários e atividades (com fotos). */
export function RequestTimeline({ detail, name, showInternal }: Props) {
  const comments = new Map(detail.comments.map((c) => [c.id, c]));
  const entries = new Map(detail.entries.map((e) => [e.id, e]));

  return (
    <ol className="relative space-y-5 border-l-2 border-linha pl-5">
      {detail.events
        .filter((e) => showInternal || !e.is_internal)
        .map((ev) => {
          const meta = { label: EVENT_LABEL[ev.event_type] ?? ev.event_type, icon: ICON[ev.event_type] ?? CircleDot, alert: ev.event_type === "pendencia" };
          const payload = (ev.payload ?? {}) as Record<string, unknown>;
          const comment = typeof payload.comment_id === "string" ? comments.get(payload.comment_id) : undefined;
          const entry = ev.work_entry_id ? entries.get(ev.work_entry_id) : undefined;
          const changes = payload.changes as Record<string, { de: unknown; para: unknown }> | undefined;
          return (
            <li key={ev.id} className="relative">
              <span
                aria-hidden
                className={`absolute -left-[1.95rem] top-0.5 flex size-6 items-center justify-center rounded-full border-2 bg-papel ${meta.alert ? "border-alerta text-alerta" : "border-linha text-grafite"}`}
              >
                <meta.icon className="size-3.5" />
              </span>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className="font-semibold">{meta.label}</p>
                {ev.is_internal && (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-alerta">
                    <Lock aria-hidden className="size-3.5" /> Nota interna
                  </span>
                )}
              </div>
              <p className="text-sm text-muted">
                {formatDateTimeBR(ev.occurred_at)} — {name(ev.actor_id)}
                {ev.to_status && ev.from_status !== ev.to_status && (
                  <>
                    {" "}
                    · {ev.from_status ? `${STATUS_LABEL[ev.from_status as RequestStatus]} → ` : ""}
                    {STATUS_LABEL[ev.to_status as RequestStatus]}
                  </>
                )}
              </p>

              {ev.reason && ev.event_type !== "pendencia" && <p className="mt-1">Motivo: {ev.reason}</p>}

              {ev.event_type === "pendencia" && (
                <dl className="mt-1 grid gap-x-4 gap-y-1 text-[0.95rem] sm:grid-cols-2">
                  <div>
                    <dt className="inline text-muted">Motivo: </dt>
                    <dd className="inline">{String(payload.pending_reason ?? "—")}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted">Previsão de retorno: </dt>
                    <dd className="inline">{formatDateBR(String(payload.expected_return_date ?? ""))}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="inline text-muted">O que aconteceu: </dt>
                    <dd className="inline">{String(payload.explanation ?? "—")}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="inline text-muted">Providência: </dt>
                    <dd className="inline">
                      {String(payload.next_action ?? "—")} — responsável: {String(payload.next_action_owner_name ?? "—")}
                    </dd>
                  </div>
                </dl>
              )}

              {(ev.event_type === "classificacao" || ev.event_type === "reprogramacao") && (
                <p className="mt-1 text-[0.95rem]">
                  Data programada: {formatDateBR(String(payload.scheduled_date ?? ""))}
                  {Array.isArray(payload.assignee_names) && ` · Responsáveis: ${(payload.assignee_names as string[]).join(", ")}`}
                </p>
              )}

              {ev.event_type === "abertura" && typeof payload.requester_name === "string" && (
                <p className="mt-1 text-[0.95rem]">
                  Solicitado por {payload.requester_name}
                  {typeof payload.channel === "string" && ` (${payload.channel})`}
                </p>
              )}

              {changes && (
                <ul className="mt-1 list-disc pl-5 text-[0.95rem]">
                  {Object.entries(changes).map(([field, c]) => (
                    <li key={field}>
                      {FIELD_LABEL[field] ?? field}
                      {field === "due_date" && `: ${formatDateBR(String(c.de ?? ""))} → ${formatDateBR(String(c.para ?? ""))}`}
                    </li>
                  ))}
                </ul>
              )}

              {comment && <p className="mt-1 whitespace-pre-line rounded-ctl bg-concreto px-3 py-2">{comment.body}</p>}

              {entry && (
                <div className="mt-2 space-y-2 rounded-ctl border border-linha bg-papel p-3">
                  <p className="text-sm text-muted">Data do serviço: {formatDateBR(entry.activity_date)}</p>
                  <p className="whitespace-pre-line">{entry.description}</p>
                  {entry.solution && entry.solution !== entry.description && (
                    <p>
                      <span className="text-muted">Solução: </span>
                      {entry.solution}
                    </p>
                  )}
                  {entry.materials && (
                    <p>
                      <span className="text-muted">Materiais: </span>
                      {entry.materials}
                    </p>
                  )}
                  {entry.hours_worked !== null && (
                    <p>
                      <span className="text-muted">Horas: </span>
                      {String(entry.hours_worked).replace(".", ",")}
                    </p>
                  )}
                  <PhotoGrid photos={detail.entryPhotos.get(entry.id) ?? []} emptyText="Sem fotos neste registro." />
                </div>
              )}
            </li>
          );
        })}
    </ol>
  );
}
