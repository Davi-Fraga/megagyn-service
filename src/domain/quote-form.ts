/**
 * Itens do orçamento como digitados no editor (texto pt-BR) → linhas prontas para
 * quote_items. O cálculo usa computeQuote, o mesmo do total ao vivo na tela; o banco
 * confere de novo (CHECK subtotal = round(quantidade × preço) e trigger do total).
 */
import { centsToWords } from "./amount-in-words";
import { formatCentsPlain, lineSubtotalCents, parseBRL, parseQuantityMilli } from "./money";
import { computeQuote, type QuoteItemInput } from "./quote";

export type PricingMode = "global" | "detalhado";

export type QuoteItemDraft = {
  locationLabel: string;
  title: string;
  pricingMode: PricingMode;
  /** Subitens/etapas, um por linha. */
  linesText: string;
  notes: string;
  /** Valor global do item (modo global). */
  value: string;
  /** Modo detalhado. */
  quantity: string;
  unit: string;
  unitPrice: string;
};

export type QuoteItemRow = {
  location_label: string;
  title: string | null;
  pricing_mode: PricingMode;
  quantity: number | null;
  unit: string | null;
  unit_price_cents: number | null;
  subtotal_cents: number;
  lines: string[];
  notes: string | null;
  sort_order: number;
};

export type QuoteItemsResult = {
  ok: boolean;
  rows: QuoteItemRow[];
  /** Subtotal por item do editor (null = incompleto/inválido ou linha em branco). */
  subtotals: Array<number | null>;
  totalCents: number;
  totalInWords: string;
  /** Chaves "items.<posição no editor>.<campo>". */
  fieldErrors: Record<string, string>;
};

export const MAX_QUOTE_ITEMS = 200;
/** numeric(12,3) no banco: até 999.999.999,999. */
const MAX_QUANTITY_MILLI = 999_999_999_999;

export function blankItemDraft(pricingMode: PricingMode = "global"): QuoteItemDraft {
  return { locationLabel: "", title: "", pricingMode, linesText: "", notes: "", value: "", quantity: "", unit: "", unitPrice: "" };
}

export function linesFromText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*–]\s*/, "").trim())
    .filter(Boolean);
}

/** 1500 → "1,5"; 667000 → "667"; 1234567 → "1.234,567". */
export function formatQuantityBR(milli: number): string {
  const integer = Math.floor(milli / 1000)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = (milli % 1000).toString().padStart(3, "0").replace(/0+$/, "");
  return fraction ? `${integer},${fraction}` : integer;
}

function isBlank(d: QuoteItemDraft): boolean {
  return [d.locationLabel, d.title, d.linesText, d.notes, d.value, d.quantity, d.unit, d.unitPrice].every((v) => !v.trim());
}

const blankToNull = (s: string) => (s.trim() ? s.trim() : null);

export function validateQuoteItems(drafts: QuoteItemDraft[]): QuoteItemsResult {
  const fieldErrors: Record<string, string> = {};
  const subtotals: Array<number | null> = drafts.map(() => null);
  const kept: Array<{ index: number; draft: QuoteItemDraft; input: QuoteItemInput; quantityMilli: number | null; unitPriceCents: number | null }> = [];

  drafts.forEach((d, index) => {
    if (isBlank(d)) return;
    const err = (field: keyof QuoteItemDraft, message: string) => {
      fieldErrors[`items.${index}.${field}`] ??= message;
    };
    if (!d.locationLabel.trim()) err("locationLabel", "Informe o local (ex.: Cobertura).");

    if (d.pricingMode === "global") {
      const cents = parseBRL(d.value);
      if (cents === null || cents <= 0) err("value", "Informe o valor (ex.: 7.600,00).");
      kept.push({ index, draft: d, input: { pricingMode: "global", subtotalCents: cents }, quantityMilli: null, unitPriceCents: null });
    } else if (d.pricingMode === "detalhado") {
      const milli = parseQuantityMilli(d.quantity);
      const price = parseBRL(d.unitPrice);
      if (milli === null || milli <= 0) err("quantity", "Informe a quantidade (ex.: 667 ou 1,5).");
      else if (milli > MAX_QUANTITY_MILLI) err("quantity", "Quantidade grande demais.");
      if (price === null || price <= 0) err("unitPrice", "Informe o preço unitário (ex.: 45,90).");
      const usable = milli !== null && milli > 0 && milli <= MAX_QUANTITY_MILLI && price !== null && price > 0;
      if (usable) {
        try {
          lineSubtotalCents(milli, price);
        } catch {
          err("unitPrice", "Valor grande demais.");
        }
      }
      const valid = usable && !fieldErrors[`items.${index}.unitPrice`];
      kept.push({
        index,
        draft: d,
        input: { pricingMode: "detalhado", quantityMilli: valid ? milli : null, unitPriceCents: valid ? price : null },
        quantityMilli: milli,
        unitPriceCents: price,
      });
    } else {
      err("pricingMode", "Escolha como o item é cobrado.");
    }
  });

  // computeQuote é a regra única de subtotal/total (half-up em centavos inteiros).
  const computed = computeQuote(kept.map((k) => k.input));
  for (const e of computed.errors) {
    const k = kept[e.index]!;
    const field = k.draft.pricingMode === "global" ? "value" : "quantity";
    if (!Object.keys(fieldErrors).some((key) => key.startsWith(`items.${k.index}.`))) fieldErrors[`items.${k.index}.${field}`] = e.message;
  }

  const rows: QuoteItemRow[] = [];
  kept.forEach((k, i) => {
    const hasError = Object.keys(fieldErrors).some((key) => key.startsWith(`items.${k.index}.`));
    const subtotal = computed.items[i]!.subtotalCents;
    if (!hasError && subtotal > 0) subtotals[k.index] = subtotal;
    const d = k.draft;
    rows.push({
      location_label: d.locationLabel.trim(),
      title: blankToNull(d.title),
      pricing_mode: d.pricingMode,
      quantity: d.pricingMode === "detalhado" && k.quantityMilli !== null ? k.quantityMilli / 1000 : null,
      unit: d.pricingMode === "detalhado" ? blankToNull(d.unit) : null,
      unit_price_cents: d.pricingMode === "detalhado" ? k.unitPriceCents : null,
      subtotal_cents: subtotal,
      lines: linesFromText(d.linesText),
      notes: blankToNull(d.notes),
      sort_order: i,
    });
  });

  const totalCents = subtotals.reduce<number>((n, s) => n + (s ?? 0), 0);
  if (!Number.isSafeInteger(totalCents)) fieldErrors.items = "O total passa do limite permitido.";
  const ok = Object.keys(fieldErrors).length === 0;
  return {
    ok,
    rows,
    subtotals,
    totalCents: Number.isSafeInteger(totalCents) ? totalCents : 0,
    totalInWords: centsToWords(Number.isSafeInteger(totalCents) ? totalCents : 0),
    fieldErrors,
  };
}

/** Lê os campos "items.N.<campo>" enviados pelo editor (N de 0 a items_count − 1). */
export function readItemDrafts(fd: FormData): QuoteItemDraft[] {
  const count = Number(fd.get("items_count"));
  if (!Number.isInteger(count) || count <= 0) return [];
  const drafts: QuoteItemDraft[] = [];
  for (let i = 0; i < Math.min(count, MAX_QUOTE_ITEMS); i++) {
    const read = (field: keyof QuoteItemDraft) => {
      const v = fd.get(`items.${i}.${field}`);
      return typeof v === "string" ? v : "";
    };
    drafts.push({
      locationLabel: read("locationLabel"),
      title: read("title"),
      pricingMode: read("pricingMode") as PricingMode,
      linesText: read("linesText"),
      notes: read("notes"),
      value: read("value"),
      quantity: read("quantity"),
      unit: read("unit"),
      unitPrice: read("unitPrice"),
    });
  }
  return drafts;
}

export type StoredQuoteItem = {
  location_label: string;
  title: string | null;
  pricing_mode: string;
  quantity: number | null;
  unit: string | null;
  unit_price_cents: number | null;
  subtotal_cents: number;
  lines: string[];
  notes: string | null;
};

export function itemRowToDraft(row: StoredQuoteItem): QuoteItemDraft {
  const detailed = row.pricing_mode === "detalhado";
  return {
    locationLabel: row.location_label,
    title: row.title ?? "",
    pricingMode: detailed ? "detalhado" : "global",
    linesText: row.lines.join("\n"),
    notes: row.notes ?? "",
    value: detailed ? "" : formatCentsPlain(row.subtotal_cents),
    quantity: detailed && row.quantity !== null ? formatQuantityBR(Math.round(Number(row.quantity) * 1000)) : "",
    unit: row.unit ?? "",
    unitPrice: detailed && row.unit_price_cents !== null ? formatCentsPlain(row.unit_price_cents) : "",
  };
}
