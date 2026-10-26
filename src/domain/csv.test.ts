import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

type Row = { name: string; value: number; note: string | null };

describe("CSV para Excel brasileiro", () => {
  const columns = [
    { header: "Nome", value: (r: Row) => r.name },
    { header: "Valor (R$)", value: (r: Row) => r.value },
    { header: "Observação", value: (r: Row) => r.note },
  ];

  it("usa BOM UTF-8, separador ponto e vírgula e CRLF", () => {
    const csv = toCsv(columns, [{ name: "Cimento", value: 100000, note: null }], { money: ["Valor (R$)"] });
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿Nome;Valor (R$);Observação\r\nCimento;1.000,00;\r\n");
  });

  it("escapa aspas, separadores e quebras de linha", () => {
    const csv = toCsv(columns, [{ name: 'Tubo "PVC"; 50mm', value: 1, note: "linha1\nlinha2" }]);
    expect(csv).toContain('"Tubo ""PVC""; 50mm"');
    expect(csv).toContain('"linha1\nlinha2"');
  });

  it("neutraliza fórmulas (injeção de CSV)", () => {
    const csv = toCsv(columns, [{ name: "=HYPERLINK(\"x\")", value: 0, note: "@SUM(1)" }]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'@SUM(1)");
  });

  it("neutraliza fórmula que começa com sinal de menos", () => {
    const csv = toCsv(columns, [{ name: "-1+cmd|'/C calc'!A0", value: 0, note: "-2,50" }]);
    expect(csv).toContain("'-1+cmd");
    expect(csv).toContain(";-2,50");
  });

  it("mantém números negativos como número", () => {
    const csv = toCsv(columns, [{ name: "Ajuste", value: -5000, note: null }], { money: ["Valor (R$)"] });
    expect(csv).toContain(";-50,00;");
  });
});
