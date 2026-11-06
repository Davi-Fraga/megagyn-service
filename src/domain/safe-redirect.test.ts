import { describe, expect, it } from "vitest";
import { actionReturnPath, safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath (evita redirecionamento aberto)", () => {
  it("aceita caminhos internos", () => {
    expect(safeRedirectPath("/campo")).toBe("/campo");
    expect(safeRedirectPath("/admin/chamados?status=pendente")).toBe("/admin/chamados?status=pendente");
  });

  it("recusa destinos externos e truques de parser", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/%09/evil.com", "https://evil.com", "evil.com", "/\n/evil.com", "", null, undefined]) {
      expect(safeRedirectPath(bad as string | null | undefined, "/"), String(bad)).toBe("/");
    }
  });
});

describe("actionReturnPath (volta das ações com o campo `base` do formulário)", () => {
  const id = "0b9f6f8e-1111-4c6a-9d1e-2a3b4c5d6e7f";

  it("usa a base interna enviada pelo formulário", () => {
    expect(actionReturnPath("/campo/chamados", "/campo/chamados", id, "pendencia")).toBe(`/campo/chamados/${id}?feito=pendencia`);
    expect(actionReturnPath("/campo/tarefas/", "/campo/tarefas", id, "desdobrada")).toBe(`/campo/tarefas/${id}?feito=desdobrada`);
  });

  it("descarta parâmetros da base para não quebrar o endereço", () => {
    expect(actionReturnPath("/campo/chamados?filtro=pendentes#topo", "/campo/chamados", id, "executada")).toBe(`/campo/chamados/${id}?feito=executada`);
  });

  it("base externa, vazia ou ausente volta para a rota padrão", () => {
    for (const bad of ["//exemplo.invalid", "https://exemplo.invalid", "/\t/exemplo.invalid", "", null, undefined]) {
      expect(actionReturnPath(bad, "/campo/chamados", id, "pendencia"), String(bad)).toBe(`/campo/chamados/${id}?feito=pendencia`);
    }
  });
});
