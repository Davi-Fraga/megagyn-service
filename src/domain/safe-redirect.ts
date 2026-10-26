/**
 * Destino de redirecionamento após login/links de e-mail: só caminhos internos.
 * Recusa "//host", barras invertidas, caracteres de controle (o parser de URL os remove
 * e "/\t/evil.com" vira "//evil.com") e qualquer coisa que resolva para outra origem.
 */
function hasControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

export function safeRedirectPath(next: string | null | undefined, fallback = "/"): string {
  if (typeof next !== "string" || next === "") return fallback;
  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return fallback;
  }
  for (const candidate of [next, decoded]) {
    if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
    if (candidate.includes("\\") || hasControlChar(candidate)) return fallback;
  }
  const base = "http://app.local";
  try {
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
