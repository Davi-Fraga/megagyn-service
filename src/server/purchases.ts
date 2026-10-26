import type { ServerDb } from "./data";
import { fetchAll } from "./paginate";

/**
 * Resumo de "Minhas compras" (CMP-09). Independe da lista da tela, que mostra só as mais
 * recentes: o valor a receber soma todos os reembolsos em aberto em nome da pessoa.
 */
export async function loadMyPurchaseSummary(db: ServerDb, profileId: string) {
  const [open, returned] = await Promise.all([
    fetchAll((a, b) =>
      db
        .from("reimbursements")
        .select("id, amount_due_cents, amount_paid_cents")
        .eq("payee_profile_id", profileId)
        .neq("status", "quitado")
        .order("id")
        .range(a, b),
    ),
    db
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .or(`created_by.eq.${profileId},purchased_by.eq.${profileId}`)
      .eq("review_status", "devolvido_para_correcao"),
  ]);
  if (returned.error) throw new Error(`Falha na consulta: ${returned.error.message}`);
  return {
    toReceiveCents: open.reduce((n, r) => n + (r.amount_due_cents - r.amount_paid_cents), 0),
    returnedCount: returned.count ?? 0,
  };
}
