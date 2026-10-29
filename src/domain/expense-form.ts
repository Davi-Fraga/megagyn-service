import { UUID_RE } from "./ids";
import { parseBRL, validateAllocations, type AllocationErrorCode, type AllocationInput } from "./money";

/** Linha do editor de rateio como digitada (valor em texto "600,00"). */
export type AllocationDraft = { siteId: string; amount: string; purpose: string };

/** Erros de valor que bloqueiam o botão de envio; obra/finalidade vazias ficam com o `required` e o servidor. */
const BLOCKING: ReadonlySet<AllocationErrorCode> = new Set(["total_invalido", "valor_invalido", "obra_duplicada", "soma_diferente", "sem_parcelas"]);

export type AllocationCheck = {
  totalCents: number | null;
  allocatedCents: number;
  /** total − rateado (positivo = falta ratear). */
  differenceCents: number;
  /** Mensagem que impede o envio (null = pode enviar). */
  blocking: string | null;
};

/** Conferência ao vivo do rateio (mesma regra de validateAllocations, que o banco repete). */
export function allocationCheck(totalInput: string, rows: readonly AllocationDraft[]): AllocationCheck {
  const totalCents = parseBRL(totalInput);
  const inputs: AllocationInput[] = rows.map((r) => ({ siteId: r.siteId, amountCents: parseBRL(r.amount) ?? 0, purpose: r.purpose }));
  const result = validateAllocations(totalCents ?? 0, inputs);
  const first = result.errors.find((e) => BLOCKING.has(e.code));
  return {
    totalCents: totalCents && totalCents > 0 ? totalCents : null,
    allocatedCents: result.allocatedCents,
    differenceCents: result.differenceCents,
    blocking: first?.message ?? null,
  };
}

/** Parcelas enviadas pelo formulário (campos repetidos alloc_site_id / alloc_amount / alloc_purpose). */
export function fdAllocations(fd: FormData): AllocationInput[] {
  const sites = fd.getAll("alloc_site_id").map(String);
  const amounts = fd.getAll("alloc_amount").map(String);
  const purposes = fd.getAll("alloc_purpose").map(String);
  const n = Math.max(sites.length, amounts.length, purposes.length);
  const out: AllocationInput[] = [];
  for (let i = 0; i < n; i++) {
    const site = (sites[i] ?? "").trim();
    out.push({
      siteId: UUID_RE.test(site) ? site : "",
      amountCents: parseBRL(amounts[i] ?? "") ?? 0,
      purpose: (purposes[i] ?? "").trim(),
    });
  }
  return out;
}
