// PDF "despesas_internas" (ADM-11): uso interno, gerado com a chave de serviço no servidor/worker.
import { listExpenses } from "@/app/admin/despesas/expense-list";
import { EXPENSE_STATUS_LABEL, REIMBURSEMENT_STATUS_LABEL } from "@/domain/expense-status";
import { expensesReportFileName, parseExpenseReportParams } from "@/domain/expense-report";
import { headlineTotals } from "@/domain/expense-totals";
import { loadProfiles } from "@/server/data";
import { expensesReportBody } from "@/reports/templates/expenses";
import { registerBuilder } from "../builders";
import { registerFileName } from "../file-names";

registerFileName("despesas_internas", async (db, input) => {
  const p = parseExpenseReportParams(input.params);
  if (!p) return null;
  let siteName: string | null = null;
  if (p.siteId) {
    // Sessão do admin (RLS): confirma que a obra existe.
    const { data } = await db.from("sites").select("name").eq("id", p.siteId).maybeSingle();
    if (!data) return null;
    siteName = data.name;
  }
  return expensesReportFileName(p, siteName);
});

registerBuilder("despesas_internas", async (admin, job) => {
  const p = parseExpenseReportParams(job.params);
  if (!p) throw new Error("Período do relatório de despesas não encontrado.");
  const [list, profiles, site] = await Promise.all([
    listExpenses(admin, { from: p.from, to: p.to, siteId: p.siteId, clientId: null, supplierId: null, purchaserId: null, categoryId: null, status: null, q: null }),
    loadProfiles(admin),
    p.siteId ? admin.from("sites").select("name").eq("id", p.siteId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (p.siteId && !site.data) throw new Error("Obra não encontrada para o PDF de despesas.");
  const siteName = site.data?.name ?? null;

  const names = new Map<string, { siteName: string; clientName: string }>();
  for (const e of list.rows) for (const a of e.allocations) names.set(a.siteId, { siteName: a.siteName, clientName: a.clientName });
  const headline = headlineTotals(list.totals, p.siteId);
  const bySite = list.totals.bySite
    .filter((s) => !p.siteId || s.siteId === p.siteId)
    .map((s) => ({ ...(names.get(s.siteId) ?? { siteName: "—", clientName: "—" }), approved: s.approved, inReview: s.inReview, returned: s.returned }));

  const label = `Despesas internas ${p.from.split("-").reverse().join("/")} a ${p.to.split("-").reverse().join("/")}`;
  return {
    title: label,
    footerLabel: "Despesas internas — uso interno",
    photoIds: [],
    body: () =>
      expensesReportBody({
        from: p.from,
        to: p.to,
        siteName,
        scope: headline.scope,
        headline: headline.values,
        counts: list.totals.counts,
        bySite,
        expenses: list.rows.map((e) => ({
          date: e.expenseDate,
          supplier: e.supplierName,
          description: e.description,
          category: e.categoryName,
          purchaser: profiles.name(e.purchasedBy),
          paidBy: e.paidByKind === "empresa" ? "empresa" : profiles.name(e.paidByProfileId),
          totalCents: e.totalCents,
          attributedCents: p.siteId ? e.allocations.filter((a) => a.siteId === p.siteId).reduce((n, a) => n + a.amountCents, 0) : null,
          statusLabel: EXPENSE_STATUS_LABEL[e.reviewStatus],
          reimbursementLabel: e.reimbursement ? REIMBURSEMENT_STATUS_LABEL[e.reimbursement.status] : null,
          allocations: e.allocations.map((a) => ({
            siteName: a.siteName,
            amountCents: a.amountCents,
            purpose: a.purpose,
            highlighted: a.siteId === p.siteId,
          })),
        })),
        issuedAt: job.requested_at,
        issuedBy: profiles.name(job.requested_by),
      }),
  };
});
