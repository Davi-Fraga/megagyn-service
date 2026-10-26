"use client";

import { useMemo, useRef, useState } from "react";
import { allocationCheck, type AllocationDraft } from "@/domain/expense-form";
import { formatBRL, formatCentsPlain } from "@/domain/money";
import { saveExpenseAction } from "@/server/actions/expenses";
import { AllocationEditor, normalizeMoneyInput, type SiteGroup } from "@/ui/allocation-table";
import { Button } from "@/ui/button";
import { ActionForm, FieldShell, SelectField, TextAreaField, TextField, type Option } from "@/ui/form";
import { MediaUploader } from "@/ui/media-uploader";

export type ExpenseFormInitial = {
  expenseId: string;
  wasStatus: "rascunho" | "enviado_para_conferencia" | "aprovado" | "devolvido_para_correcao";
  expenseDate: string;
  supplierId: string | null;
  supplierNameFree: string | null;
  categoryId: string | null;
  description: string;
  itemsNotes: string | null;
  totalCents: number;
  paymentMethodId: string | null;
  documentNumber: string | null;
  paidByKind: "empresa" | "colaborador";
  purchasedBy: string;
  paidByProfileId: string | null;
  serviceRequestId: string | null;
  allocations: Array<{ siteId: string; amountCents: number; purpose: string }>;
  receiptCount: number;
};

const LABELS: Record<ExpenseFormInitial["wasStatus"] | "nova", { submit: string; draft: string | null }> = {
  nova: { submit: "Enviar para conferência", draft: "Salvar rascunho" },
  rascunho: { submit: "Enviar para conferência", draft: "Salvar rascunho" },
  devolvido_para_correcao: { submit: "Reenviar para conferência", draft: "Salvar sem enviar" },
  enviado_para_conferencia: { submit: "Salvar alterações", draft: null },
  aprovado: { submit: "Salvar alterações", draft: null },
};

/** CMP-08 — Registrar (ou corrigir) compra com comprovante e rateio entre obras. */
export function ExpenseForm({
  initial,
  siteGroups,
  suppliers,
  categories,
  paymentMethods,
  requests,
  today,
}: {
  initial?: ExpenseFormInitial;
  siteGroups: SiteGroup[];
  suppliers: Option[];
  categories: Option[];
  paymentMethods: Option[];
  requests: Option[];
  today: string;
}) {
  const onlySite = siteGroups.length === 1 && siteGroups[0]!.sites.length === 1 ? siteGroups[0]!.sites[0]!.id : "";
  const [total, setTotal] = useState(initial ? formatCentsPlain(initial.totalCents) : "");
  const [rows, setRows] = useState<AllocationDraft[]>(
    initial?.allocations.length
      ? initial.allocations.map((a) => ({ siteId: a.siteId, amount: formatCentsPlain(a.amountCents), purpose: a.purpose }))
      : [{ siteId: onlySite, amount: "", purpose: "" }],
  );
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");
  const [paidBy, setPaidBy] = useState<"empresa" | "colaborador">(initial?.paidByKind ?? "empresa");
  const intentRef = useRef<HTMLInputElement>(null);

  const check = useMemo(() => allocationCheck(total, rows), [total, rows]);
  const blocked = check.blocking !== null;
  const labels = LABELS[initial?.wasStatus ?? "nova"];
  const needsReceipt = !initial || initial.receiptCount === 0;

  function saveDraft(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    const intent = intentRef.current;
    if (!form || !intent) return;
    // O ActionForm lê os campos de forma síncrona no evento de envio: depois volta ao padrão.
    intent.value = "draft";
    form.requestSubmit();
    intent.value = "submit";
  }

  return (
    <div>
      <ActionForm
        action={saveExpenseAction}
        submitLabel={labels.submit}
        pendingLabel="Enviando…"
        submitSize="lg"
        stickySubmit
        submitDisabled={blocked}
        disabledReason={check.totalCents === null ? "Informe o valor total para enviar." : `Para enviar, acerte o rateio: ${check.blocking}`}
        extraActions={
          labels.draft ? (
            <Button variant="secondary" onClick={saveDraft} disabled={blocked} className="min-h-12 flex-1">
              {labels.draft}
            </Button>
          ) : undefined
        }
      >
        <input ref={intentRef} type="hidden" name="intent" defaultValue="submit" />
        {initial && (
          <>
            <input type="hidden" name="expense_id" value={initial.expenseId} />
            <input type="hidden" name="was_status" value={initial.wasStatus} />
            <input type="hidden" name="purchased_by" value={initial.purchasedBy} />
            {initial.paidByProfileId && <input type="hidden" name="paid_by_profile_id" value={initial.paidByProfileId} />}
          </>
        )}

        <TextField
          label="Data da compra"
          name="expense_date"
          type="date"
          required
          defaultValue={initial?.expenseDate ?? today}
          max={today}
        />

        {suppliers.length > 0 && (
          <SelectField
            label="Fornecedor cadastrado"
            name="supplier_id"
            options={suppliers}
            placeholder="Outro (digitar o nome)"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          />
        )}
        {!supplierId && (
          <TextField
            label={suppliers.length > 0 ? "Nome do fornecedor" : "Fornecedor"}
            name="supplier_name_free"
            required
            maxLength={120}
            defaultValue={initial?.supplierNameFree ?? ""}
            placeholder="Ex.: Casa do Construtor"
          />
        )}

        <TextAreaField
          label="O que foi comprado"
          name="description"
          required
          rows={2}
          defaultValue={initial?.description ?? ""}
          placeholder="Ex.: Luvas de 50 mm e cola PVC"
        />
        {categories.length > 0 && (
          <SelectField label="Categoria" name="expense_category_id" options={categories} defaultValue={initial?.categoryId ?? ""} />
        )}

        <FieldShell label="Valor total (R$)" name="total" required hint="Valor da nota inteira, mesmo que seja dividida entre obras.">
          {(a11y) => (
            <input
              name="total"
              required
              inputMode="decimal"
              autoComplete="off"
              placeholder="Ex.: 1.000,00"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              onBlur={(e) => setTotal(normalizeMoneyInput(e.target.value))}
              className="campo-input text-lg font-semibold tabular-nums"
              {...a11y}
            />
          )}
        </FieldShell>

        {paymentMethods.length > 0 && (
          <SelectField label="Forma de pagamento" name="payment_method_id" options={paymentMethods} defaultValue={initial?.paymentMethodId ?? ""} />
        )}

        <fieldset className="space-y-2">
          <legend className="text-[0.95rem] font-semibold">
            Quem pagou <span className="text-erro">*</span>
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { v: "empresa", l: "Empresa" },
                { v: "colaborador", l: initial && initial.paidByProfileId && initial.paidByProfileId !== initial.purchasedBy ? "Colaborador" : "Eu mesmo" },
              ] as const
            ).map((o) => (
              <label key={o.v} className="flex min-h-12 items-center gap-3 rounded-ctl border border-linha bg-papel px-3 font-semibold">
                <input
                  type="radio"
                  name="paid_by_kind"
                  value={o.v}
                  checked={paidBy === o.v}
                  onChange={() => setPaidBy(o.v)}
                  className="size-5 accent-laranja"
                />
                {o.l}
              </label>
            ))}
          </div>
          {paidBy === "colaborador" && (
            <p className="text-sm text-muted">
              Gera reembolso de {check.totalCents ? formatBRL(check.totalCents) : "o valor total"} para quem pagou. A administração registra
              quando reembolsar (o sistema não faz transferência).
            </p>
          )}
        </fieldset>

        <MediaUploader
          name="receipt_ids"
          purpose="receipt"
          label={needsReceipt ? "Comprovante (foto da nota ou PDF)" : "Adicionar comprovante"}
          required={needsReceipt}
          max={6}
          hint={
            needsReceipt
              ? "Fotografe a nota inteira, com o valor legível."
              : `Esta compra já tem ${initial!.receiptCount} comprovante(s). Envie outro só se precisar.`
          }
        />
        <TextField label="Número da nota ou cupom" name="document_number" maxLength={60} defaultValue={initial?.documentNumber ?? ""} />

        <AllocationEditor rows={rows} onChange={setRows} siteGroups={siteGroups} check={check} />

        {requests.length > 0 && (
          <SelectField
            label="Chamado relacionado"
            name="service_request_id"
            options={requests}
            placeholder="Nenhum"
            defaultValue={initial?.serviceRequestId ?? ""}
            hint="Se a compra foi para atender um chamado em aberto."
          />
        )}
        <TextAreaField label="Itens e quantidades" name="items_notes" rows={2} defaultValue={initial?.itemsNotes ?? ""} placeholder="Ex.: 2 luvas 50 mm, 1 cola PVC 175 g" />
      </ActionForm>
    </div>
  );
}
