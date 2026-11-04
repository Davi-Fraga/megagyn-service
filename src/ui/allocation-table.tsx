"use client";

import { CircleAlert, CircleCheck, Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import type { AllocationCheck, AllocationDraft } from "@/domain/expense-form";
import { formatBRL, formatCentsPlain, parseBRL } from "@/domain/money";
import { Button } from "./button";
import { cn } from "./cn";
import { useFieldError } from "./form";

export type SiteGroup = { clientName: string; sites: Array<{ id: string; name: string }> };

/** "600" → "600,00" ao sair do campo (o valor continua em centavos inteiros no servidor). */
export function normalizeMoneyInput(value: string): string {
  const cents = parseBRL(value);
  return cents === null ? value : formatCentsPlain(cents);
}

/**
 * Editor do rateio de uma compra entre obras (AllocationTable). Mostra ao vivo
 * "Rateado R$ X de R$ Y — diferença R$ Z"; o formulário bloqueia o envio enquanto houver diferença.
 * Campos enviados: alloc_site_id / alloc_amount / alloc_purpose (repetidos, na ordem das linhas).
 */
export function AllocationEditor({
  rows,
  onChange,
  siteGroups,
  check,
}: {
  rows: AllocationDraft[];
  onChange: (rows: AllocationDraft[]) => void;
  siteGroups: SiteGroup[];
  check: AllocationCheck;
}) {
  const baseId = useId();
  const serverError = useFieldError("allocations");
  const update = (i: number, patch: Partial<AllocationDraft>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i));
  const add = () => onChange([...rows, { siteId: "", amount: "", purpose: "" }]);
  const fillLast = () => {
    const i = rows.length - 1;
    const current = parseBRL(rows[i]!.amount) ?? 0;
    update(i, { amount: formatCentsPlain(current + check.differenceCents) });
  };

  const ok = check.totalCents !== null && check.blocking === null;
  const canFill = check.totalCents !== null && check.differenceCents > 0 && rows.length > 0;

  return (
    <fieldset className="space-y-3" aria-describedby={`${baseId}-sum`}>
      <legend className="text-[0.95rem] font-semibold">
        Para quais obras? <span className="text-erro">*</span>
      </legend>
      <p className="text-sm text-muted">Uma compra pode ser dividida entre obras. A soma das parcelas tem que dar o valor total.</p>

      <ol className="space-y-3">
        {rows.map((row, i) => {
          const usedElsewhere = new Set(rows.filter((_, j) => j !== i).map((r) => r.siteId));
          const n = i + 1;
          return (
            <li key={i} className="rounded-ctl border border-linha bg-concreto p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-muted">Parcela {n}</span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={rows.length === 1}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-ctl text-erro hover:bg-erro-claro disabled:opacity-40"
                  aria-label={`Remover parcela ${n}`}
                >
                  <Trash2 aria-hidden className="size-5" />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
                <div className="space-y-1">
                  <label htmlFor={`${baseId}-site-${i}`} className="block text-sm font-semibold">
                    Obra<span className="sr-only"> da parcela {n}</span>
                  </label>
                  <select
                    id={`${baseId}-site-${i}`}
                    name="alloc_site_id"
                    required
                    value={row.siteId}
                    onChange={(e) => update(i, { siteId: e.target.value })}
                    className="campo-input"
                  >
                    <option value="">Escolha a obra…</option>
                    {siteGroups.map((g) => (
                      <optgroup key={g.clientName} label={g.clientName}>
                        {g.sites.map((s) => (
                          <option key={s.id} value={s.id} disabled={usedElsewhere.has(s.id)}>
                            {s.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor={`${baseId}-amount-${i}`} className="block text-sm font-semibold">
                    Valor<span className="sr-only"> da parcela {n}</span> (R$)
                  </label>
                  <input
                    id={`${baseId}-amount-${i}`}
                    name="alloc_amount"
                    required
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0,00"
                    value={row.amount}
                    onChange={(e) => update(i, { amount: e.target.value })}
                    onBlur={(e) => update(i, { amount: normalizeMoneyInput(e.target.value) })}
                    className="campo-input text-right tabular-nums"
                  />
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <label htmlFor={`${baseId}-purpose-${i}`} className="block text-sm font-semibold">
                  Finalidade<span className="sr-only"> da parcela {n}</span>
                </label>
                <input
                  id={`${baseId}-purpose-${i}`}
                  name="alloc_purpose"
                  required
                  maxLength={200}
                  placeholder="Ex.: Reparo da cozinha do salão"
                  value={row.purpose}
                  onChange={(e) => update(i, { purpose: e.target.value })}
                  className="campo-input"
                />
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={add} icon={<Plus aria-hidden className="size-4" />}>
          Adicionar obra
        </Button>
        {canFill && (
          <Button variant="ghost" onClick={fillLast}>
            Lançar a diferença na parcela {rows.length}
          </Button>
        )}
      </div>

      <div
        id={`${baseId}-sum`}
        aria-live="polite"
        className={cn(
          "flex items-start gap-2 rounded-ctl border px-3 py-2 text-[0.95rem] font-semibold",
          ok ? "border-ok bg-ok-claro text-ok" : "border-erro bg-erro-claro text-erro",
        )}
      >
        {ok ? <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0" /> : <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />}
        <span>
          {check.totalCents === null
            ? `Rateado ${formatBRL(check.allocatedCents)} — informe o valor total da compra`
            : `Rateado ${formatBRL(check.allocatedCents)} de ${formatBRL(check.totalCents)} — diferença ${formatBRL(Math.abs(check.differenceCents))}`}
          {check.blocking && check.totalCents !== null && <span className="block font-medium">{check.blocking}</span>}
        </span>
      </div>
      {serverError && <p className="text-sm font-medium text-erro">{serverError}</p>}
    </fieldset>
  );
}

export type AllocationLine = { siteName: string; clientName?: string; amountCents: number; purpose: string };

/** Rateio somente leitura com a soma conferida contra o total da compra. */
export function AllocationSummaryTable({
  allocations,
  totalCents,
  highlightSite,
}: {
  allocations: AllocationLine[];
  totalCents: number;
  highlightSite?: string | null;
}) {
  const sum = allocations.reduce((n, a) => n + a.amountCents, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[22rem] text-left text-[0.95rem]">
        <thead className="border-b border-linha text-sm text-muted">
          <tr>
            <th className="py-2 pr-3 font-semibold">Obra</th>
            <th className="py-2 pr-3 font-semibold">Finalidade</th>
            <th className="py-2 text-right font-semibold">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-linha">
          {allocations.map((a, i) => (
            <tr key={i} className={cn(highlightSite && a.siteName === highlightSite && "bg-acento-claro")}>
              <td className="py-2 pr-3 align-top">
                <span className="font-semibold">{a.siteName}</span>
                {a.clientName && <span className="block text-sm text-muted">{a.clientName}</span>}
              </td>
              <td className="py-2 pr-3 align-top">{a.purpose}</td>
              <td className="py-2 text-right align-top tabular-nums">{formatBRL(a.amountCents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-grafite">
          <tr>
            <td colSpan={2} className="py-2 pr-3 font-bold">
              Soma das parcelas
            </td>
            <td className="py-2 text-right font-bold tabular-nums">{formatBRL(sum)}</td>
          </tr>
          <tr>
            <td colSpan={3} className={cn("pb-1 text-sm font-medium", sum === totalCents ? "text-ok" : "text-erro")}>
              {sum === totalCents
                ? `Confere com o total da compra (${formatBRL(totalCents)}).`
                : `Diferente do total da compra (${formatBRL(totalCents)}).`}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
