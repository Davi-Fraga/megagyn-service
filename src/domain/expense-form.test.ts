import { describe, expect, it } from "vitest";
import { allocationCheck, fdAllocations } from "./expense-form";

const rows = (...items: Array<[string, string, string]>) => items.map(([siteId, amount, purpose]) => ({ siteId, amount, purpose }));

describe("allocationCheck — rateio ao vivo no formulário", () => {
  it("R$ 1.000,00 = 600,00 + 400,00 libera o envio", () => {
    const c = allocationCheck("1.000,00", rows(["a", "600,00", "Cozinha"], ["b", "400,00", "Cobertura"]));
    expect(c).toMatchObject({ totalCents: 100000, allocatedCents: 100000, differenceCents: 0, blocking: null });
  });

  it("diferença de R$ 0,01 bloqueia com mensagem clara", () => {
    const c = allocationCheck("1.000,00", rows(["a", "600,00", "x"], ["b", "399,99", "y"]));
    expect(c.differenceCents).toBe(1);
    expect(c.blocking).toBe("Faltam R$ 0,01 para completar o total da compra.");
  });

  it("parcelas acima do total também bloqueiam", () => {
    const c = allocationCheck("100", rows(["a", "100,01", "x"]));
    expect(c.differenceCents).toBe(-1);
    expect(c.blocking).toBe("As parcelas passam o total da compra em R$ 0,01.");
  });

  it("total vazio ou inválido bloqueia pedindo o valor total", () => {
    expect(allocationCheck("", rows(["a", "1,00", "x"])).blocking).toBe("Informe o valor total da compra (maior que zero).");
    expect(allocationCheck("abc", rows(["a", "1,00", "x"])).totalCents).toBeNull();
  });

  it("valor de parcela vazio ou inválido bloqueia", () => {
    expect(allocationCheck("10,00", rows(["a", "", "x"])).blocking).toBe("Parcela 1: valor deve ser maior que zero.");
  });

  it("obra repetida bloqueia", () => {
    expect(allocationCheck("10,00", rows(["a", "5,00", "x"], ["a", "5,00", "y"])).blocking).toContain("obra repetida");
  });

  it("obra ou finalidade vazias não bloqueiam o botão (o navegador e o servidor cobram)", () => {
    expect(allocationCheck("10,00", rows(["", "10,00", ""])).blocking).toBeNull();
  });
});

describe("fdAllocations — leitura das parcelas do formulário", () => {
  it("junta obra, valor e finalidade na ordem enviada, em centavos", () => {
    const fd = new FormData();
    for (const [s, a, p] of [
      ["11111111-1111-4111-8111-111111111111", "600,00", " Cozinha "],
      ["22222222-2222-4222-8222-222222222222", "R$ 400", "Cobertura"],
    ]) {
      fd.append("alloc_site_id", s!);
      fd.append("alloc_amount", a!);
      fd.append("alloc_purpose", p!);
    }
    expect(fdAllocations(fd)).toEqual([
      { siteId: "11111111-1111-4111-8111-111111111111", amountCents: 60000, purpose: "Cozinha" },
      { siteId: "22222222-2222-4222-8222-222222222222", amountCents: 40000, purpose: "Cobertura" },
    ]);
  });

  it("obra inválida vira vazia e valor inválido vira 0 (a validação acusa a parcela)", () => {
    const fd = new FormData();
    fd.append("alloc_site_id", "nao-e-uuid");
    fd.append("alloc_amount", "-5");
    fd.append("alloc_purpose", "x");
    expect(fdAllocations(fd)).toEqual([{ siteId: "", amountCents: 0, purpose: "x" }]);
  });
});
