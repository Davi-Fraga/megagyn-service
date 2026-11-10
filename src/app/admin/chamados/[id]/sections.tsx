import { Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatDateBR, formatDateTimeBR } from "@/domain/dates";
import { REQUEST_TABS, photoGroups, type RequestTab } from "@/domain/request-tabs";
import { revokeAttachmentAction } from "@/server/actions/requests";
import type { RequestDetail } from "@/server/data";
import { cn } from "@/ui/cn";
import { PhotoGrid } from "@/ui/photo-grid";

type Name = (id: string | null | undefined) => string;

const OUTCOME_LABEL: Record<string, string> = { parcial: "Execução parcial", nao_executado: "Não executado" };

export function photoCount(detail: RequestDetail): number {
  return detail.requestPhotos.length + detail.entries.reduce((n, e) => n + (detail.entryPhotos.get(e.id)?.length ?? 0), 0);
}

/**
 * B-37: abas da O.S. como links (?aba=), no desenho das abas do campo; a atual tem aria-current.
 * Quebram linha em vez de rolar de lado: a 360 px a quarta aba ficaria escondida.
 */
export function RequestTabsNav({ requestId, current, counts }: { requestId: string; current: RequestTab; counts: Partial<Record<RequestTab, number>> }) {
  return (
    <nav aria-label="Seções da O.S." className="mb-6 flex flex-wrap gap-x-6 border-b border-linha">
      {REQUEST_TABS.map((t) => (
        <Link
          key={t.key}
          href={t.key === "solicitacao" ? `/admin/chamados/${requestId}` : `/admin/chamados/${requestId}?aba=${t.key}`}
          scroll={false}
          aria-current={t.key === current ? "page" : undefined}
          className={cn(
            "relative inline-flex min-h-12 items-center text-[0.9375rem]",
            t.key === current
              ? "font-bold text-grafite after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:bg-acento"
              : "font-medium text-muted hover:text-grafite",
          )}
        >
          {t.label}
          {counts[t.key] !== undefined && ` (${counts[t.key]})`}
        </Link>
      ))}
    </nav>
  );
}

/** Conteúdo de uma aba: título só para leitor de tela (a aba já nomeia a seção). */
export function TabSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="sr-only">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="text-[0.9375rem]">
      <span className="text-muted">{label}: </span>
      {children}
    </p>
  );
}

/** Aba Atendimentos: os registros de serviço da O.S. (andamento, pendência e execução), com as fotos de cada um. */
export function WorkEntries({ detail, name }: { detail: RequestDetail; name: Name }) {
  if (detail.entries.length === 0) return <p className="text-muted">Nenhum atendimento registrado ainda.</p>;
  return (
    <ol className="divide-y divide-linha border-b border-linha">
      {detail.entries.map((e) => {
        const others = (e.participants ?? []).map((p) => p.profile_id).filter((id) => id !== e.author_id);
        return (
          <li key={e.id} className="space-y-2 py-5 first:pt-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[1.0625rem] font-semibold">
                {formatDateBR(e.activity_date)} · {name(e.author_id)}
              </p>
              <Link href={`/admin/atividades/${e.id}`} className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-info underline">
                Abrir registro
              </Link>
            </div>
            <p className="text-sm text-muted">Enviado em {formatDateTimeBR(e.created_at)}</p>
            {(!e.client_visible || e.review_status === "ajustado" || OUTCOME_LABEL[e.outcome]) && (
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
                {OUTCOME_LABEL[e.outcome] && <span className="text-alerta">{OUTCOME_LABEL[e.outcome]}</span>}
                {!e.client_visible && (
                  <span className="inline-flex items-center gap-1 text-alerta">
                    <Lock aria-hidden className="size-3.5" /> Interno: não vai ao cliente
                  </span>
                )}
                {e.review_status === "ajustado" && <span className="text-grafite">Ajustado pela administração</span>}
              </p>
            )}
            <p className="max-w-[60ch] whitespace-pre-line text-[1.0625rem] leading-normal">{e.description}</p>
            {e.solution && e.solution !== e.description && <Fact label="Solução">{e.solution}</Fact>}
            {e.materials && <Fact label="Materiais">{e.materials}</Fact>}
            {e.hours_worked !== null && <Fact label="Horas">{String(e.hours_worked).replace(".", ",")}</Fact>}
            {others.length > 0 && <Fact label="Com">{others.map((id) => name(id)).join(", ")}</Fact>}
            <div className="pt-1">
              <PhotoGrid photos={detail.entryPhotos.get(e.id) ?? []} emptyText="Sem fotos neste atendimento." revokeAction={revokeAttachmentAction} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Aba Fotos: todas as fotos da O.S., da abertura e de cada atendimento. */
export function RequestPhotos({ detail, name }: { detail: RequestDetail; name: Name }) {
  const groups = photoGroups(detail.requestPhotos, detail.entries, detail.entryPhotos, (id) => name(id));
  if (groups.length === 0) return <p className="text-muted">Nenhuma foto nesta O.S.</p>;
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <div key={g.key}>
          <h3 className="mb-2 font-semibold">{g.title}</h3>
          <PhotoGrid photos={g.photos} revokeAction={revokeAttachmentAction} />
        </div>
      ))}
    </div>
  );
}
