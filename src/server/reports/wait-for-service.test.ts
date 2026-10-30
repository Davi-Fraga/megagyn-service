import { describe, expect, it } from "vitest";
import { waitForService } from "./wait-for-service";

/** Gotenberg em plano gratuito dorme e demora ~1 min para acordar: a geração espera em vez de falhar. */
describe("waitForService", () => {
  it("devolve assim que o serviço responde 200", async () => {
    let calls = 0;
    const fetchFake = async () => {
      calls += 1;
      return new Response(null, { status: calls < 3 ? 503 : 200 });
    };
    const ms = await waitForService("http://gotenberg.local/health", { fetch: fetchFake, timeoutMs: 5_000, intervalMs: 1 });
    expect(calls).toBe(3);
    expect(ms).toBeGreaterThanOrEqual(0);
  });

  it("trata erro de rede como 'ainda acordando' e tenta de novo", async () => {
    let calls = 0;
    const fetchFake = async () => {
      calls += 1;
      if (calls === 1) throw new Error("ECONNREFUSED");
      return new Response(null, { status: 200 });
    };
    await waitForService("http://gotenberg.local/health", { fetch: fetchFake, timeoutMs: 5_000, intervalMs: 1 });
    expect(calls).toBe(2);
  });

  it("repassa os cabeçalhos de autenticação ao serviço", async () => {
    let seen: Record<string, string> | undefined;
    const fetchFake = async (_: string, init?: { headers?: Record<string, string> }) => {
      seen = init?.headers;
      return new Response(null, { status: 200 });
    };
    await waitForService("http://gotenberg.local/health", { fetch: fetchFake, headers: { Authorization: "Basic dTpw" } });
    expect(seen).toEqual({ Authorization: "Basic dTpw" });
  });

  it("desiste depois do tempo limite com mensagem clara", async () => {
    const fetchFake = async () => new Response(null, { status: 503 });
    await expect(waitForService("http://gotenberg.local/health", { fetch: fetchFake, timeoutMs: 20, intervalMs: 5 })).rejects.toThrow(
      /não respondeu/,
    );
  });
});
