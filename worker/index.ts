/**
 * Worker de relatórios (npm run worker). O app já gera cada PDF logo após o pedido;
 * este processo retoma pedidos que ficaram na fila, falharam (até 3 tentativas) ou
 * foram interrompidos (processando há mais de 10 minutos), por exemplo após um reinício.
 * Em hospedagem sem processo contínuo, a rota /api/jobs/reports faz a mesma passada.
 */
import { existsSync, readFileSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!;
  }
}

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 15_000);
let stopping = false;

async function tick() {
  const { createSupabaseAdmin } = await import("../src/server/supabase/admin");
  const { runQueueTick } = await import("../src/server/reports/queue");
  const { processed } = await runQueueTick(createSupabaseAdmin(), { limit: 5, shouldStop: () => stopping });
  for (const job of processed) console.log(JSON.stringify({ level: "info", event: "worker.job", ...job }));
}

async function main() {
  console.log(JSON.stringify({ level: "info", event: "worker.start", intervalMs: INTERVAL_MS }));
  while (!stopping) {
    try {
      await tick();
    } catch (e) {
      console.error(JSON.stringify({ level: "error", event: "worker.tick_fail", message: e instanceof Error ? e.message : String(e) }));
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
  const { closeRenderer } = await import("../src/server/reports/render");
  await closeRenderer();
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    stopping = true;
  });
}

if (process.argv.includes("--once")) {
  tick()
    .then(async () => {
      const { closeRenderer } = await import("../src/server/reports/render");
      await closeRenderer();
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else {
  void main();
}
