import { describe, expect, it } from "vitest";
import { toActionError } from "./action-errors";

describe("toActionError", () => {
  it("repassa mensagens de regra de negócio e associa ao campo indicado", () => {
    expect(toActionError({ code: "P0001", message: "Informe o motivo.", hint: "reason" })).toEqual({
      ok: false,
      message: "Informe o motivo.",
      fieldErrors: { reason: "Informe o motivo." },
    });
  });

  it("repassa acesso negado, não encontrado e violação de regra do banco", () => {
    expect(toActionError({ code: "42501", message: "Somente a administração pode fazer isso.", hint: "" }).message).toBe(
      "Somente a administração pode fazer isso.",
    );
    expect(toActionError({ code: "P0002", message: "Chamado não encontrado." }).message).toBe("Chamado não encontrado.");
    expect(toActionError({ code: "23514", message: "A soma das parcelas (R$ 1,00) é diferente", hint: "allocations" }).fieldErrors).toEqual({
      allocations: "A soma das parcelas (R$ 1,00) é diferente",
    });
  });

  it("converte o campo indicado pelo banco (camelCase) para o nome do campo do formulário", () => {
    expect(toActionError({ code: "P0001", message: "Envie ao menos 1 foto do resultado.", hint: "resultPhotoIds" }).fieldErrors).toEqual({
      result_photo_ids: "Envie ao menos 1 foto do resultado.",
    });
    expect(toActionError({ code: "P0001", message: "Foto de outro local.", hint: "photos" }).fieldErrors).toEqual({ photo_ids: "Foto de outro local." });
    expect(toActionError({ code: "P0001", message: "Anexe o comprovante.", hint: "receipts" }).fieldErrors).toEqual({ receipt_ids: "Anexe o comprovante." });
    expect(toActionError({ code: "P0001", message: "x", hint: "expected_return_date" }).fieldErrors).toEqual({ expected_return_date: "x" });
  });

  it("não vaza detalhes técnicos de erros internos", () => {
    expect(toActionError({ code: "42883", message: "function private.brl(numeric) does not exist" })).toEqual({
      ok: false,
      message: "Não foi possível concluir a operação. Tente novamente.",
    });
  });

  it("traduz duplicidade e falha de rede", () => {
    expect(toActionError({ code: "23505", message: "duplicate key value violates unique constraint" }).message).toBe(
      "Já existe um registro com esses dados.",
    );
    expect(toActionError(new TypeError("fetch failed")).message).toBe(
      "Sem conexão com o servidor. Verifique a internet e tente de novo.",
    );
  });
});
