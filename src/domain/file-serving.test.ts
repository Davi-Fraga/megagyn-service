import { describe, expect, it } from "vitest";
import { planFileResponse } from "./file-serving";

const photo = {
  mime: "image/jpeg",
  storageKey: "s/2026/09/a.jpg",
  derivatives: { thumb: "s/2026/09/a_thumb.jpg", medium: "s/2026/09/a_medium.jpg" },
};

describe("planFileResponse", () => {
  it("entrega a miniatura pedida", () => {
    const plan = planFileResponse({ ...photo, variant: "thumb", isAdmin: false });
    expect(plan).toMatchObject({ key: "s/2026/09/a_thumb.jpg", contentType: "image/jpeg", disposition: "inline" });
  });

  it("sem variante, entrega a versão média", () => {
    expect(planFileResponse({ ...photo, variant: null, isAdmin: false })?.key).toBe("s/2026/09/a_medium.jpg");
  });

  it("original de foto só para administração: os demais recebem a versão sem metadados (R-46)", () => {
    expect(planFileResponse({ ...photo, variant: "original", isAdmin: false })?.key).toBe("s/2026/09/a_medium.jpg");
    expect(planFileResponse({ ...photo, variant: "download", isAdmin: false })).toMatchObject({
      key: "s/2026/09/a_medium.jpg",
      disposition: "attachment",
    });
    expect(planFileResponse({ ...photo, variant: "original", isAdmin: true })).toMatchObject({ key: "s/2026/09/a.jpg", contentType: "image/jpeg" });
  });

  it("foto sem derivado não é entregue a quem não é administração", () => {
    expect(planFileResponse({ ...photo, derivatives: {}, variant: "medium", isAdmin: false })).toBeNull();
    expect(planFileResponse({ ...photo, derivatives: {}, variant: "medium", isAdmin: true })?.key).toBe("s/2026/09/a.jpg");
  });

  it("imagens saem com CSP isolada (sem script mesmo se aberta como página)", () => {
    expect(planFileResponse({ ...photo, variant: "thumb", isAdmin: false })?.csp).toBe("default-src 'none'; style-src 'unsafe-inline'; sandbox");
  });

  it("PDF sai inline como PDF, no original", () => {
    const plan = planFileResponse({ mime: "application/pdf", storageKey: "u/2026/09/b.pdf", derivatives: {}, variant: "original", isAdmin: false });
    expect(plan).toMatchObject({ key: "u/2026/09/b.pdf", contentType: "application/pdf", disposition: "inline" });
  });

  it("tipo fora da lista nunca é exibido no navegador", () => {
    const plan = planFileResponse({ mime: "text/html", storageKey: "u/x.html", derivatives: {}, variant: "original", isAdmin: true });
    expect(plan).toMatchObject({ contentType: "application/octet-stream", disposition: "attachment" });
    expect(plan?.csp).toContain("sandbox");
  });
});
