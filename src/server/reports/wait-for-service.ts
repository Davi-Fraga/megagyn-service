type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ ok: boolean }>;

/**
 * Espera um serviço HTTP responder 200. Em hospedagem gratuita o Gotenberg dorme e leva
 * cerca de um minuto para acordar: a geração do PDF espera em vez de falhar na hora.
 * Devolve quanto tempo esperou, em milissegundos.
 */
export async function waitForService(
  url: string,
  options: { fetch?: FetchLike; timeoutMs?: number; intervalMs?: number; headers?: Record<string, string> } = {},
): Promise<number> {
  const doFetch = options.fetch ?? (globalThis.fetch as FetchLike);
  const timeoutMs = options.timeoutMs ?? 120_000;
  const intervalMs = options.intervalMs ?? 2_000;
  const started = Date.now();
  for (;;) {
    try {
      const res = await doFetch(url, { signal: AbortSignal.timeout(Math.min(10_000, timeoutMs)), headers: options.headers });
      if (res.ok) return Date.now() - started;
    } catch {
      // Conexão recusada ou tempo esgotado: o serviço ainda está subindo.
    }
    if (Date.now() - started >= timeoutMs) {
      throw new Error(`O serviço de PDF não respondeu em ${Math.round(timeoutMs / 1000)} s. Tente novamente em instantes.`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
