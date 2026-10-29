import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

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
