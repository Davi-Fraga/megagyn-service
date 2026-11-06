import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataTable, type DataTableColumn } from "./data-table";

type Row = { id: string; name: string; total: number };
const ROWS: Row[] = [
  { id: "a", name: "Alfa", total: 10 },
  { id: "b", name: "Beta", total: 20 },
];

function render(props: { variant: "ruler" | "boxed"; minWidth: string; columns: Array<DataTableColumn<Row> | false> }) {
  return renderToStaticMarkup(createElement(DataTable<Row>, { ...props, rows: ROWS, rowKey: (r: Row) => r.id }));
}

/** Classes de cada ocorrência da tag, em ordem alfabética ("" quando não há atributo class). */
function classes(html: string, tag: string): string[] {
  return [...html.matchAll(new RegExp(`<${tag}(?=[\\s>])([^>]*)>`, "g"))].map((m) =>
    (/class="([^"]*)"/.exec(m[1] ?? "")?.[1] ?? "")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(" "),
  );
}
const sorted = (s: string) => s.split(/\s+/).filter(Boolean).sort().join(" ");

const name: DataTableColumn<Row> = { header: "Nome", cell: (r) => r.name };
const total: DataTableColumn<Row> = { header: "Total", align: "right", className: "whitespace-nowrap tabular-nums", cell: (r) => r.total };
const note: DataTableColumn<Row> = { header: "Obs.", cell: () => "—" };

describe("DataTable boxed", () => {
  const html = render({ variant: "boxed", minWidth: "min-w-[40rem]", columns: [name, total] });

  it("usa a moldura, a tabela e o cabeçalho das telas de cadastro", () => {
    expect(classes(html, "div")).toEqual([sorted("overflow-x-auto rounded-panel border border-linha bg-papel")]);
    expect(classes(html, "table")).toEqual([sorted("w-full min-w-[40rem] text-left text-[0.95rem]")]);
    expect(classes(html, "thead")).toEqual([sorted("border-b border-linha bg-concreto text-sm text-muted")]);
    expect(classes(html, "tbody")).toEqual([sorted("divide-y divide-linha")]);
  });

  it("alinha à direita cabeçalho e célula da coluna numérica", () => {
    expect(classes(html, "th")).toEqual([sorted("px-3 py-2 font-semibold"), sorted("px-3 py-2 text-right font-semibold")]);
    expect(classes(html, "td").slice(0, 2)).toEqual([sorted("px-3 py-2.5"), sorted("whitespace-nowrap px-3 py-2.5 text-right tabular-nums")]);
  });

  it("marca o cabeçalho com scope e cada linha com o realce de passar o mouse", () => {
    expect(html.match(/<th scope="col"/g)).toHaveLength(2);
    expect(classes(html, "tr")).toEqual(["", sorted("align-top hover:bg-concreto/60"), sorted("align-top hover:bg-concreto/60")]);
  });

  it("renderiza uma linha por registro com o conteúdo das células", () => {
    expect(html).toContain(">Alfa</td>");
    expect(html).toContain(">20</td>");
  });
});

describe("DataTable ruler", () => {
  const first: DataTableColumn<Row> = { ...name, className: "relative", headerClassName: "whitespace-nowrap" };
  const action: DataTableColumn<Row> = { header: "Ação", padY: "py-2", className: "text-right", cell: () => "Abrir" };
  const html = render({ variant: "ruler", minWidth: "min-w-[60rem]", columns: [first, note, action] });

  it("usa a régua: sem moldura, cabeçalho condensado com traço grafite", () => {
    expect(classes(html, "div")).toEqual(["overflow-x-auto"]);
    expect(classes(html, "table")).toEqual([sorted("w-full min-w-[60rem] text-left")]);
    expect(html).toContain("<thead><tr class=");
    expect(html).toContain("<tbody><tr");
    expect(classes(html, "tr")[0]).toBe(sorted("tipo-condensada text-[0.8125rem] text-muted"));
    expect(classes(html, "tr")[1]).toBe(sorted("align-top hover:bg-concreto/45 [&>td]:border-b [&>td]:border-linha"));
  });

  it("dá o padding horizontal pela posição da coluna", () => {
    expect(classes(html, "th")).toEqual([
      sorted("whitespace-nowrap border-b border-grafite pb-2 pl-4 pr-5 font-semibold"),
      sorted("border-b border-grafite pb-2 pr-5 font-semibold"),
      sorted("border-b border-grafite pb-2 pr-1 font-semibold"),
    ]);
    expect(classes(html, "td").slice(0, 2)).toEqual([sorted("relative py-4 pl-4 pr-5"), sorted("py-4 pr-5")]);
  });

  it("troca o padding vertical quando a coluna pede padY", () => {
    expect(classes(html, "td")[2]).toBe(sorted("py-2 pr-1 text-right"));
  });

  it("aceita classe da célula calculada por linha", () => {
    const muted: DataTableColumn<Row> = { header: "Total", className: (r) => r.total > 10 && "text-muted", cell: (r) => r.total };
    const html2 = render({ variant: "ruler", minWidth: "min-w-[60rem]", columns: [name, muted] });
    expect(classes(html2, "td")).toEqual([sorted("py-4 pl-4 pr-5"), sorted("py-4 pr-1"), sorted("py-4 pl-4 pr-5"), sorted("py-4 pr-1 text-muted")]);
  });

  it("ignora coluna condicional falsa e recalcula qual é a última", () => {
    const two = render({ variant: "ruler", minWidth: "min-w-[60rem]", columns: [name, false, note] });
    expect(classes(two, "th")).toEqual([sorted("border-b border-grafite pb-2 pl-4 pr-5 font-semibold"), sorted("border-b border-grafite pb-2 pr-1 font-semibold")]);
  });
});
