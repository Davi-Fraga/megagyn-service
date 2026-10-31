/** Tipos que o navegador pode exibir. Qualquer outro vira download opaco. */
const SERVABLE = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

/** Igual ao usado pelo GitHub para conteúdo de usuário: sem script, sem origem. */
const ISOLATED_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

export type FilePlan = {
  key: string;
  contentType: string;
  disposition: "inline" | "attachment";
  csp: string | null;
};

/**
 * Decide qual objeto do Storage entregar e com quais cabeçalhos.
 * Fotos antigas têm original, média e miniatura: o original guarda os metadados da câmera
 * e fica restrito à administração (R-46). Fotos novas têm só o arquivo principal, já sem
 * metadados, e a miniatura. Retorna null quando não há versão que a pessoa possa receber.
 */
export function planFileResponse(input: {
  mime: string;
  storageKey: string;
  derivatives: Record<string, string> | null;
  variant: string | null;
  isAdmin: boolean;
}): FilePlan | null {
  const variant = input.variant ?? "medium";
  const disposition = variant === "download" ? "attachment" : "inline";
  if (!SERVABLE.has(input.mime)) {
    return { key: input.storageKey, contentType: "application/octet-stream", disposition: "attachment", csp: ISOLATED_CSP };
  }
  if (input.mime === "application/pdf") {
    return { key: input.storageKey, contentType: "application/pdf", disposition, csp: null };
  }

  const d = input.derivatives ?? {};
  const wantsOriginal = variant === "original" || variant === "download";
  if (wantsOriginal && input.isAdmin) {
    return { key: input.storageKey, contentType: input.mime, disposition, csp: ISOLATED_CSP };
  }
  // Só miniatura nos derivados = arquivo principal já reprocessado, seguro para todos.
  const main = d.medium ?? (d.thumb ? input.storageKey : undefined);
  const derived = variant === "thumb" ? (d.thumb ?? d.medium) : main;
  if (derived) return { key: derived, contentType: "image/jpeg", disposition, csp: ISOLATED_CSP };
  if (input.isAdmin) return { key: input.storageKey, contentType: input.mime, disposition, csp: ISOLATED_CSP };
  return null;
}
