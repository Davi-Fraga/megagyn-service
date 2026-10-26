import { describe, expect, it } from "vitest";
import { centsToWords } from "./amount-in-words";

describe("centsToWords (valor por extenso em pt-BR)", () => {
  it("corrige o exemplo do orçamento: R$ 7.600,00", () => {
    expect(centsToWords(760000)).toBe("sete mil e seiscentos reais");
  });

  it("escreve o total do demonstrativo de setembro", () => {
    expect(centsToWords(799200)).toBe("sete mil novecentos e noventa e dois reais");
  });

  it("trata singular, centavos e zero", () => {
    expect(centsToWords(100)).toBe("um real");
    expect(centsToWords(1)).toBe("um centavo");
    expect(centsToWords(150)).toBe("um real e cinquenta centavos");
    expect(centsToWords(0)).toBe("zero real");
    expect(centsToWords(33300)).toBe("trezentos e trinta e três reais");
  });

  it("usa cem/cento e 'e' entre grupos conforme a norma", () => {
    expect(centsToWords(10000)).toBe("cem reais");
    expect(centsToWords(10100)).toBe("cento e um reais");
    expect(centsToWords(100000)).toBe("mil reais");
    expect(centsToWords(110000)).toBe("mil e cem reais");
    expect(centsToWords(105000)).toBe("mil e cinquenta reais");
    expect(centsToWords(125000)).toBe("mil duzentos e cinquenta reais");
    expect(centsToWords(2100000)).toBe("vinte e um mil reais");
  });

  it("usa 'de reais' após milhão exato", () => {
    expect(centsToWords(100000000)).toBe("um milhão de reais");
    expect(centsToWords(250000000)).toBe("dois milhões e quinhentos mil reais");
    expect(centsToWords(123456789)).toBe(
      "um milhão duzentos e trinta e quatro mil quinhentos e sessenta e sete reais e oitenta e nove centavos",
    );
  });

  it("recusa valores negativos ou não inteiros", () => {
    expect(() => centsToWords(-1)).toThrow();
    expect(() => centsToWords(1.5)).toThrow();
  });
});
