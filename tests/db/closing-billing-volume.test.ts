import { beforeAll, describe, expect, it } from "vitest";
import { computeClosing } from "@/server/closings";
import { createClientWithSite, createSite, createUser, serviceClient, type TestUser } from "./helpers";

/**
 * Demonstrativo do fechamento com mais de 1000 jornadas no mês (cliente grande):
 * nenhuma diária pode sumir por limite de linhas da API.
 */

const PEOPLE = 14;
const PRICE_CENTS = 33_300;
let admin: TestUser;
let clientId: string;
let days: string[] = [];
let siteIds: string[] = [];

beforeAll(async () => {
  admin = await createUser("admin", "Admin Demonstrativo");
  const created = await createClientWithSite("Diarias");
  clientId = created.client.id;
  const extra = await Promise.all([createSite(clientId, `Obra B ${Date.now()}`), createSite(clientId, `Obra C ${Date.now()}`)]);
  siteIds = [created.site.id, ...extra.map((s) => s.id)];
  const people = await Promise.all(Array.from({ length: PEOPLE }, (_, i) => createUser("worker", `Diarista ${i}`)));

  days = [];
  for (let d = 1; d <= 31; d++) {
    if (new Date(Date.UTC(2026, 6, d)).getUTCDay() !== 0) days.push(`2026-07-${String(d).padStart(2, "0")}`);
  }
  const svc = serviceClient();
  const { error: ruleErr } = await svc.from("billing_rules").insert({
    client_id: clientId,
    unit_type: "diaria",
    unit_price_cents: PRICE_CENTS,
    valid_from: "2026-01-01",
    show_in_client_report: true,
    created_by: admin.id,
  });
  if (ruleErr) throw ruleErr;
  const rows = people.flatMap((p) =>
    siteIds.flatMap((siteId) => days.map((work_date) => ({ profile_id: p.id, site_id: siteId, work_date, hours: 8, billable: true, billing_units: 1, source: "admin" }))),
  );
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await svc.from("time_entries").insert(rows.slice(i, i + 500));
    if (error) throw error;
  }
}, 180_000);

describe("demonstrativo do fechamento", () => {
  it("soma todas as diárias do mês, mesmo acima de 1000 jornadas", async () => {
    const expectedUnits = PEOPLE * siteIds.length * days.length;
    expect(expectedUnits).toBeGreaterThan(1000);
    const { payload } = await computeClosing(admin.db, { clientId, siteId: null, year: 2026, month: 7, includeBilling: true });
    const statements = payload.billing?.statements ?? [];
    expect(statements).toHaveLength(siteIds.length);
    expect(statements.reduce((n, s) => n + s.unitsTotalCenti, 0)).toBe(expectedUnits * 100);
    expect(statements.reduce((n, s) => n + s.totalCents, 0)).toBe(expectedUnits * PRICE_CENTS);
  }, 120_000);
});
