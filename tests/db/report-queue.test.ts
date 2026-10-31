import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { beforeAll, describe, expect, it } from "vitest";
import { processReport } from "@/server/reports/jobs";
import { runQueueTick } from "@/server/reports/queue";
import { createClientWithSite, createUser, serviceClient, type TestUser } from "./helpers";

/**
 * Fila de PDFs (worker e rota /api/jobs/reports): retoma o que está na fila, o que falhou
 * com menos de 3 tentativas e o que ficou "processando" por mais de 10 minutos.
 */

let admin: TestUser;
const tag = randomUUID();

async function artifact(status: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await serviceClient()
    .from("report_artifacts")
    .insert({
      kind: "os_individual",
      source_type: "service_request",
      params: { fila: tag },
      file_name: `Fila_${tag}.pdf`,
      requested_by: admin.id,
      audience: "interno",
      status,
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  admin = await createUser("admin", "Admin Fila");
});

describe("runQueueTick", () => {
  it("retoma na fila, falhou com tentativas restantes e processando travado; ignora o resto", async () => {
    const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
    const queued = await artifact("na_fila");
    const failedRetry = await artifact("falhou", { attempts: 2 });
    const failedGiveUp = await artifact("falhou", { attempts: 3 });
    const stale = await artifact("processando", { started_at: minutesAgo(11) });
    const fresh = await artifact("processando", { started_at: minutesAgo(2) });
    const ready = await artifact("pronto", { storage_key: `os_individual/2026/${randomUUID()}.pdf` });

    const seen: string[] = [];
    const result = await runQueueTick(serviceClient(), {
      limit: 10,
      onlyParams: { fila: tag },
      process: async (id) => {
        seen.push(id);
        return "pronto";
      },
    });

    expect(seen.sort()).toEqual([queued, failedRetry, stale].sort());
    expect(seen).not.toContain(failedGiveUp);
    expect(seen).not.toContain(fresh);
    expect(seen).not.toContain(ready);
    expect(result.processed).toHaveLength(3);
  });

  it("respeita o limite por passada e processa os mais antigos primeiro", async () => {
    const first = await artifact("na_fila", { requested_at: new Date(Date.now() - 3_600_000).toISOString() });
    await artifact("na_fila");
    const seen: string[] = [];
    await runQueueTick(serviceClient(), { limit: 1, onlyParams: { fila: tag }, process: async (id) => (seen.push(id), "pronto") });
    expect(seen).toEqual([first]);
  });
});

describe("Gotenberg com credencial errada", () => {
  it("o pedido termina como falhou, com a causa, e pode ser retentado", async () => {
    const server = createServer((req, res) => {
      res.statusCode = req.url === "/health" ? 200 : 401;
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const previous = { renderer: process.env.PDF_RENDERER, url: process.env.GOTENBERG_URL };
    process.env.PDF_RENDERER = "gotenberg";
    process.env.GOTENBERG_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const { client } = await createClientWithSite("GotenbergFechado");
      const id = await artifact("na_fila", {
        kind: "fechamento_resumo",
        source_type: "closing_version",
        params: { clientId: client.id, siteId: null, year: 2026, month: 8, includeBilling: false },
      });
      expect(await processReport(id)).toBe("falhou");
      const { data } = await serviceClient().from("report_artifacts").select("status, attempts, error_message").eq("id", id).single();
      expect(data).toMatchObject({ status: "falhou", attempts: 1, error_message: "Gotenberg respondeu 401" });
    } finally {
      process.env.PDF_RENDERER = previous.renderer;
      process.env.GOTENBERG_URL = previous.url;
      if (previous.renderer === undefined) delete process.env.PDF_RENDERER;
      if (previous.url === undefined) delete process.env.GOTENBERG_URL;
      await new Promise((resolve) => server.close(resolve));
    }
  }, 60_000);
});
