import { describe, expect, it } from "vitest";
import { hardenSessionCookie } from "./cookies";

describe("hardenSessionCookie", () => {
  it("cookie de sessão nunca é legível por script e não vai em requisição de outro site", () => {
    const o = hardenSessionCookie({ maxAge: 100 }, "http://localhost:3000");
    expect(o).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 100, secure: false });
  });
  it("em HTTPS exige conexão segura", () => {
    expect(hardenSessionCookie({}, "https://app.exemplo.com.br").secure).toBe(true);
  });
  it("não permite que a biblioteca desligue as proteções", () => {
    const o = hardenSessionCookie({ httpOnly: false, sameSite: "none" }, "https://app.exemplo.com.br");
    expect(o.httpOnly).toBe(true);
    expect(o.sameSite).toBe("lax");
  });
});
