"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type ComponentProps } from "react";
import { newId } from "@/domain/ids";
import { formatBRL } from "@/domain/money";
import { blankItemDraft, MAX_QUOTE_ITEMS, validateQuoteItems, type PricingMode, type QuoteItemDraft } from "@/domain/quote-form";
import { Button } from "./button";
import { cn } from "./cn";
import { FieldShell, useFieldError } from "./form";

type Row = QuoteItemDraft & { key: string };

type Labelled = { label: string; name: string; required?: boolean; hint?: string };

/** Campo do item: rótulo com * (obrigatório) sem `required` nativo — uma linha deixada em branco é ignorada. */
function ItemInput({ label, name, required, hint, ...rest }: Labelled & Omit<ComponentProps<"input">, "name" | "required">) {
  return (
    <FieldShell label={label} name={name} required={required} hint={hint}>
      {(a11y) => <input name={name} className="campo-input" {...a11y} {...rest} />}
    </FieldShell>
  );
}

function ItemTextArea({ label, name, required, hint, ...rest }: Labelled & Omit<ComponentProps<"textarea">, "name" | "required">) {
  return (
    <FieldShell label={label} name={name} required={required} hint={hint}>
      {(a11y) => <textarea name={name} rows={3} className="campo-input" {...a11y} {...rest} />}
    </FieldShell>
  );
}

/**
 * Editor dos itens do orçamento: local, descrição (subitens), modo global ou detalhado,
 * subtotal/total e valor por extenso ao vivo — o mesmo cálculo (computeQuote) do servidor.
 * Envia campos "items.N.<campo>" + "items_count".
 */
export function QuoteItemsEditor({ initial }: { initial: QuoteItemDraft[] }) {
  const [rows, setRows] = useState<Row[]>(() => (initial.length ? initial : [blankItemDraft()]).map((d) => ({ ...d, key: newId() })));
  const calc = useMemo(() => validateQuoteItems(rows), [rows]);
  const listError = useFieldError("items");

  const update = (key: string, patch: Partial<QuoteItemDraft>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (index: number, delta: number) =>
    setRows((prev) => {
      const next = [...prev];
      const [row] = next.splice(index, 1);
      next.splice(index + delta, 0, row!);
      return next;
    });

  return (
    <div className="space-y-4">
      <input type="hidden" name="items_count" value={rows.length} />
      {rows.map((row, i) => {
        const field = (f: keyof QuoteItemDraft) => `items.${i}.${f}`;
        const bind = (f: keyof QuoteItemDraft) => ({
          name: field(f),
          value: row[f],
          onChange: (e: { target: { value: string } }) => update(row.key, { [f]: e.target.value }),
        });
        const subtotal = calc.subtotals[i] ?? null;
        return (
          <fieldset key={row.key} className="space-y-4 rounded-panel border border-linha bg-concreto/40 p-4">
            <legend className="sr-only">Item {i + 1}</legend>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p aria-hidden className="tipo-placa text-laranja-escuro">
                Item {i + 1}
              </p>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Subir item ${i + 1}`}>
                  <ArrowUp aria-hidden className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`Descer item ${i + 1}`}>
                  <ArrowDown aria-hidden className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                  aria-label={`Remover item ${i + 1}`}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <ItemInput label="Local" required placeholder="Ex.: Cobertura" maxLength={120} {...bind("locationLabel")} />
              <ItemInput label="Título do item" placeholder="Ex.: Impermeabilização" maxLength={200} {...bind("title")} />
            </div>

            <ItemTextArea label="Subitens / etapas" hint="Um por linha. Aparecem como tópicos na proposta." {...bind("linesText")} />

            <fieldset className="space-y-2">
              <legend className="text-[0.95rem] font-semibold">Como cobrar</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    { value: "global", label: "Valor global do local" },
                    { value: "detalhado", label: "Quantidade × preço unitário" },
                  ] as Array<{ value: PricingMode; label: string }>
                ).map((o) => (
                  <label key={o.value} className="flex min-h-11 items-center gap-3 rounded-ctl border border-linha bg-papel px-3">
                    <input
                      type="radio"
                      name={field("pricingMode")}
                      value={o.value}
                      checked={row.pricingMode === o.value}
                      onChange={() => update(row.key, { pricingMode: o.value })}
                      className="size-5 accent-laranja"
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {row.pricingMode === "global" ? (
              <ItemInput label="Valor (R$)" required inputMode="decimal" placeholder="7.600,00" autoComplete="off" {...bind("value")} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <ItemInput label="Quantidade" required inputMode="decimal" placeholder="667 ou 1,5" autoComplete="off" {...bind("quantity")} />
                <ItemInput label="Unidade" placeholder="m², m, un, vb" maxLength={20} {...bind("unit")} />
                <ItemInput label="Preço unitário (R$)" required inputMode="decimal" placeholder="45,90" autoComplete="off" {...bind("unitPrice")} />
              </div>
            )}

            <ItemInput label="Observação do item" placeholder="Ex.: Garantia de 01 ano" maxLength={300} {...bind("notes")} />

            <p className="text-right text-[0.95rem]">
              <span className="text-muted">Subtotal: </span>
              <b className={cn(subtotal === null && "text-muted")}>{subtotal === null ? "—" : formatBRL(subtotal)}</b>
            </p>
          </fieldset>
        );
      })}

      {rows.length < MAX_QUOTE_ITEMS && (
        <Button variant="secondary" icon={<Plus aria-hidden className="size-4" />} onClick={() => setRows((prev) => [...prev, { ...blankItemDraft(), key: newId() }])}>
          Adicionar item
        </Button>
      )}
      {listError && <p className="text-sm font-medium text-erro">{listError}</p>}

      <div className="rounded-panel border-[1.5px] border-grafite bg-papel p-4" aria-live="polite">
        <p className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold">Total da proposta</span>
          <span className="tipo-placa text-2xl" data-testid="quote-total">
            {formatBRL(calc.totalCents)}
          </span>
        </p>
        {calc.totalCents > 0 && (
          <p className="mt-1 text-sm text-muted" data-testid="quote-total-words">
            {calc.totalInWords}
          </p>
        )}
        <p className="mt-2 text-xs text-muted">Valor comercial: não entra em despesas, custos internos nem diárias faturáveis.</p>
      </div>
    </div>
  );
}
