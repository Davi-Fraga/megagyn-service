import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { addMembership, createClientWithSite, createUser, fakePhoto, serviceClient, sql, today, type TestUser } from "./helpers";

let admin: TestUser;
let worker: TestUser;
let foreman: TestUser;
let clientId: string;
let siteId: string;

beforeAll(async () => {
  [admin, worker, foreman] = await Promise.all([
    createUser("admin", "Admin Orçamentos"),
    createUser("worker", "Funcionário Orçamentos"),
    createUser("foreman", "Encarregado Orçamentos"),
  ]);
  const { client, site } = await createClientWithSite("Orc");
  clientId = client.id;
  siteId = site.id;
  await addMembership(worker.id, site.id);
  await addMembership(foreman.id, site.id);
});

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

async function newQuote(extra: Record<string, unknown> = {}) {
  const { data, error } = await admin.db
    .from("quotes")
    .insert({ number: "", client_id: clientId, site_id: siteId, title: "Reforma (teste)", created_by: admin.id, valid_until: addDays(today(), 30), ...extra })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Foto do orçamento como a rota de upload cria (arquivo real + linha via chave de serviço). */
const quotePhoto = (user: TestUser) => fakePhoto(user, null, "quotes");

const globalItem = (quoteId: string, sort = 0) => ({
  quote_id: quoteId,
  location_label: "Cobertura",
  pricing_mode: "global",
  subtotal_cents: 760000,
  lines: ["Reparo de rufos e calhas", "Aplicação de manta líquida"],
  notes: "Garantia de 01 ano",
  sort_order: sort,
});

async function totalOf(quoteId: string) {
  const { data } = await admin.db.from("quotes").select("total_cents").eq("id", quoteId).single();
  return data!.total_cents;
}

function snapshotFor(quote: { id: string }, items: number, total: number) {
  return { schema: 1, quote_id: quote.id, items: Array.from({ length: items }, () => ({})), total_cents: total };
}

describe("T-A14 — orçamento: número, total e subtotal no banco", () => {
  it("número ORC-AAAA-NNNN atribuído pelo banco", async () => {
    const q = await newQuote();
    expect(q.number).toMatch(/^ORC-\d{4}-\d{4}$/);
    expect(q.status).toBe("rascunho");
  });

  it("total = soma dos itens (trigger), inclusive após remover item", async () => {
    const q = await newQuote();
    const { error } = await admin.db.from("quote_items").insert([
      globalItem(q.id),
      { quote_id: q.id, location_label: "Fachada", pricing_mode: "detalhado", quantity: 10, unit: "m²", unit_price_cents: 5000, subtotal_cents: 50000, lines: [], notes: null, sort_order: 1 },
      { quote_id: q.id, location_label: "Hall", pricing_mode: "detalhado", quantity: 1.5, unit: "m²", unit_price_cents: 333, subtotal_cents: 500, lines: [], notes: null, sort_order: 2 },
    ]);
    expect(error).toBeNull();
    expect(await totalOf(q.id)).toBe(810500);
    await admin.db.from("quote_items").delete().eq("quote_id", q.id).eq("location_label", "Hall");
    expect(await totalOf(q.id)).toBe(810000);
  });

  it("detalhado com subtotal diferente de round(quantidade × preço) é rejeitado", async () => {
    const q = await newQuote();
    const { error } = await admin.db.from("quote_items").insert({
      quote_id: q.id,
      location_label: "Fachada",
      pricing_mode: "detalhado",
      quantity: 1.5,
      unit_price_cents: 333,
      subtotal_cents: 499, // correto seria 500 (half-up)
    });
    expect(error?.code).toBe("23514");
    expect(await totalOf(q.id)).toBe(0);
  });
});

describe("R-62 — fotos do orçamento via RPC (somente administração)", () => {
  it("admin vincula fotos do local e de referência; novas vão para o fim", async () => {
    const q = await newQuote();
    const [a, b, c] = await Promise.all([quotePhoto(admin), quotePhoto(admin), quotePhoto(admin)]);
    const first = await admin.db.rpc("quote_link_photos", { p_quote_id: q.id, p_photo_ids: [a.id, b.id], p_role: "local" });
    expect(first.error).toBeNull();
    expect(first.data).toBe(2);
    const second = await admin.db.rpc("quote_link_photos", { p_quote_id: q.id, p_photo_ids: [c.id], p_role: "referencia" });
    expect(second.error).toBeNull();

    const { data: links } = await admin.db
      .from("attachment_links")
      .select("attachment_id, evidence_role, sort_order")
      .eq("entity_type", "quote")
      .eq("entity_id", q.id)
      .order("sort_order");
    expect(links).toEqual([
      { attachment_id: a.id, evidence_role: "local", sort_order: 0 },
      { attachment_id: b.id, evidence_role: "local", sort_order: 1 },
      { attachment_id: c.id, evidence_role: "referencia", sort_order: 2 },
    ]);

    const unlink = await admin.db.rpc("quote_unlink_photo", { p_quote_id: q.id, p_attachment_id: b.id });
    expect(unlink.error).toBeNull();
    const { count } = await admin.db.from("attachment_links").select("id", { count: "exact", head: true }).eq("entity_id", q.id);
    expect(count).toBe(2);
    // O arquivo continua existindo (só o vínculo sai).
    const { data: still } = await admin.db.from("attachments").select("id, revoked_at").eq("id", b.id).single();
    expect(still!.revoked_at).toBeNull();
  });

  it("recusa papel inválido e foto de outro bucket", async () => {
    const q = await newQuote();
    const photo = await quotePhoto(admin);
    const bad = await admin.db.rpc("quote_link_photos", { p_quote_id: q.id, p_photo_ids: [photo.id], p_role: "resultado" });
    expect(bad.error?.hint).toBe("role");
    const evidence = await fakePhoto(admin, siteId);
    const other = await admin.db.rpc("quote_link_photos", { p_quote_id: q.id, p_photo_ids: [evidence.id], p_role: "local" });
    expect(other.error?.hint).toBe("photo_ids");
  });

  it("funcionário e encarregado não leem orçamentos nem chamam as RPCs", async () => {
    const q = await newQuote();
    const photo = await quotePhoto(admin);
    for (const user of [worker, foreman]) {
      const { data } = await user.db.from("quotes").select("id").eq("id", q.id);
      expect(data).toEqual([]);
      const { data: items } = await user.db.from("quote_items").select("id").eq("quote_id", q.id);
      expect(items).toEqual([]);
      const link = await user.db.rpc("quote_link_photos", { p_quote_id: q.id, p_photo_ids: [photo.id], p_role: "local" });
      expect(link.error?.code).toBe("42501");
      const tr = await user.db.rpc("quote_transition", { p_quote_id: q.id, p_action: "cancelar", p_reason: "x" });
      expect(tr.error?.code).toBe("42501");
      const dup = await user.db.rpc("quote_duplicate", { p_quote_id: q.id });
      expect(dup.error?.code).toBe("42501");
      // Nem gravar anexo direto (só a rota de upload grava, e ela exige administração para orçamentos).
      const direct = await user.db.from("attachments").insert({
        bucket: "quotes",
        storage_key: `${user.id}/2026/10/${randomUUID()}.jpg`,
        mime_type: "image/jpeg",
        size_bytes: 10,
        uploaded_by: user.id,
        client_upload_id: randomUUID(),
        visibility: "internal",
      });
      expect(direct.error?.code).toBe("42501");
    }
  });
});

describe("R-64 — situação e versões", () => {
  it("enviar exige item e validade; congela versão conferindo o total", async () => {
    const q = await newQuote({ valid_until: null });
    const noItems = await admin.db.rpc("quote_transition", { p_quote_id: q.id, p_action: "enviar", p_snapshot: snapshotFor(q, 0, 0) });
    expect(noItems.error?.hint).toBe("items");

    await admin.db.from("quote_items").insert(globalItem(q.id));
    const noValidity = await admin.db.rpc("quote_transition", { p_quote_id: q.id, p_action: "enviar", p_snapshot: snapshotFor(q, 1, 760000) });
    expect(noValidity.error?.hint).toBe("valid_until");

    await admin.db.from("quotes").update({ valid_until: addDays(today(), 15) }).eq("id", q.id);
    const stale = await admin.db.rpc("quote_transition", { p_quote_id: q.id, p_action: "enviar", p_snapshot: snapshotFor(q, 1, 1) });
    expect(stale.error?.message).toContain("mudou");

    const sent = await admin.db.rpc("quote_transition", { p_quote_id: q.id, p_action: "enviar", p_snapshot: snapshotFor(q, 1, 760000) });
    expect(sent.error).toBeNull();
    expect(sent.data).toMatchObject({ status: "enviado", current_version_no: 1 });

    const { data: versions } = await admin.db.from("quote_versions").select("version_no, reason, snapshot").eq("quote_id", q.id);
    expect(versions).toHaveLength(1);
    expect(versions![0]).toMatchObject({ version_no: 1, reason: "Proposta enviada" });
    expect(versions![0]!.snapshot).toMatchObject({ status: "enviado", version_no: 1, total_cents: 760000 });

    // Fora de rascunho: itens, cabeçalho e fotos travados.
    const item = await admin.db.from("quote_items").insert(globalItem(q.id, 1));
    expect(item.error?.hint).toBe("items");
    const header = await admin.db.from("quotes").update({ title: "Outro" }).eq("id", q.id);
    expect(header.error?.code).toBe("P0001");
    const photo = await quotePhoto(admin);
    const link = await admin.db.rpc("quote_link_photos", { p_quote_id: q.id, p_photo_ids: [photo.id], p_role: "local" });
    expect(link.error?.message).toContain("rascunho");
    // Versões são imutáveis.
    const del = await serviceClient().from("quote_versions").delete().eq("quote_id", q.id);
    expect(del.error).not.toBeNull();
  });

  it("aprovação manual exige descrição e gera nova versão; recusa exige motivo", async () => {
    const q = await newQuote();
    await admin.db.from("quote_items").insert(globalItem(q.id));
    await admin.db.rpc("quote_transition", { p_quote_id: q.id, p_action: "enviar", p_snapshot: snapshotFor(q, 1, 760000) });

    const noNote = await admin.db.rpc("quote_transition", { p_quote_id: q.id, p_action: "aprovar", p_snapshot: snapshotFor(q, 1, 760000) });
    expect(noNote.error?.hint).toBe("reason");
    const future = await admin.db.rpc("quote_transition", {
      p_quote_id: q.id,
      p_action: "aprovar",
      p_reason: "Síndica (fictícia) por e-mail",
      p_accepted_on: addDays(today(), 1),
      p_snapshot: snapshotFor(q, 1, 760000),
    });
    expect(future.error?.hint).toBe("accepted_on");

    const ok = await admin.db.rpc("quote_transition", {
      p_quote_id: q.id,
      p_action: "aprovar",
      p_reason: "Síndica (fictícia) por e-mail",
      p_snapshot: snapshotFor(q, 1, 760000),
    });
    expect(ok.error).toBeNull();
    expect(ok.data).toMatchObject({ status: "aprovado", current_version_no: 2, accepted_note: "Síndica (fictícia) por e-mail" });
    expect(ok.data!.accepted_at).not.toBeNull();

    const reject = await admin.db.rpc("quote_transition", { p_quote_id: q.id, p_action: "recusar", p_reason: "x" });
    expect(reject.error?.message).toContain("enviada");

  });

  it("R-67 — orçamento não se liga a despesas (nenhuma FK entre as tabelas)", () => {
    const fks = sql(
      "select count(*) from pg_constraint where contype = 'f' and ((conrelid = 'public.expenses'::regclass and confrelid = 'public.quotes'::regclass) or (conrelid = 'public.quotes'::regclass and confrelid = 'public.expenses'::regclass))",
    );
    expect(fks).toBe("0");
  });

  it("vencido: não aprova sem renovar; renovar volta a enviado com nova versão", async () => {
    const q = await newQuote({ issued_at: addDays(today(), -40), valid_until: addDays(today(), -10) });
    await admin.db.from("quote_items").insert(globalItem(q.id));
    // Envio direto no banco simula proposta enviada antes de vencer (a situação só muda em transição, B-04).
    sql(`select set_config('app.in_transition', 'on', true); update public.quotes set status = 'enviado', current_version_no = 1 where id = '${q.id}'`);

    const approve = await admin.db.rpc("quote_transition", {
      p_quote_id: q.id,
      p_action: "aprovar",
      p_reason: "tarde",
      p_snapshot: snapshotFor(q, 1, 760000),
    });
    expect(approve.error?.message).toContain("Renove");

    const past = await admin.db.rpc("quote_transition", {
      p_quote_id: q.id,
      p_action: "renovar",
      p_valid_until: addDays(today(), -1),
      p_snapshot: snapshotFor(q, 1, 760000),
    });
    expect(past.error?.hint).toBe("valid_until");

    const renewed = await admin.db.rpc("quote_transition", {
      p_quote_id: q.id,
      p_action: "renovar",
      p_valid_until: addDays(today(), 20),
      p_snapshot: snapshotFor(q, 1, 760000),
    });
    expect(renewed.error).toBeNull();
    expect(renewed.data).toMatchObject({ status: "enviado", valid_until: addDays(today(), 20), current_version_no: 2 });
  });

  it("revisar volta para rascunho; reenvio cria versão seguinte com o motivo", async () => {
    const q = await newQuote();
    await admin.db.from("quote_items").insert(globalItem(q.id));
    await admin.db.rpc("quote_transition", { p_quote_id: q.id, p_action: "enviar", p_snapshot: snapshotFor(q, 1, 760000) });
    const revise = await admin.db.rpc("quote_transition", { p_quote_id: q.id, p_action: "revisar", p_reason: "Ajustar prazo" });
    expect(revise.data).toMatchObject({ status: "rascunho", status_reason: "Ajustar prazo" });
    const edit = await admin.db.from("quotes").update({ execution_deadline_text: "45 dias úteis" }).eq("id", q.id);
    expect(edit.error).toBeNull();
    const resent = await admin.db.rpc("quote_transition", { p_quote_id: q.id, p_action: "enviar", p_snapshot: snapshotFor(q, 1, 760000) });
    expect(resent.data).toMatchObject({ status: "enviado", current_version_no: 2, status_reason: null });
    const { data: v2 } = await admin.db.from("quote_versions").select("reason").eq("quote_id", q.id).eq("version_no", 2).single();
    expect(v2!.reason).toBe("Nova versão enviada (revisão: Ajustar prazo)");
  });
});

describe("B-04 — aprovação da revisão enviada e situação só pela transição", () => {
  async function sentQuote(address: string) {
    const q = await newQuote();
    await admin.db.from("quote_items").insert(globalItem(q.id));
    const sent = await admin.db.rpc("quote_transition", {
      p_quote_id: q.id,
      p_action: "enviar",
      p_snapshot: { ...snapshotFor(q, 1, 760000), client: { address_text: address } },
    });
    if (sent.error) throw sent.error;
    return q;
  }

  it("aprovação aponta a versão enviada mesmo após alterar o cliente", async () => {
    const q = await sentQuote("Rua A, 100 (fictícia)");
    // O app antigo ainda manda um snapshot novo, montado com os dados atuais do cliente: o banco ignora.
    const ok = await admin.db.rpc("quote_transition", {
      p_quote_id: q.id,
      p_action: "aprovar",
      p_reason: "Síndica (fictícia) por e-mail",
      p_snapshot: { ...snapshotFor(q, 1, 760000), client: { address_text: "Rua B, 200 (fictícia)" } },
    });
    expect(ok.error).toBeNull();
    expect(ok.data).toMatchObject({ status: "aprovado", current_version_no: 2, approved_version_no: 1 });

    const { data: v2 } = await admin.db.from("quote_versions").select("reason, snapshot").eq("quote_id", q.id).eq("version_no", 2).single();
    expect(v2!.reason).toBe("Aprovação do cliente registrada");
    expect(v2!.snapshot).toMatchObject({
      client: { address_text: "Rua A, 100 (fictícia)" },
      approved_from_version_no: 1,
      version_no: 2,
      status: "aprovado",
      accepted_note: "Síndica (fictícia) por e-mail",
    });
  });

  it("situação, versão e aceite não mudam por atualização direta, nem pela chave de serviço", async () => {
    const q = await sentQuote("Rua C, 300 (fictícia)");
    const byAdmin = await admin.db.from("quotes").update({ status: "rascunho" }).eq("id", q.id);
    expect(byAdmin.error?.code).toBe("42501");
    const byService = await serviceClient().from("quotes").update({ status: "aprovado", accepted_note: "forjado" }).eq("id", q.id);
    expect(byService.error?.code).toBe("42501");
    const version = await serviceClient().from("quotes").update({ current_version_no: 5 }).eq("id", q.id);
    expect(version.error?.code).toBe("42501");
    const born = await admin.db
      .from("quotes")
      .insert({ number: "", client_id: clientId, title: "Nasce aprovado (teste)", created_by: admin.id, status: "aprovado" })
      .select()
      .single();
    expect(born.error?.code).toBe("42501");

    const { data } = await admin.db.from("quotes").select("status, current_version_no, accepted_note").eq("id", q.id).single();
    expect(data).toEqual({ status: "enviado", current_version_no: 1, accepted_note: null });
  });

  it("a versão enviada guarda o logo e a assinatura das Configurações", async () => {
    const { data: s } = await serviceClient().from("company_settings").select("logo_attachment_id, signature_attachment_id").eq("id", 1).single();
    const q = await sentQuote("Rua D, 400 (fictícia)");
    const { data: v1 } = await admin.db.from("quote_versions").select("snapshot").eq("quote_id", q.id).eq("version_no", 1).single();
    expect(v1!.snapshot).toMatchObject({ branding: { logo_attachment_id: s!.logo_attachment_id, signature_attachment_id: s!.signature_attachment_id } });
  });
});

describe("R-65 — duplicar", () => {
  it("novo rascunho com itens e fotos, sem situação/aceite", async () => {
    const q = await newQuote({ issued_at: addDays(today(), -5), valid_until: addDays(today(), 25) });
    await admin.db.from("quote_items").insert(globalItem(q.id));
    const photo = await quotePhoto(admin);
    await admin.db.rpc("quote_link_photos", { p_quote_id: q.id, p_photo_ids: [photo.id], p_role: "local" });
    await admin.db.rpc("quote_transition", { p_quote_id: q.id, p_action: "cancelar", p_reason: "Cliente desistiu" });

    const { data: copy, error } = await admin.db.rpc("quote_duplicate", { p_quote_id: q.id });
    expect(error).toBeNull();
    expect(copy).toMatchObject({ status: "rascunho", total_cents: 760000, issued_at: today(), valid_until: addDays(today(), 30), accepted_at: null, current_version_no: 0 });
    expect(copy!.number).not.toBe(q.number);
    const { data: links } = await admin.db.from("attachment_links").select("attachment_id, evidence_role").eq("entity_type", "quote").eq("entity_id", copy!.id);
    expect(links).toEqual([{ attachment_id: photo.id, evidence_role: "local" }]);
  });
});

describe("B-12 — uma obra por orçamento", () => {
  it("duas inserções simultâneas com o mesmo orçamento deixam uma obra só", async () => {
    const q = await newQuote();
    const site = (n: number) => ({
      client_id: clientId,
      name: `Obra do orçamento ${n} (teste)`,
      code: `OQ-${randomUUID().slice(0, 8)}`,
      site_type: "unidade_recorrente" as const,
      quote_id: q.id,
    });
    const results = await Promise.all([admin.db.from("sites").insert(site(1)), admin.db.from("sites").insert(site(2))]);
    const failed = results.filter((r) => r.error);
    expect(failed).toHaveLength(1);
    expect(failed[0]!.error?.code).toBe("23505");
    expect(failed[0]!.error?.message).toContain("sites_quote_uidx");
    const { data } = await serviceClient().from("sites").select("id").eq("quote_id", q.id);
    expect(data).toHaveLength(1);
  });
});

describe("B-08 — orçamento salvo uma vez, sem itens duplicados", () => {
  const header = (extra: Record<string, unknown> = {}) => ({
    client_id: clientId,
    site_id: siteId,
    issued_at: today(),
    valid_until: addDays(today(), 30),
    title: "Reforma (teste B-08)",
    ...extra,
  });
  const item = (subtotal: number, label = "Cobertura") => ({
    location_label: label,
    title: null,
    pricing_mode: "global",
    quantity: null,
    unit: null,
    unit_price_cents: null,
    subtotal_cents: subtotal,
    lines: ["Serviço fictício"],
    notes: null,
    sort_order: 0,
  });
  const save = (key: string, items: ReturnType<typeof item>[], extra: { p_quote_id?: string; p_expected_updated_at?: string; header?: Record<string, unknown> } = {}) =>
    admin.db.rpc("quote_save", {
      p_client_request_id: key,
      p_header: header(extra.header),
      p_items: items,
      p_quote_id: extra.p_quote_id,
      p_expected_updated_at: extra.p_expected_updated_at,
    });
  async function itemsOf(quoteId: string) {
    const { data } = await admin.db.from("quote_items").select("subtotal_cents").eq("quote_id", quoteId).order("subtotal_cents");
    return (data ?? []).map((i) => i.subtotal_cents);
  }

  it("reenvio com a mesma chave não cria outro orçamento, nem em sequência nem ao mesmo tempo", async () => {
    const key = randomUUID();
    const first = await save(key, [item(100000)]);
    expect(first.error).toBeNull();
    const again = await save(key, [item(999999)]);
    expect(again.data).toMatchObject({ id: first.data!.id, number: first.data!.number, total_cents: 100000 });

    const twin = randomUUID();
    const [a, b] = await Promise.all([save(twin, [item(50000)]), save(twin, [item(50000)])]);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(a.data!.id).toBe(b.data!.id);
    const { count } = await admin.db.from("quotes").select("id", { count: "exact", head: true }).eq("client_request_id", twin);
    expect(count).toBe(1);
  });

  it("dois salvamentos simultâneos do mesmo rascunho deixam só os itens de um deles", async () => {
    const created = await save(randomUUID(), [item(10000)]);
    const id = created.data!.id;
    await Promise.all([
      save(randomUUID(), [item(100000, "A1"), item(200000, "A2")], { p_quote_id: id }),
      save(randomUUID(), [item(300000, "B1"), item(400000, "B2")], { p_quote_id: id }),
    ]);
    const items = await itemsOf(id);
    expect([[100000, 200000], [300000, 400000]]).toContainEqual(items);
    expect(await totalOf(id)).toBe(items[0]! + items[1]!);
  });

  it("edição com versão antiga é recusada e nada muda", async () => {
    const created = await save(randomUUID(), [item(10000)]);
    const opened = created.data!.updated_at;
    const first = await save(randomUUID(), [item(20000)], { p_quote_id: created.data!.id, p_expected_updated_at: opened });
    expect(first.error).toBeNull();
    const stale = await save(randomUUID(), [item(30000)], { p_quote_id: created.data!.id, p_expected_updated_at: opened });
    expect(stale.error?.hint).toBe("expectedUpdatedAt");
    expect(await itemsOf(created.data!.id)).toEqual([20000]);
  });

  it("reenvio da mesma edição devolve o orçamento sem erro de versão", async () => {
    const created = await save(randomUUID(), [item(10000)]);
    const key = randomUUID();
    const edit = { p_quote_id: created.data!.id, p_expected_updated_at: created.data!.updated_at };
    const first = await save(key, [item(20000)], edit);
    expect(first.error).toBeNull();
    const resent = await save(key, [item(20000)], edit);
    expect(resent.error).toBeNull();
    expect(resent.data).toMatchObject({ id: created.data!.id, total_cents: 20000 });
    expect(await itemsOf(created.data!.id)).toEqual([20000]);
  });

  it("fora de rascunho, salvar é recusado", async () => {
    const created = await save(randomUUID(), [item(760000)]);
    const q = created.data!;
    const sent = await admin.db.rpc("quote_transition", { p_quote_id: q.id, p_action: "enviar", p_snapshot: snapshotFor(q, 1, 760000) });
    expect(sent.error).toBeNull();
    const edit = await save(randomUUID(), [item(1)], { p_quote_id: q.id });
    expect(edit.error?.message).toContain("rascunho");
    expect(await itemsOf(q.id)).toEqual([760000]);
  });

  it("contato ou obra de outro cliente é recusado", async () => {
    const other = await createClientWithSite("Outro B-08");
    const wrongSite = await save(randomUUID(), [item(10000)], { header: { site_id: other.site.id } });
    expect(wrongSite.error?.hint).toBe("siteId");
    const noClient = await save(randomUUID(), [item(10000)], { header: { client_id: null } });
    expect(noClient.error?.hint).toBe("clientId");
  });

  it("funcionário e encarregado não chamam quote_save", async () => {
    for (const user of [worker, foreman]) {
      const { error } = await user.db.rpc("quote_save", { p_client_request_id: randomUUID(), p_header: header(), p_items: [item(10000)] });
      expect(error?.code).toBe("42501");
    }
  });
});

describe("B-22 — orçamento só com local do mesmo cliente", () => {
  it("orçamento com local de outro cliente é recusado pelo banco", async () => {
    const other = await createClientWithSite("Outro B-22 orçamento");
    const { error } = await admin.db
      .from("quotes")
      .insert({ number: "", client_id: clientId, site_id: other.site.id, title: "Local de outro cliente (teste)", created_by: admin.id });
    expect(error?.code).toBe("23503");
  });
});
