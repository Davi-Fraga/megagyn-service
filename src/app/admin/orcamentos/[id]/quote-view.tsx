import { centsToWords } from "@/domain/amount-in-words";
import { formatDateBR } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import { formatQuantityBR, linesFromText } from "@/domain/quote-form";
import { validityText } from "@/domain/quote-rules";
import type { QuoteBundle } from "@/app/admin/orcamentos/data";
import { DescriptionList, Panel } from "@/ui/page";

/** Leitura do orçamento fora de rascunho (o conteúdo é o da última versão congelada). */
export function QuoteView({ bundle }: { bundle: QuoteBundle }) {
  const q = bundle.quote;
  const total = bundle.items.reduce((n, i) => n + i.subtotal_cents, 0);
  const texts: Array<[string, string | null]> = [
    ["Texto de abertura", q.intro_text],
    ["Observações", q.observations],
    ["Notas técnicas", q.technical_notes],
    ["Declaração", q.declaration_text],
  ];
  return (
    <>
      <Panel title="Proposta">
        <DescriptionList
          items={[
            { label: "Cliente", value: q.client?.display_name },
            { label: "Contato (Att.)", value: q.contact ? [q.contact.name, q.contact.email].filter(Boolean).join(" – ") : "—" },
            { label: "Obra ou unidade", value: q.site ? `${q.site.name} (${q.site.code})` : "—" },
            { label: "Endereço ou local", value: q.service_location_text || q.site?.address_text || "—" },
            { label: "Emissão", value: formatDateBR(q.issued_at) },
            { label: "Validade", value: validityText(q.issued_at, q.valid_until) },
            { label: "Prazo de execução", value: q.execution_deadline_text || "—" },
            { label: "Garantia", value: q.warranty_text || "—" },
            { label: "Forma de pagamento", value: q.payment_terms || "—" },
          ]}
        />
        {q.inclusions_text && (
          <ul className="mt-4 list-disc space-y-1 pl-5">
            {linesFromText(q.inclusions_text).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Itens">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-[0.95rem]">
            <thead className="border-b border-linha text-sm text-muted">
              <tr>
                <th className="py-2 pr-3 font-semibold">Local</th>
                <th className="py-2 pr-3 font-semibold">Descrição</th>
                <th className="py-2 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {bundle.items.map((i) => (
                <tr key={i.id} className="align-top">
                  <td className="py-2.5 pr-3 font-semibold">{i.location_label}</td>
                  <td className="py-2.5 pr-3">
                    {i.title && <p className="font-semibold">{i.title}</p>}
                    {i.lines.length > 0 && (
                      <ul className="list-disc pl-5">
                        {i.lines.map((l, k) => (
                          <li key={k}>{l}</li>
                        ))}
                      </ul>
                    )}
                    {i.pricing_mode === "detalhado" && i.quantity !== null && i.unit_price_cents !== null && (
                      <p className="text-sm text-muted">
                        {formatQuantityBR(Math.round(Number(i.quantity) * 1000))}
                        {i.unit ? ` ${i.unit}` : ""} × {formatBRL(i.unit_price_cents)}
                      </p>
                    )}
                    {i.notes && <p className="text-sm">Obs: {i.notes}</p>}
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right tabular-nums">{formatBRL(i.subtotal_cents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-[1.5px] border-grafite">
              <tr>
                <td colSpan={2} className="py-2.5 font-bold">
                  Total
                </td>
                <td className="whitespace-nowrap py-2.5 text-right text-lg font-bold tabular-nums">{formatBRL(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-right text-sm text-muted">{centsToWords(total)}</p>
      </Panel>

      {texts.some(([, v]) => v) && (
        <details className="rounded-panel border border-linha bg-papel">
          <summary className="cursor-pointer px-4 py-3 text-lg font-bold">Textos da proposta</summary>
          <div className="space-y-3 border-t border-linha p-4">
            {texts
              .filter(([, v]) => v)
              .map(([label, v]) => (
                <div key={label}>
                  <p className="text-sm text-muted">{label}</p>
                  <p className="whitespace-pre-line">{v}</p>
                </div>
              ))}
          </div>
        </details>
      )}
    </>
  );
}
