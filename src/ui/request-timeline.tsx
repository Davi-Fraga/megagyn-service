import { Lock } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { formatDateBR, formatTimeBR, isoDateInTz, weekdayPt } from "@/domain/dates";
import { EVENT_LABEL } from "@/domain/request-events";
import { STATUS_LABEL, type RequestStatus } from "@/domain/request-status";
import type { RequestDetail } from "@/server/data";
import { cn } from "./cn";
import { PhotoGrid } from "./photo-grid";

const FIELD_LABEL: Record<string, string> = {
  title: "Título",
  description: "Descrição",
  priority_id: "Prioridade",
  service_category_id: "Categoria",
  due_date: "Prazo",
  site_area_id: "Ambiente",
  is_internal: "Demanda interna",
};

type TimelineEvent = RequestDetail["events"][number];
type Fact = [label: string, value: ReactNode];

/** Dados do evento como pares rótulo e valor, na ordem em que aparecem. */
function eventFacts(ev: TimelineEvent, payload: Record<string, unknown>): Fact[] {
  const facts: Fact[] = [];
  if (ev.to_status && ev.from_status !== ev.to_status) {
    const to = STATUS_LABEL[ev.to_status as RequestStatus];
    facts.push(["Situação", ev.from_status ? `${STATUS_LABEL[ev.from_status as RequestStatus]} → ${to}` : to]);
  }
  if (ev.event_type === "abertura" && typeof payload.requester_name === "string") {
    facts.push(["Solicitado por", typeof payload.channel === "string" ? `${payload.requester_name} (${payload.channel})` : payload.requester_name]);
  }
  if (ev.event_type === "classificacao" || ev.event_type === "reprogramacao") {
    facts.push(["Data programada", formatDateBR(String(payload.scheduled_date ?? ""))]);
    if (Array.isArray(payload.assignee_names)) facts.push(["Responsáveis", (payload.assignee_names as string[]).join(", ")]);
  }
  if (ev.event_type === "pendencia") {
    facts.push(
      ["Motivo", String(payload.pending_reason ?? "—")],
      ["Previsão de retorno", formatDateBR(String(payload.expected_return_date ?? ""))],
      ["O que aconteceu", String(payload.explanation ?? "—")],
      ["Providência", String(payload.next_action ?? "—")],
      ["Responsável pela providência", String(payload.next_action_owner_name ?? "—")],
    );
  } else if (ev.reason) {
    facts.push(["Motivo", ev.reason]);
  }
  const changes = payload.changes as Record<string, { de: unknown; para: unknown }> | undefined;
  for (const [field, c] of Object.entries(changes ?? {})) {
    facts.push([FIELD_LABEL[field] ?? field, field === "due_date" ? `${formatDateBR(String(c.de ?? ""))} → ${formatDateBR(String(c.para ?? ""))}` : "alterado"]);
  }
  return facts;
}

function Facts({ items }: { items: Fact[] }) {
  if (items.length === 0) return null;
  return (
    // No celular o rótulo fica em cima do valor: rótulo longo ao lado espremia o valor.
    <dl className="mt-2.5 grid gap-x-4 text-[0.9375rem] sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-y-0.5">
      {items.map(([label, value], i) => (
        <Fragment key={i}>
          <dt className="text-muted">{label}</dt>
          <dd className="mb-1.5 font-medium sm:mb-0">{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

type Props = {
  detail: RequestDetail;
  name: (id: string | null | undefined) => string;
  showInternal: boolean;
};

/**
 * Linha do tempo imutável do chamado/OS na régua de obra: data e dia da semana à esquerda;
 * à direita, numa linha fina com marcador quadrado, o que aconteceu, quem fez e os dados do evento.
 * O marcador do evento mais recente fica na cor de acento; o de pendência, na de alerta.
 */
export function RequestTimeline({ detail, name, showInternal }: Props) {
  const comments = new Map(detail.comments.map((c) => [c.id, c]));
  const entries = new Map(detail.entries.map((e) => [e.id, e]));
  const visible = detail.events.filter((e) => showInternal || !e.is_internal);

  return (
    <ol>
      {visible.map((ev, index) => {
        const last = index === visible.length - 1;
        const pending = ev.event_type === "pendencia";
        const day = isoDateInTz(new Date(ev.occurred_at));
        const payload = (ev.payload ?? {}) as Record<string, unknown>;
        const comment = typeof payload.comment_id === "string" ? comments.get(payload.comment_id) : undefined;
        const entry = ev.work_entry_id ? entries.get(ev.work_entry_id) : undefined;
        return (
          <li key={ev.id} className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-5">
            <p className="tipo-condensada text-[1.0625rem] tabular-nums sm:pt-px">
              {formatDateBR(day)}
              <span className="ml-2 text-[0.9375rem] font-medium text-muted sm:ml-0 sm:block">{weekdayPt(day)}</span>
            </p>
            <div className={cn("relative ml-1 border-l border-linha pl-4 sm:ml-0 sm:pl-6", !last && "pb-7")}>
              <span aria-hidden className={cn("absolute -left-1 top-2 size-[7px]", pending ? "bg-alerta" : last ? "bg-acento" : "bg-grafite")} />
              <p className="text-[1.0625rem] font-semibold leading-snug">
                {EVENT_LABEL[ev.event_type] ?? ev.event_type}
                {ev.is_internal && (
                  <span className="ml-2 inline-flex items-center gap-1 text-sm font-semibold text-alerta">
                    <Lock aria-hidden className="size-3.5" /> Nota interna
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[0.9375rem]">
                <span className="font-semibold">{name(ev.actor_id)}</span>
                <span className="ml-2 text-muted">{`às ${formatTimeBR(ev.occurred_at)}`}</span>
              </p>

              <Facts items={eventFacts(ev, payload)} />

              {comment && <p className="mt-2 max-w-[60ch] whitespace-pre-line text-[1.0625rem] leading-normal">{comment.body}</p>}

              {entry && (
                <div className="mt-2">
                  <p className="max-w-[60ch] whitespace-pre-line text-[1.0625rem] leading-normal">{entry.description}</p>
                  <Facts
                    items={[
                      ["Data do serviço", formatDateBR(entry.activity_date)],
                      ...(entry.solution && entry.solution !== entry.description ? ([["Solução", entry.solution]] as Fact[]) : []),
                      ...(entry.materials ? ([["Materiais", entry.materials]] as Fact[]) : []),
                      ...(entry.hours_worked !== null ? ([["Horas", String(entry.hours_worked).replace(".", ",")]] as Fact[]) : []),
                    ]}
                  />
                  <div className="mt-3">
                    <PhotoGrid photos={detail.entryPhotos.get(entry.id) ?? []} emptyText="Sem fotos neste registro." />
                  </div>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
