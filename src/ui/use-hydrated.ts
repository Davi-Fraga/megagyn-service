import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false no HTML do servidor e até o React assumir a página; true depois.
 * Botões que dependem de JavaScript ficam desabilitados até lá: em rede fraca, um clique
 * antes da hidratação se perderia sem aviso (ou faria um envio nativo indesejado).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
