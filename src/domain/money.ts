/**
 * Dinheiro sempre em centavos inteiros (nunca float).
 * Três categorias nunca se somam entre si: custo interno (despesas),
 * valor comercial (orçamentos) e valor faturável (diárias/horas).
 */

const BRL_INPUT = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;
const QTY_INPUT = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,3}))?$/;

function assertCents(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Valor monetário deve ser inteiro em centavos: ${value}`);
  }
}

/** "1.000,00" | "R$ 600" | "0,01" → centavos. Retorna null para entrada inválida ou negativa. */
export function parseBRL(input: string): number | null {
  const s = input.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!s) return null;
  const m = BRL_INPUT.exec(s);
  if (!m) return null;
  const integer = Number(m[1]!.replace(/\./g, ""));
  const fraction = Number((m[2] ?? "").padEnd(2, "0") || "0");
  const cents = integer * 100 + fraction;
  return Number.isSafeInteger(cents) ? cents : null;
}

/** 100000 → "1.000,00" (sem símbolo, para planilhas e campos). */
export function formatCentsPlain(cents: number): string {
  assertCents(cents);
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const integer = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = (abs % 100).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${integer},${fraction}`;
}

/** 799200 → "R$ 7.992,00" (espaço comum, saída determinística para PDF/CSV). */
export function formatBRL(cents: number): string {
  assertCents(cents);
  return cents < 0 ? `-R$ ${formatCentsPlain(-cents)}` : `R$ ${formatCentsPlain(cents)}`;
}

export function sumCents(values: readonly number[]): number {
  let total = 0;
  for (const v of values) {
    assertCents(v);
    total += v;
  }
  assertCents(total);
  return total;
}

export type AllocationInput = { siteId: string; amountCents: number; purpose: string };
export type AllocationErrorCode =
  | "total_invalido"
  | "sem_parcelas"
  | "obra_vazia"
  | "obra_duplicada"
  | "valor_invalido"
  | "finalidade_vazia"
  | "soma_diferente";
export type AllocationError = { code: AllocationErrorCode; message: string; index?: number };
export type AllocationResult = {
  ok: boolean;
  allocatedCents: number;
  /** total − soma das parcelas (positivo = falta ratear). */
  differenceCents: number;
  errors: AllocationError[];
};

/**
 * Regra do escopo (Word §7): soma das parcelas = total exato; sem negativos,
 * sem parcela sem obra; cada parcela com finalidade. Mesma regra é imposta no banco.
 */
export function validateAllocations(totalCents: number, allocations: readonly AllocationInput[]): AllocationResult {
  const errors: AllocationError[] = [];
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    errors.push({ code: "total_invalido", message: "Informe o valor total da compra (maior que zero)." });
  }
  if (allocations.length === 0) {
    errors.push({ code: "sem_parcelas", message: "Indique ao menos uma obra beneficiada." });
  }

  const seen = new Set<string>();
  let allocated = 0;
  allocations.forEach((a, index) => {
    if (!a.siteId) {
      errors.push({ code: "obra_vazia", message: `Parcela ${index + 1}: escolha a obra.`, index });
    } else if (seen.has(a.siteId)) {
      errors.push({ code: "obra_duplicada", message: `Parcela ${index + 1}: obra repetida; some os valores numa parcela só.`, index });
    } else {
      seen.add(a.siteId);
    }
    if (!Number.isSafeInteger(a.amountCents) || a.amountCents <= 0) {
      errors.push({ code: "valor_invalido", message: `Parcela ${index + 1}: valor deve ser maior que zero.`, index });
    } else {
      allocated += a.amountCents;
    }
    if (!a.purpose.trim()) {
      errors.push({ code: "finalidade_vazia", message: `Parcela ${index + 1}: informe a finalidade.`, index });
    }
  });

  const total = Number.isSafeInteger(totalCents) ? totalCents : 0;
  const difference = total - allocated;
  if (allocations.length > 0 && total > 0 && difference !== 0) {
    errors.push({
      code: "soma_diferente",
      message:
        difference > 0
          ? `Faltam ${formatBRL(difference)} para completar o total da compra.`
          : `As parcelas passam o total da compra em ${formatBRL(-difference)}.`,
    });
  }

  return { ok: errors.length === 0, allocatedCents: allocated, differenceCents: difference, errors };
}

/** Quantidade em milésimos: "667" → 667000, "1,5" → 1500. Null se inválida, negativa ou com > 3 casas. */
export function parseQuantityMilli(input: string): number | null {
  const s = input.replace(/\s/g, "");
  const m = QTY_INPUT.exec(s);
  if (!m) return null;
  const integer = Number(m[1]!.replace(/\./g, ""));
  const fraction = Number((m[2] ?? "").padEnd(3, "0") || "0");
  const milli = integer * 1000 + fraction;
  return Number.isSafeInteger(milli) ? milli : null;
}

/** Subtotal = quantidade × preço unitário, arredondado half-up para centavos (aritmética inteira). */
export function lineSubtotalCents(quantityMilli: number, unitPriceCents: number): number {
  assertCents(quantityMilli);
  assertCents(unitPriceCents);
  if (quantityMilli < 0 || unitPriceCents < 0) throw new Error("Quantidade e preço não podem ser negativos.");
  const result = (BigInt(quantityMilli) * BigInt(unitPriceCents) + 500n) / 1000n;
  const n = Number(result);
  assertCents(n);
  return n;
}

/** Unidades em centésimos (ex.: 1 diária = 100, meia diária = 50) × preço → centavos, half-up. */
export function unitsTimesPriceCents(unitsCenti: number, unitPriceCents: number): number {
  assertCents(unitsCenti);
  assertCents(unitPriceCents);
  if (unitsCenti < 0 || unitPriceCents < 0) throw new Error("Valores não podem ser negativos.");
  const n = Number((BigInt(unitsCenti) * BigInt(unitPriceCents) + 50n) / 100n);
  assertCents(n);
  return n;
}
