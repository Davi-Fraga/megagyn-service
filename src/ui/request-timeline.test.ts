import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RequestDetail } from "@/server/data";
import { RequestTimeline } from "./request-timeline";

type Ev = Record<string, unknown>;

function event(id: string, over: Ev): Ev {
  return {
    id,
    event_type: "comentario",
    occurred_at: "2026-10-30T13:21:00Z",
    actor_id: "u1",
    is_internal: false,
    from_status: null,
    to_status: null,
    reason: null,
    payload: {},
    work_entry_id: null,
    ...over,
  };
}

function render(events: Ev[]): string {
  const detail = { events, comments: [], entries: [], entryPhotos: new Map() } as unknown as RequestDetail;
  return renderToStaticMarkup(createElement(RequestTimeline, { detail, name: () => "Edvaldo Rocha", showInternal: true }));
}

/** Par rótulo/valor da lista de dados do evento. */
const fact = (label: string, value: string) => new RegExp(`<dt[^>]*>${label}</dt><dd[^>]*>${value}</dd>`);

describe("RequestTimeline na régua de obra", () => {
  const programming = event("e1", {
    event_type: "classificacao",
    from_status: "aberta",
    to_status: "programada",
    payload: { scheduled_date: "2026-11-03", assignee_names: ["Edvaldo Rocha", "Ana Lima"] },
  });

  it("mostra a data e o dia da semana na coluna da data, no fuso da empresa", () => {
    const html = render([programming]);
    expect(html).toMatch(/>30\/10\/2026<span[^>]*>sexta-feira<\/span>/);
  });

  it("mostra quem fez e o horário na linha do autor", () => {
    const html = render([programming]);
    expect(html).toMatch(/>Edvaldo Rocha<\/span><span[^>]*>às 10:21<\/span>/);
  });

  it("mostra programação e troca de situação como rótulo e valor, sem · nem —", () => {
    const html = render([programming]);
    expect(html).toMatch(fact("Situação", "Aberta → Programada"));
    expect(html).toMatch(fact("Data programada", "03/11/2026"));
    expect(html).toMatch(fact("Responsáveis", "Edvaldo Rocha, Ana Lima"));
    expect(html).not.toContain("·");
    expect(html).not.toMatch(/ — /);
  });

  it("separa a providência da pendência e quem responde por ela", () => {
    const html = render([
      event("e2", {
        event_type: "pendencia",
        payload: {
          pending_reason: "Falta material",
          expected_return_date: "2026-11-05",
          explanation: "O disjuntor não chegou",
          next_action: "Comprar disjuntor",
          next_action_owner_name: "Ana Lima",
        },
      }),
    ]);
    expect(html).toMatch(fact("Providência", "Comprar disjuntor"));
    expect(html).toMatch(fact("Responsável pela providência", "Ana Lima"));
    expect(html).toMatch(fact("Previsão de retorno", "05/11/2026"));
    expect(html).not.toMatch(/ — /);
  });

  it("usa marcador quadrado, sem bolinha, e destaca o evento mais recente", () => {
    const html = render([programming, event("e3", { occurred_at: "2026-11-02T20:05:00Z" })]);
    expect(html).not.toContain("rounded-full");
    const markers = [...html.matchAll(/<span aria-hidden="true" class="([^"]*size-\[7px\][^"]*)"/g)].map((m) => m[1] ?? "");
    expect(markers).toHaveLength(2);
    expect(markers[0]).toContain("bg-grafite");
    expect(markers[1]).toContain("bg-acento");
  });

  it("marca pendência com a cor de alerta mesmo quando é o evento mais recente", () => {
    const html = render([event("e4", { event_type: "pendencia", payload: {} })]);
    expect(html).toMatch(/<span aria-hidden="true" class="[^"]*size-\[7px\][^"]*bg-alerta/);
  });
});
