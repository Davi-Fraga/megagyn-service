/** Montagem segura de HTML para os PDFs: toda interpolação é escapada, salvo fragmentos SafeHtml. */
export class SafeHtml {
  constructor(private readonly value: string) {}
  toString() {
    return this.value;
  }
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c]!);
}

type Value = SafeHtml | string | number | null | undefined | false | Array<SafeHtml>;

function render(v: Value): string {
  if (v === null || v === undefined || v === false) return "";
  if (v instanceof SafeHtml) return v.toString();
  if (Array.isArray(v)) return v.map((x) => x.toString()).join("");
  return escapeHtml(String(v));
}

export function html(strings: TemplateStringsArray, ...values: Value[]): SafeHtml {
  let out = strings[0] ?? "";
  values.forEach((v, i) => {
    out += render(v) + (strings[i + 1] ?? "");
  });
  return new SafeHtml(out);
}

export function raw(s: string): SafeHtml {
  return new SafeHtml(s);
}

export function join(parts: SafeHtml[], sep = ""): SafeHtml {
  return new SafeHtml(parts.map((p) => p.toString()).join(sep));
}

/** Texto com quebras de linha preservadas. */
export function multiline(text: string | null | undefined): SafeHtml {
  return raw(escapeHtml(text ?? "").replace(/\r?\n/g, "<br>"));
}
