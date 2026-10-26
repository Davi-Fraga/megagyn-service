import { beforeAll, describe, expect, it } from "vitest";
import { todayIso } from "@/domain/dates";
import { loadDashboardRows } from "@/server/dashboard";
import { createClientWithSite, createUser, serviceClient, uid, type TestUser } from "./helpers";

/** F5.6: o número do cartão do painel é o mesmo da lista que ele abre — sem truncar em 1000 linhas. */

let admin: TestUser;
let clientId: string;
const VOLUME = 1050;

beforeAll(async () => {
  admin = await createUser("admin", "Admin Painel");
  const created = await createClientWithSite("Painel");
  clientId = created.client.id;
  const tag = Date.now().toString().slice(-6);
  const rows = Array.from({ length: VOLUME }, (_, i) => ({
    number: `2026-9${tag}${String(i).padStart(4, "0")}`,
    client_id: clientId,
    site_id: created.site.id,
    origin: "cliente_externo" as const,
    requester_name: "Fictício",
    title: `Painel ${i}`,
    description: "x",
    status: "aberta" as const,
    client_request_id: uid(),
    created_by: admin.id,
  }));
  const { error } = await serviceClient().from("service_requests").insert(rows);
  if (error) throw error;
}, 120_000);

describe("painel da administração", () => {
  it("conta todos os chamados do filtro, mesmo acima de 1000", async () => {
    const today = todayIso();
    const { requests } = await loadDashboardRows(admin.db, { clientId, siteId: null, personId: null, from: today, to: today, today });
    expect(requests.length).toBe(VOLUME);
    expect(requests.filter((r) => r.status === "aberta").length).toBe(VOLUME);
  }, 120_000);
});
