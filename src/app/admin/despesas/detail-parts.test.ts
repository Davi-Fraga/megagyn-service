import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExpenseFacts, ReimbursementFacts, ReviewHistory } from "./detail-parts";
import type { ExpenseDetail } from "./expense-list";

const NAMES: Record<string, string> = { u1: "Carlos Compras", u2: "Admin Compras" };
const name = (id: string | null | undefined) => (id ? (NAMES[id] ?? "?") : "—");

function review(id: string, action: string, created_at: string, actor_id = "u2", reason: string | null = null) {
  return { id, action, actor_id, reason, created_at };
}

function detail(over: Record<string, unknown> = {}): ExpenseDetail {
  return {
    expense: {
      id: "e1",
      totalCents: 110000,
      expenseDate: "2026-10-25",
      supplierName: "Casa de materiais (fictícia)",
      categoryName: null,
      paymentName: null,
      documentNumber: null,
      purchasedBy: "u1",
      paidByKind: "colaborador",
      paidByProfileId: "u1",
      itemsNotes: null,
      submittedAt: null,
    },
    request: null,
    reviews: [],
    reimbursement: null,
    ...over,
  } as unknown as ExpenseDetail;
}

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("histórico da conferência na régua de obra", () => {
  const reviews = [
    review("r1", "enviada", "2026-10-25T18:22:00Z", "u1"),
    review("r2", "devolvida", "2026-10-26T12:05:00Z", "u2", "Falta a nota"),
    review("r3", "aprovada", "2026-10-27T14:40:00Z", "u2"),
  ];

  it("mostra quem fez e quando, sem ·", () => {
    const out = html(createElement(ReviewHistory, { detail: detail({ reviews }), name }));
    expect(out).toMatch(/>Carlos Compras<\/span><span[^>]*>25\/10\/2026 às 15:22<\/span>/);
    expect(out).toContain("Motivo: Falta a nota");
    expect(out).not.toContain("·");
  });

  it("usa marcador quadrado: o mais recente em acento e a devolução em alerta", () => {
    const out = html(createElement(ReviewHistory, { detail: detail({ reviews }), name }));
    const markers = [...out.matchAll(/<span aria-hidden="true" class="([^"]*size-\[7px\][^"]*)"/g)].map((m) => m[1] ?? "");
    expect(markers).toHaveLength(3);
    expect(markers[0]).toContain("bg-grafite");
    expect(markers[1]).toContain("bg-alerta");
    expect(markers[2]).toContain("bg-acento");
  });
});

describe("reembolso na régua de obra", () => {
  const reimbursement = {
    payee_profile_id: "u1",
    status: "quitado",
    amount_due_cents: 110000,
    amount_paid_cents: 110000,
    settled_at: "2026-10-25T18:22:00Z",
    settled_by: "u2",
    settlement_notes: "25/10/2026: R$ 300,00\n25/10/2026: R$ 800,00",
  };

  it("mostra o último registro com vírgula, sem ·", () => {
    const out = html(createElement(ReimbursementFacts, { detail: detail({ reimbursement }), name }));
    expect(out).toMatch(/<dt[^>]*>Último registro<\/dt><dd[^>]*>25\/10\/2026 15:22, por Admin Compras<\/dd>/);
    expect(out).not.toContain("·");
  });

  it("lista os pagamentos com divisórias, sem marcador de lista", () => {
    const out = html(createElement(ReimbursementFacts, { detail: detail({ reimbursement }), name }));
    expect(out).not.toContain("list-disc");
    expect(out).toMatch(/<ul class="[^"]*divide-y[^"]*"><li[^>]*>25\/10\/2026: R\$ 300,00<\/li>/);
  });
});

describe("dados da compra", () => {
  it("mostra o chamado relacionado com vírgula, sem —", () => {
    const request = { id: "s1", number: "OS-2026-0012", title: "Troca de registro" };
    const out = html(createElement(ExpenseFacts, { detail: detail({ request }), name, requestHref: (id: string) => `/admin/chamados/${id}` }));
    expect(out).toContain(">OS-2026-0012, Troca de registro</a>");
    expect(out).not.toContain("OS-2026-0012 — ");
  });
});
