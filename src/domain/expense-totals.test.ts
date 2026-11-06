import { describe, expect, it } from "vitest";
import { allocationRows, headlineTotals, summarizeExpenses, type ExpenseForTotals } from "./expense-totals";

const A = "site-a";
const B = "site-b";
const C = "site-c";

const purchase1000 = (status: ExpenseForTotals["reviewStatus"] = "aprovado", id = "e1"): ExpenseForTotals => ({
  id,
  totalCents: 100000,
  reviewStatus: status,
  allocations: [
    { siteId: A, amountCents: 60000 },
    { siteId: B, amountCents: 40000 },
  ],
});

describe("summarizeExpenses — consolidado da empresa × atribuído por obra", () => {
  it("uma compra de R$ 1.000,00 rateada R$ 600,00 + R$ 400,00 soma R$ 1.000,00 para a empresa (nunca R$ 2.000,00)", () => {
    const s = summarizeExpenses([purchase1000("aprovado")]);
    expect(s.company.approved).toBe(100000);
    expect(s.counts.approved).toBe(1);
    const bySite = Object.fromEntries(s.bySite.map((x) => [x.siteId, x.approved]));
    expect(bySite).toEqual({ [A]: 60000, [B]: 40000 });
  });

  it("a soma do atribuído a todas as obras é igual ao consolidado da empresa", () => {
    const s = summarizeExpenses([
      purchase1000("aprovado", "e1"),
      { id: "e2", totalCents: 50000, reviewStatus: "enviado_para_conferencia", allocations: [{ siteId: C, amountCents: 50000 }] },
    ]);
    const approvedSites = s.bySite.reduce((n, x) => n + x.approved, 0);
    const reviewSites = s.bySite.reduce((n, x) => n + x.inReview, 0);
    expect(approvedSites).toBe(s.company.approved);
    expect(reviewSites).toBe(s.company.inReview);
  });

  it("separa aprovadas, em conferência, devolvidas e rascunhos (nunca somadas entre si)", () => {
    const s = summarizeExpenses([
      purchase1000("aprovado", "e1"),
      { id: "e2", totalCents: 50000, reviewStatus: "enviado_para_conferencia", allocations: [{ siteId: A, amountCents: 50000 }] },
      { id: "e3", totalCents: 2500, reviewStatus: "devolvido_para_correcao", allocations: [{ siteId: B, amountCents: 2500 }] },
      { id: "e4", totalCents: 999, reviewStatus: "rascunho", allocations: [{ siteId: A, amountCents: 999 }] },
    ]);
    expect(s.company).toEqual({ approved: 100000, inReview: 50000, returned: 2500, draft: 999 });
    expect(s.counts).toEqual({ approved: 1, inReview: 1, returned: 1, draft: 1 });
    const siteA = s.bySite.find((x) => x.siteId === A)!;
    expect(siteA).toEqual({ siteId: A, approved: 60000, inReview: 50000, returned: 0, draft: 999 });
  });

  it("lista vazia dá zeros", () => {
    const s = summarizeExpenses([]);
    expect(s.company).toEqual({ approved: 0, inReview: 0, returned: 0, draft: 0 });
    expect(s.bySite).toEqual([]);
  });

  it("ordena obras pelo maior valor (aprovado + em conferência)", () => {
    const s = summarizeExpenses([purchase1000("aprovado")]);
    expect(s.bySite.map((x) => x.siteId)).toEqual([A, B]);
  });

  it("recusa valores que não são centavos inteiros", () => {
    expect(() => summarizeExpenses([{ ...purchase1000(), totalCents: 1000.5 }])).toThrow();
    expect(() =>
      summarizeExpenses([{ ...purchase1000(), allocations: [{ siteId: A, amountCents: 0.1 }] }]),
    ).toThrow();
  });
});

describe("headlineTotals — painel da tela", () => {
  const list = [
    purchase1000("aprovado", "e1"),
    { id: "e2", totalCents: 30000, reviewStatus: "enviado_para_conferencia" as const, allocations: [{ siteId: A, amountCents: 30000 }] },
  ];

  it("sem filtro de obra mostra o consolidado da empresa (expenses.total_cents)", () => {
    const h = headlineTotals(summarizeExpenses(list), null);
    expect(h.scope).toBe("empresa");
    expect(h.values).toEqual({ approved: 100000, inReview: 30000, returned: 0, draft: 0 });
  });

  it("com filtro de obra mostra só o valor atribuído àquela obra pelas parcelas", () => {
    const h = headlineTotals(summarizeExpenses(list), B);
    expect(h.scope).toBe("obra");
    expect(h.values).toEqual({ approved: 40000, inReview: 0, returned: 0, draft: 0 });
    const hA = headlineTotals(summarizeExpenses(list), A);
    expect(hA.values.approved).toBe(60000);
    expect(hA.values.inReview).toBe(30000);
  });

  it("obra sem parcelas no resultado mostra zeros", () => {
    const h = headlineTotals(summarizeExpenses(list), C);
    expect(h.values).toEqual({ approved: 0, inReview: 0, returned: 0, draft: 0 });
  });
});

describe("headlineTotals — filtro de cliente (painel e lista usam a mesma soma)", () => {
  // Cliente X tem as obras A e C; a obra B é do cliente Y.
  const list: ExpenseForTotals[] = [
    {
      id: "e1",
      totalCents: 100000,
      reviewStatus: "aprovado",
      allocations: [
        { siteId: A, clientId: "X", amountCents: 60000 },
        { siteId: B, clientId: "Y", amountCents: 40000 },
      ],
    },
    { id: "e2", totalCents: 30000, reviewStatus: "enviado_para_conferencia", allocations: [{ siteId: C, clientId: "X", amountCents: 30000 }] },
  ];

  it("soma só as parcelas dos locais do cliente", () => {
    const h = headlineTotals(summarizeExpenses(list), null, "X");
    expect(h.scope).toBe("cliente");
    expect(h.values).toEqual({ approved: 60000, inReview: 30000, returned: 0, draft: 0 });
    expect(headlineTotals(summarizeExpenses(list), null, "Y").values.approved).toBe(40000);
  });

  it("com obra e cliente vale o atribuído à obra", () => {
    const h = headlineTotals(summarizeExpenses(list), A, "X");
    expect(h.scope).toBe("obra");
    expect(h.values.approved).toBe(60000);
  });

  it("cliente sem parcelas no resultado mostra zeros", () => {
    expect(headlineTotals(summarizeExpenses(list), null, "Z").values).toEqual({ approved: 0, inReview: 0, returned: 0, draft: 0 });
  });

  it("CSV com filtro de cliente traz só as parcelas dos locais dele", () => {
    const rows = allocationRows(list, null, "X");
    expect(rows.map((r) => [r.siteId, r.attributedCents])).toEqual([
      [A, 60000],
      [C, 30000],
    ]);
  });
});

describe("allocationRows — uma linha por parcela (CSV)", () => {
  it("cada linha traz o total da compra e o valor atribuído; somar o atribuído dá o consolidado (sem duplicar)", () => {
    const expenses = [
      purchase1000("aprovado", "e1"),
      { id: "e2", totalCents: 30000, reviewStatus: "enviado_para_conferencia" as const, allocations: [{ siteId: A, amountCents: 30000 }] },
    ];
    const rows = allocationRows(expenses, null);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ expense: { id: "e1" }, siteId: A, totalCents: 100000, attributedCents: 60000, index: 1, count: 2 });
    expect(rows[1]).toMatchObject({ siteId: B, totalCents: 100000, attributedCents: 40000, index: 2, count: 2 });
    const attributed = rows.reduce((n, r) => n + r.attributedCents, 0);
    expect(attributed).toBe(130000);
    expect(attributed).not.toBe(rows.reduce((n, r) => n + r.totalCents, 0));
  });

  it("com filtro de obra traz só as parcelas daquela obra", () => {
    const rows = allocationRows([purchase1000("aprovado")], B);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ siteId: B, totalCents: 100000, attributedCents: 40000, index: 2, count: 2 });
  });
});
