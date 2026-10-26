import { describe, expect, it } from "vitest";
import { html, raw, join } from "./html";

describe("html (templates de PDF)", () => {
  it("escapa interpolações para evitar injeção de HTML nos relatórios", () => {
    const name = `<script>alert("x")</script> & 'aspas'`;
    expect(html`<p>${name}</p>`.toString()).toBe("<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;aspas&#39;</p>");
  });

  it("permite fragmentos confiáveis e listas", () => {
    const items = ["a", "<b>"].map((i) => html`<li>${i}</li>`);
    expect(html`<ul>${join(items)}</ul>`.toString()).toBe("<ul><li>a</li><li>&lt;b&gt;</li></ul>");
    expect(html`<div>${raw("<br>")}</div>`.toString()).toBe("<div><br></div>");
  });

  it("ignora null, undefined e false", () => {
    expect(html`<p>${null}${undefined}${false}${0}</p>`.toString()).toBe("<p>0</p>");
  });
});
