import { describe, expect, it } from "vitest";
import { closingFileName, dailyLogFileName, fileSlug, quoteFileName, serviceOrderFileName } from "./report-naming";

describe("nome do arquivo do fechamento mensal", () => {
  it("usa cliente, mês por extenso e ano", () => {
    expect(closingFileName({ clientName: "Park dos Alpes", year: 2026, month: 9 })).toBe(
      "Relatorio_Park_dos_Alpes_Setembro_2026.pdf",
    );
  });

  it("remove acentos e caracteres especiais", () => {
    expect(closingFileName({ clientName: "Condomínio São João / Bloco #2", year: 2026, month: 3 })).toBe(
      "Relatorio_Condominio_Sao_Joao_Bloco_2_Marco_2026.pdf",
    );
  });

  it("inclui unidade, resumo e versão quando aplicável", () => {
    expect(
      closingFileName({ clientName: "Park dos Alpes", unitName: "Torre A", year: 2026, month: 9, kind: "resumo", version: 2 }),
    ).toBe("Relatorio_Park_dos_Alpes_Torre_A_Setembro_2026_Resumo_v2.pdf");
    expect(closingFileName({ clientName: "Park dos Alpes", year: 2026, month: 9, version: 1 })).toBe(
      "Relatorio_Park_dos_Alpes_Setembro_2026.pdf",
    );
  });

  it("outros relatórios", () => {
    expect(serviceOrderFileName("2026-000123")).toBe("OS_2026-000123.pdf");
    expect(quoteFileName("ORC-2026-0001", "Pivot Equipamentos S.A.")).toBe("Orcamento_ORC-2026-0001_Pivot_Equipamentos_S_A.pdf");
    expect(dailyLogFileName("Obra Demo", "2026-09-01", "2026-09-30")).toBe("Diario_Obra_Demo_01-09-2026_a_30-09-2026.pdf");
  });

  it("fileSlug nunca devolve vazio", () => {
    expect(fileSlug("***")).toBe("Sem_nome");
  });
});
