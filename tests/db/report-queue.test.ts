import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { runQueueTick } from "@/server/reports/queue";
import { createUser, serviceClient, type TestUser } from "./helpers";

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
