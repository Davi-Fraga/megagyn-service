import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClientWithSite, createUser, serviceClient, sql, type TestUser } from "./helpers";

/** B-17 (M-08): o banco recusa CPF/CNPJ repetido, com ou sem pontuação. */

let admin: TestUser;

beforeAll(async () => {
  admin = await createUser("admin", "Admin Clientes");
});

// Apaga os clientes fictícios criados aqui (sem locais nem contatos), para não sobrar resíduo na base local.
afterAll(async () => {
  const { error } = await serviceClient().from("clients").delete().eq("legal_name", NAME);
  if (error) throw error;
});

/** Números fictícios, novos a cada rodada (o banco confere só o tamanho; o dígito é conferido no app). */
const digits = (n: number) => (Date.now().toString() + Math.random().toString().slice(2)).slice(0, n);
const asCnpj = (d: string) => `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;

const NAME = "Cliente fictício B-17";
const insertClient = (kind: "pf" | "pj", document: string | null) =>
  admin.db.from("clients").insert({ kind, legal_name: NAME, display_name: NAME, document, created_by: admin.id }).select("id").single();

describe("B-17 — CPF/CNPJ único", () => {
  it("o mesmo CNPJ com e sem pontuação é recusado", async () => {
    const cnpj = digits(14);
    const first = await insertClient("pj", asCnpj(cnpj));
    expect(first.error).toBeNull();
    const again = await insertClient("pj", cnpj);
    expect(again.error?.code).toBe("23505");
    expect(again.error?.message).toContain("clients_document_digits_uidx");
  });

  it("documento com tamanho errado para o tipo é recusado", async () => {
    const cpfAsPj = await insertClient("pj", digits(11));
    expect(cpfAsPj.error?.code).toBe("23514");
    const cnpjAsPf = await insertClient("pf", digits(14));
    expect(cnpjAsPf.error?.code).toBe("23514");
  });

  it("clientes sem documento continuam aceitos, quantos forem", async () => {
    for (const doc of [null, "", null]) {
      const { error } = await insertClient("pj", doc);
      expect(error).toBeNull();
    }
  });
});

describe("B-27 — CNPJ da empresa", () => {
  it("o CNPJ provisório de zeros não fica nas Configurações (sairia nos PDFs)", () => {
    const zeros = sql("select count(*) from public.company_settings where regexp_replace(coalesce(cnpj, ''), '\\D', '', 'g') ~ '^0{14}$'");
    expect(zeros).toBe("0");
  });
});

describe("B-21 — acesso e responsáveis do local", () => {
  it("o responsável do local precisa ser contato do mesmo cliente", async () => {
    const svc = serviceClient();
    const mine = await createClientWithSite("B-21");
    const other = await createClientWithSite("B-21 outro");
    const contact = async (clientId: string) =>
      (await svc.from("client_contacts").insert({ client_id: clientId, name: "Contato fictício B-21" }).select("id").single()).data!.id as string;
    const own = await contact(mine.client.id);
    const foreign = await contact(other.client.id);

    const wrong = await admin.db.from("sites").update({ client_responsible_contact_id: foreign }).eq("id", mine.site.id);
    expect(wrong.error?.code).toBe("23503");

    const ok = await admin.db
      .from("sites")
      .update({ client_responsible_contact_id: own, responsible_profile_id: admin.id, access_hours: "Seg a sex, 7h às 17h", access_instructions: "Chave na portaria." })
      .eq("id", mine.site.id)
      .select("client_responsible_contact_id, responsible_profile_id, access_hours, access_instructions")
      .single();
    expect(ok.error).toBeNull();
    expect(ok.data).toEqual({ client_responsible_contact_id: own, responsible_profile_id: admin.id, access_hours: "Seg a sex, 7h às 17h", access_instructions: "Chave na portaria." });
  });
});
