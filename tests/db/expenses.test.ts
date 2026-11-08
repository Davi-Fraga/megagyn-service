import { beforeAll, describe, expect, it } from "vitest";
import { addMembership, createClientWithSite, createUser, fakePhoto, serviceClient, sql, today, uid, type TestUser } from "./helpers";

let admin: TestUser;
let foreman: TestUser;
let otherForeman: TestUser;
let worker: TestUser;
let obraA: { id: string };
let obraB: { id: string };

beforeAll(async () => {
  [admin, foreman, otherForeman, worker] = await Promise.all([
    createUser("admin", "Admin Compras"),
    createUser("foreman", "Carlos Compras"),
    createUser("foreman", "Outro Encarregado"),
    createUser("worker", "Funcionário Compras"),
  ]);
  obraA = (await createClientWithSite("CompraA")).site;
  obraB = (await createClientWithSite("CompraB")).site;
  for (const s of [obraA, obraB]) await addMembership(foreman.id, s.id);
});

async function newExpense(user: TestUser, allocations: Array<{ site_id: string; amount_cents: number; purpose: string }>, extra = {}) {
  const receipt = await fakePhoto(user, null, "receipts");
  return user.db.rpc("expense_save", {
    p_client_request_id: uid(),
    p_expense_date: today(),
    p_description: "Material hidráulico",
    p_supplier_name_free: "Casa de materiais (fictícia)",
    p_total_cents: 100000,
    p_allocations: allocations,
    p_receipt_ids: [receipt.id],
    ...extra,
  });
}

const split = () => [
  { site_id: obraA.id, amount_cents: 60000, purpose: "Cozinha do salão" },
  { site_id: obraB.id, amount_cents: 40000, purpose: "Cobertura" },
];

describe("T-A7 — compra única dividida entre obras", () => {
  it("R$ 1.000,00 = R$ 600,00 + R$ 400,00; consolidado R$ 1.000,00, não R$ 2.000,00", async () => {
    const { data, error } = await newExpense(foreman, split());
    expect(error).toBeNull();
    expect(data!.review_status).toBe("enviado_para_conferencia");

    const { data: allocs } = await admin.db.from("expense_allocations").select("site_id,amount_cents").eq("expense_id", data!.id);
    const bySite = Object.fromEntries(allocs!.map((a) => [a.site_id, a.amount_cents]));
    expect(bySite[obraA.id]).toBe(60000);
    expect(bySite[obraB.id]).toBe(40000);

    const { data: exp } = await admin.db.from("expenses").select("total_cents").eq("id", data!.id).single();
    const consolidated = exp!.total_cents;
    const sumParts = allocs!.reduce((n, a) => n + a.amount_cents, 0);
    expect(consolidated).toBe(100000);
    expect(sumParts).toBe(consolidated);

    const { data: receipts } = await admin.db.from("attachment_links").select("id").eq("entity_type", "expense").eq("entity_id", data!.id);
    expect(receipts).toHaveLength(1); // um único comprovante para as duas parcelas
  });

  it("rejeita diferença de R$ 0,01", async () => {
    const { error } = await newExpense(foreman, [
      { site_id: obraA.id, amount_cents: 60000, purpose: "a" },
      { site_id: obraB.id, amount_cents: 39999, purpose: "b" },
    ]);
    expect(error?.hint).toBe("allocations");
    expect(error?.message).toContain("R$ 999,99");
  });

  it("rejeita parcela negativa, sem obra, sem finalidade e obra repetida", async () => {
    for (const bad of [
      [{ site_id: obraA.id, amount_cents: -100, purpose: "x" }],
      [{ site_id: "", amount_cents: 100000, purpose: "x" }],
      [{ site_id: obraA.id, amount_cents: 100000, purpose: " " }],
      [
        { site_id: obraA.id, amount_cents: 50000, purpose: "x" },
        { site_id: obraA.id, amount_cents: 50000, purpose: "y" },
      ],
      [],
    ]) {
      const { error } = await newExpense(foreman, bad);
      expect(error?.hint, JSON.stringify(bad)).toBe("allocations");
    }
  });

  it("o banco recusa rateio inconsistente mesmo pela chave de serviço", async () => {
    const svc = serviceClient();
    const { data: e } = await svc
      .from("expenses")
      .insert({
        expense_date: today(),
        description: "Inserção direta",
        total_cents: 100000,
        purchased_by: admin.id,
        created_by: admin.id,
        client_request_id: uid(),
      })
      .select()
      .single()
      .then((r) => r, () => ({ data: null }));
    // Sem parcelas a transação é recusada no commit (constraint adiada).
    expect(e).toBeNull();
  });

  it("clique duplo não duplica a despesa (T-A17)", async () => {
    const receipt = await fakePhoto(foreman, null, "receipts");
    const args = {
      p_client_request_id: uid(),
      p_expense_date: today(),
      p_description: "Cimento",
      p_supplier_name_free: "Fornecedor (fictício)",
      p_total_cents: 5000,
      p_allocations: [{ site_id: obraA.id, amount_cents: 5000, purpose: "Reboco" }],
      p_receipt_ids: [receipt.id],
    };
    const [a, b] = await Promise.all([foreman.db.rpc("expense_save", args), foreman.db.rpc("expense_save", args)]);
    expect(a.data!.id).toBe(b.data!.id);
  });

  it("exige comprovante ao enviar para conferência", async () => {
    const { error } = await foreman.db.rpc("expense_save", {
      p_client_request_id: uid(),
      p_expense_date: today(),
      p_description: "Sem nota",
      p_supplier_name_free: "X",
      p_total_cents: 1000,
      p_allocations: [{ site_id: obraA.id, amount_cents: 1000, purpose: "x" }],
    });
    expect(error?.hint).toBe("receipts");
  });

  it("encarregado só rateia para obras autorizadas", async () => {
    const { site: foreign } = await createClientWithSite("Alheia");
    const { error } = await newExpense(foreman, [{ site_id: foreign.id, amount_cents: 100000, purpose: "x" }]);
    expect(error?.message).toContain("sem acesso");
  });
});

describe("T-A8 — alteração após aprovação e reembolso independente", () => {
  it("editar valor aprovado volta para conferência e guarda histórico; reembolso segue à parte", async () => {
    const { data: created } = await newExpense(foreman, split(), { p_paid_by_kind: "colaborador" });
    const { data: reimb } = await admin.db.from("reimbursements").select("status,amount_due_cents,payee_profile_id").eq("expense_id", created!.id).single();
    expect(reimb).toEqual({ status: "pendente", amount_due_cents: 100000, payee_profile_id: foreman.id });

    const approved = await admin.db.rpc("expense_approve", { p_expense_id: created!.id });
    expect(approved.data!.review_status).toBe("aprovado");

    const paid = await admin.db.rpc("reimbursement_register_payment", { p_expense_id: created!.id, p_amount_cents: 30000 });
    expect(paid.data!.status).toBe("parcial");

    const edited = await foreman.db.rpc("expense_save", {
      p_expense_id: created!.id,
      p_client_request_id: uid(),
      p_expense_date: today(),
      p_description: "Material hidráulico",
      p_supplier_name_free: "Casa de materiais (fictícia)",
      p_total_cents: 110000,
      p_allocations: [
        { site_id: obraA.id, amount_cents: 70000, purpose: "Cozinha do salão" },
        { site_id: obraB.id, amount_cents: 40000, purpose: "Cobertura" },
      ],
      p_paid_by_kind: "colaborador",
    });
    expect(edited.error).toBeNull();
    expect(edited.data!.review_status).toBe("enviado_para_conferencia");

    const { data: reviews } = await admin.db.from("expense_reviews").select("action,snapshot").eq("expense_id", created!.id).order("id");
    expect(reviews!.map((r) => r.action)).toEqual(["enviada", "aprovada", "invalidada", "reenviada"]);
    expect((reviews![2]!.snapshot as { total_cents: number }).total_cents).toBe(100000);

    const { data: reimbAfter } = await admin.db.from("reimbursements").select("status,amount_due_cents,amount_paid_cents").eq("expense_id", created!.id).single();
    expect(reimbAfter).toEqual({ status: "parcial", amount_due_cents: 110000, amount_paid_cents: 30000 });

    const over = await admin.db.rpc("reimbursement_register_payment", { p_expense_id: created!.id, p_amount_cents: 90000 });
    expect(over.error?.hint).toBe("amountCents");
    const rest = await admin.db.rpc("reimbursement_register_payment", { p_expense_id: created!.id, p_amount_cents: 80000 });
    expect(rest.data!.status).toBe("quitado");
  });

  it("devolução exige justificativa", async () => {
    const { data } = await newExpense(foreman, split());
    expect((await admin.db.rpc("expense_return", { p_expense_id: data!.id, p_reason: "" })).error?.hint).toBe("reason");
    const back = await admin.db.rpc("expense_return", { p_expense_id: data!.id, p_reason: "Nota ilegível" });
    expect(back.data!.review_status).toBe("devolvido_para_correcao");
  });
});

describe("acesso financeiro interno", () => {
  it("funcionário não lança nem vê compras; encarregado não vê compras de outro", async () => {
    const { data } = await newExpense(foreman, split());
    const workerTry = await newExpense(worker, split()).catch((e) => ({ error: e }));
    expect(workerTry.error).toBeTruthy();
    expect((await worker.db.from("expenses").select("id")).data).toEqual([]);
    expect((await otherForeman.db.from("expenses").select("id").eq("id", data!.id)).data).toEqual([]);
    expect((await otherForeman.db.from("expense_allocations").select("id").eq("expense_id", data!.id)).data).toEqual([]);
  });
});

describe("B-09 — pagamento de reembolso lançado uma vez, em linha própria", () => {
  async function reimbursable() {
    const { data, error } = await newExpense(foreman, split(), { p_paid_by_kind: "colaborador" });
    if (error) throw error;
    const { data: reimb } = await admin.db.from("reimbursements").select("id").eq("expense_id", data!.id).single();
    return { expenseId: data!.id as string, reimbursementId: reimb!.id as string };
  }
  const pay = (expenseId: string, cents: number, key: string) =>
    admin.db.rpc("reimbursement_register_payment", { p_expense_id: expenseId, p_amount_cents: cents, p_client_request_id: key });

  it("pagamento repetido com a mesma chave não duplica, nem em sequência nem ao mesmo tempo", async () => {
    const { expenseId, reimbursementId } = await reimbursable();
    const key = uid();
    expect((await pay(expenseId, 25000, key)).error).toBeNull();
    const again = await pay(expenseId, 25000, key);
    expect(again.error).toBeNull();
    expect(again.data!.amount_paid_cents).toBe(25000);

    const twin = uid();
    const both = await Promise.all([pay(expenseId, 10000, twin), pay(expenseId, 10000, twin)]);
    for (const r of both) expect(r.error).toBeNull();

    const { data: reimb } = await admin.db.from("reimbursements").select("amount_paid_cents, status").eq("id", reimbursementId).single();
    expect(reimb).toEqual({ amount_paid_cents: 35000, status: "parcial" });
    const { data: rows } = await admin.db.from("reimbursement_payments").select("amount_cents").eq("reimbursement_id", reimbursementId).order("amount_cents");
    expect(rows!.map((r) => r.amount_cents)).toEqual([10000, 25000]);
  });

  it("o total pago de cada reembolso é a soma das linhas de pagamento", () => {
    const diverging = sql(
      "select count(*) from public.reimbursements r left join (select reimbursement_id, sum(amount_cents) as total from public.reimbursement_payments group by 1) s on s.reimbursement_id = r.id where coalesce(s.total, 0) <> r.amount_paid_cents",
    );
    expect(diverging).toBe("0");
  });

  it("pagamento registrado é imutável, nem pela chave de serviço", async () => {
    const { expenseId, reimbursementId } = await reimbursable();
    expect((await pay(expenseId, 5000, uid())).error).toBeNull();
    const svc = serviceClient();
    const upd = await svc.from("reimbursement_payments").update({ amount_cents: 1 }).eq("reimbursement_id", reimbursementId);
    expect(upd.error).not.toBeNull();
    const del = await svc.from("reimbursement_payments").delete().eq("reimbursement_id", reimbursementId);
    expect(del.error).not.toBeNull();
    const { data: reimb } = await admin.db.from("reimbursements").select("amount_paid_cents").eq("id", reimbursementId).single();
    expect(reimb!.amount_paid_cents).toBe(5000);
  });

  it("a pessoa reembolsada vê os próprios pagamentos; outro encarregado não", async () => {
    const { expenseId, reimbursementId } = await reimbursable();
    expect((await pay(expenseId, 7000, uid())).error).toBeNull();
    const mine = await foreman.db.from("reimbursement_payments").select("amount_cents").eq("reimbursement_id", reimbursementId);
    expect(mine.data).toEqual([{ amount_cents: 7000 }]);
    const other = await otherForeman.db.from("reimbursement_payments").select("amount_cents").eq("reimbursement_id", reimbursementId);
    expect(other.data).toEqual([]);
  });

  it("a assinatura antiga da função não fica como sobrecarga", () => {
    expect(sql("select count(*) from pg_proc where proname = 'reimbursement_register_payment'")).toBe("1");
  });
});

describe("B-14 — compra só se liga a O.S. de obra do rateio, com acesso", () => {
  /** O.S. fictícia aberta direto no banco (o teste é da regra da compra, não da abertura). */
  async function requestAt(siteId: string) {
    const svc = serviceClient();
    const { data: site } = await svc.from("sites").select("client_id").eq("id", siteId).single();
    const { data, error } = await svc
      .from("service_requests")
      .insert({
        number: `2026-7${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 100)}`,
        client_id: site!.client_id,
        site_id: siteId,
        origin: "cliente_externo",
        requester_name: "Fictício",
        title: "Chamado B-14 (teste)",
        description: "x",
        status: "aberta",
        client_request_id: uid(),
        created_by: admin.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }
  const onlyA = () => [{ site_id: obraA.id, amount_cents: 100000, purpose: "Cozinha do salão" }];

  it("encarregado não liga compra a O.S. de local sem acesso", async () => {
    const obraC = (await createClientWithSite("CompraC")).site;
    const reqC = await requestAt(obraC.id);
    const { error } = await newExpense(foreman, split(), { p_service_request_id: reqC });
    expect(error?.code).toBe("P0002");
    expect(error?.hint).toBe("serviceRequestId");
  });

  it("O.S. de obra fora do rateio é recusada, também para a administração", async () => {
    const reqB = await requestAt(obraB.id);
    for (const user of [foreman, admin]) {
      const { error } = await newExpense(user, onlyA(), { p_service_request_id: reqB });
      expect(error?.hint, user.name).toBe("serviceRequestId");
      expect(error?.message).toContain("rateio");
    }
  });

  it("O.S. de obra do rateio é aceita", async () => {
    const reqA = await requestAt(obraA.id);
    const { data, error } = await newExpense(foreman, split(), { p_service_request_id: reqA });
    expect(error).toBeNull();
    expect(data!.service_request_id).toBe(reqA);
  });
});
