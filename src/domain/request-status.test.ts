import { describe, expect, it } from "vitest";
import {
  REQUEST_ACTIONS,
  availableActions,
  canPerform,
  isOverdue,
  nextStatus,
  validateActionInput,
  type RequestStatus,
} from "./request-status";

describe("máquina de estados do chamado/OS", () => {
  it("segue o ciclo feliz do escopo", () => {
    let s: RequestStatus = "aberta";
    s = nextStatus("programar", s);
    expect(s).toBe("programada");
    s = nextStatus("iniciar", s);
    expect(s).toBe("em_execucao");
    s = nextStatus("registrar_atividade", s);
    expect(s).toBe("em_execucao");
    s = nextStatus("informar_execucao", s);
    expect(s).toBe("executada");
    s = nextStatus("validar", s);
    expect(s).toBe("concluida");
  });

  it("registrar atividade em OS programada inicia a execução", () => {
    expect(nextStatus("registrar_atividade", "programada")).toBe("em_execucao");
  });

  it("pendência e retomada", () => {
    expect(nextStatus("informar_pendencia", "em_execucao")).toBe("pendente");
    expect(nextStatus("retomar", "pendente")).toBe("em_execucao");
    expect(nextStatus("reprogramar", "pendente")).toBe("programada");
  });

  it("devolução, cancelamento e reabertura", () => {
    expect(nextStatus("devolver", "executada")).toBe("em_execucao");
    expect(nextStatus("cancelar", "pendente")).toBe("cancelada");
    expect(nextStatus("reabrir", "concluida")).toBe("aberta");
    expect(nextStatus("reabrir", "cancelada")).toBe("aberta");
  });

  it("bloqueia transições inválidas", () => {
    expect(() => nextStatus("validar", "em_execucao")).toThrow();
    expect(() => nextStatus("informar_execucao", "aberta")).toThrow();
    expect(() => nextStatus("cancelar", "concluida")).toThrow();
    expect(() => nextStatus("cancelar", "executada")).toThrow();
    expect(() => nextStatus("iniciar", "pendente")).toThrow();
  });

  it("só o administrador valida, devolve, cancela, reabre e programa", () => {
    for (const action of ["validar", "devolver", "cancelar", "reabrir", "programar", "reprogramar"] as const) {
      expect(canPerform(action, REQUEST_ACTIONS[action].from[0]!, "admin")).toBe(true);
      expect(canPerform(action, REQUEST_ACTIONS[action].from[0]!, "worker")).toBe(false);
      expect(canPerform(action, REQUEST_ACTIONS[action].from[0]!, "foreman")).toBe(false);
    }
  });

  it("equipe de campo executa, registra e informa pendência", () => {
    expect(canPerform("iniciar", "programada", "worker")).toBe(true);
    expect(canPerform("informar_execucao", "em_execucao", "foreman")).toBe(true);
    expect(canPerform("informar_pendencia", "em_execucao", "worker")).toBe(true);
    expect(canPerform("iniciar", "programada", "client")).toBe(false);
  });

  it("lista ações disponíveis por estado e papel", () => {
    expect(availableActions("executada", "worker")).toEqual([]);
    expect(availableActions("executada", "admin")).toEqual(["validar", "devolver"]);
    expect(availableActions("programada", "worker")).toEqual([
      "iniciar",
      "registrar_atividade",
      "informar_pendencia",
      "informar_execucao",
    ]);
  });
});

describe("validação dos dados obrigatórios por ação", () => {
  it("não permite Executada sem solução e sem foto do resultado", () => {
    expect(validateActionInput("informar_execucao", { solution: "", resultPhotoIds: [] })).toEqual({
      solution: "Descreva a solução aplicada.",
      resultPhotoIds: "Envie ao menos 1 foto do resultado.",
    });
    expect(validateActionInput("informar_execucao", { solution: "  ", resultPhotoIds: ["f1"] })).toHaveProperty("solution");
    expect(validateActionInput("informar_execucao", { solution: "Troca da luva", resultPhotoIds: ["f1"] })).toEqual({});
  });

  it("não permite Pendente sem motivo, explicação, providência, responsável e previsão", () => {
    const errors = validateActionInput("informar_pendencia", {});
    expect(Object.keys(errors).sort()).toEqual(
      ["expectedReturnDate", "explanation", "nextAction", "nextActionOwnerId", "pendingReasonId"].sort(),
    );
    expect(
      validateActionInput("informar_pendencia", {
        pendingReasonId: "r1",
        explanation: "Faltou luva de 50 mm",
        nextAction: "Comprar luva",
        nextActionOwnerId: "u1",
        expectedReturnDate: "2026-10-28",
      }),
    ).toEqual({});
  });

  it("exige motivo para devolver, cancelar e reabrir", () => {
    for (const action of ["devolver", "cancelar", "reabrir"] as const) {
      expect(validateActionInput(action, { reason: " " })).toHaveProperty("reason");
      expect(validateActionInput(action, { reason: "Foto ilegível" })).toEqual({});
    }
  });

  it("programar exige responsável e data", () => {
    expect(validateActionInput("programar", {})).toEqual({
      assigneeIds: "Escolha ao menos 1 responsável.",
      scheduledDate: "Informe a data programada.",
    });
  });

  it("registrar atividade exige descrição", () => {
    expect(validateActionInput("registrar_atividade", { description: "" })).toHaveProperty("description");
  });
});

describe("prazo vencido é alerta, não status", () => {
  it("vence quando a data passou e o chamado não terminou", () => {
    expect(isOverdue("2026-10-24", "pendente", "2026-10-25")).toBe(true);
    expect(isOverdue("2026-10-25", "pendente", "2026-10-25")).toBe(false);
    expect(isOverdue("2026-10-01", "concluida", "2026-10-25")).toBe(false);
    expect(isOverdue("2026-10-01", "cancelada", "2026-10-25")).toBe(false);
    expect(isOverdue(null, "aberta", "2026-10-25")).toBe(false);
  });
});
