import { describe, expect, it } from "vitest";
import { gotenbergAuthHeaders } from "./gotenberg-auth";

describe("gotenbergAuthHeaders", () => {
  it("monta o cabeçalho de autenticação básica", () => {
    expect(gotenbergAuthHeaders("u", "p")).toEqual({ Authorization: "Basic dTpw" });
  });
  it("sem usuário ou senha, não envia cabeçalho", () => {
    expect(gotenbergAuthHeaders("", "p")).toEqual({});
    expect(gotenbergAuthHeaders("u", "")).toEqual({});
  });
});
