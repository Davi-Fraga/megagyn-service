import { describe, expect, it } from "vitest";
import { buildOccurrences } from "./task-form";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const AREA = "33333333-3333-4333-8333-333333333333";

describe("buildOccurrences", () => {
  it("sem setor, nenhuma ocorrência leva site_area_id", () => {
    expect(buildOccurrences([A, B], "2026-10-30", null)).toEqual({
      occurrences: [
        { site_id: A, scheduled_date: "2026-10-30" },
        { site_id: B, scheduled_date: "2026-10-30" },
      ],
    });
  });

  it("com dois locais, só a ocorrência do local do setor leva site_area_id", () => {
    expect(buildOccurrences([A, B], "2026-10-30", `${B}:${AREA}`).occurrences).toEqual([
      { site_id: A, scheduled_date: "2026-10-30" },
      { site_id: B, scheduled_date: "2026-10-30", site_area_id: AREA },
    ]);
  });

  it("setor de local não marcado devolve erro claro", () => {
    expect(buildOccurrences([A], "2026-10-30", `${B}:${AREA}`).error).toBe("Esse setor é de um local que não foi marcado.");
  });

  it("valor adulterado no campo é recusado", () => {
    expect(buildOccurrences([A], "2026-10-30", "abc").error).toBe("Escolha um setor da lista.");
  });
});
