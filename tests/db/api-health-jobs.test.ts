import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Rotas usadas pela hospedagem: /api/health (despertador e monitoramento) e
 * /api/jobs/reports (cron da fila de PDFs, protegida por CRON_SECRET).
 */

const SECRET = "segredo-de-teste-com-tamanho-suficiente";
let previous: string | undefined;

beforeAll(() => {
  previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = SECRET;
});
afterAll(() => {
  if (previous === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previous;
});

describe("GET /api/health", () => {
  it("responde ok com o banco acessível, sem dados sensíveis e sem cache", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.db).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/key|secret|token|http/i);
  });
});

describe("/api/jobs/reports", () => {
  it("sem o segredo responde 401", async () => {
    const { GET, POST } = await import("@/app/api/jobs/reports/route");
    expect((await GET(new Request("http://app.local/api/jobs/reports"))).status).toBe(401);
    expect((await POST(new Request("http://app.local/api/jobs/reports", { method: "POST", headers: { authorization: "Bearer errado" } }))).status).toBe(401);
  });

  it("com o segredo roda uma passada da fila e devolve o resumo", async () => {
    const { GET } = await import("@/app/api/jobs/reports/route");
    const res = await GET(new Request("http://app.local/api/jobs/reports?limit=0", { headers: { authorization: `Bearer ${SECRET}` } }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; processed: unknown[] };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.processed)).toBe(true);
  });
});
