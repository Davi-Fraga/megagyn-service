import { beforeAll, describe, expect, it } from "vitest";
import { loadMyPurchaseSummary } from "@/server/purchases";
import { addMembership, createClientWithSite, createUser, fakePhoto, today, uid, type TestUser } from "./helpers";

/**
 * CMP-09 "Minhas compras": o valor a receber vem de TODOS os reembolsos em aberto da pessoa,
 * não só das compras que cabem na lista da tela (antes: as 150 mais recentes).
 */

let admin: TestUser;
let foreman: TestUser;
let siteId: string;

async function purchase(totalCents: number, paidBy: "empresa" | "colaborador") {
  const receipt = await fakePhoto(foreman, null, "receipts");
  const { data, error } = await foreman.db.rpc("expense_save", {
    p_client_request_id: uid(),
    p_expense_date: today(),
    p_description: "Material (fictício)",
    p_supplier_name_free: "Loja fictícia",
    p_total_cents: totalCents,
    p_allocations: [{ site_id: siteId, amount_cents: totalCents, purpose: "Manutenção" }],
    p_receipt_ids: [receipt.id],
    p_paid_by_kind: paidBy,
  });
  if (error) throw error;
  return data!.id;
}

beforeAll(async () => {
  [admin, foreman] = await Promise.all([createUser("admin", "Admin Resumo Compras"), createUser("foreman", "Encarregado Resumo Compras")]);
  siteId = (await createClientWithSite("ResumoCompras")).site.id;
  await addMembership(foreman.id, siteId);

  const partial = await purchase(50_000, "colaborador");
  expect((await admin.db.rpc("expense_approve", { p_expense_id: partial })).error).toBeNull();
  expect((await admin.db.rpc("reimbursement_register_payment", { p_expense_id: partial, p_amount_cents: 20_000 })).error).toBeNull();

  const paidOff = await purchase(10_000, "colaborador");
  expect((await admin.db.rpc("expense_approve", { p_expense_id: paidOff })).error).toBeNull();
  expect((await admin.db.rpc("reimbursement_register_payment", { p_expense_id: paidOff, p_amount_cents: 10_000 })).error).toBeNull();

  await purchase(7_000, "colaborador"); // ainda em conferência: já é devido
  await purchase(99_000, "empresa"); // empresa pagou: nada a receber

  const returned = await purchase(5_000, "empresa");
  expect((await admin.db.rpc("expense_return", { p_expense_id: returned, p_reason: "Nota ilegível" })).error).toBeNull();
}, 120_000);

describe("resumo de Minhas compras", () => {
  it("soma o que falta receber em todos os reembolsos abertos e conta as devolvidas", async () => {
    const summary = await loadMyPurchaseSummary(foreman.db, foreman.id);
    expect(summary.toReceiveCents).toBe(30_000 + 7_000);
    expect(summary.returnedCount).toBe(1);
  });
});
