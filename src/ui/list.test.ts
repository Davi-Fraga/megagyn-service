import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { List, type ListProps } from "./list";

const item = createElement("li", { key: "a" }, "Item A");

describe("List", () => {
  it("boxed: lista com moldura das telas da administração", () => {
    expect(renderToStaticMarkup(createElement(List, { variant: "boxed" } as ListProps, item))).toBe(
      '<ul class="divide-y divide-linha overflow-hidden rounded-panel border border-linha bg-papel"><li>Item A</li></ul>',
    );
  });

  it("bleed: lista de ponta a ponta do campo no celular", () => {
    expect(renderToStaticMarkup(createElement(List, { variant: "bleed" } as ListProps, item))).toBe(
      '<ul class="-mx-4 divide-y divide-linha border-y border-linha"><li>Item A</li></ul>',
    );
  });

  it("acrescenta classes extras sem perder as da variante", () => {
    expect(renderToStaticMarkup(createElement(List, { variant: "boxed", className: "mt-3" } as ListProps, item))).toContain(
      'class="divide-y divide-linha overflow-hidden rounded-panel border border-linha bg-papel mt-3"',
    );
  });
});
