import { describe, expect, it } from "vitest";
import {
  CATALOGS,
  CLIENT_DOCUMENT_UNIQUE,
  catalogBySlug,
  formatDocument,
  friendlyUniqueViolation,
  guardSelfChange,
  isValidCnpj,
  isValidCpf,
  isValidEmail,
  normalizeSiteCode,
  parseAreaForm,
  parseCatalogForm,
  parseClientForm,
  parseContactForm,
  parseMembershipForm,
  parsePasswordForm,
  parseSettingsForm,
  parseSiteForm,
  parseUserForm,
  sanitizeSearch,
} from "./registry";

const U1 = "0b8f6a3e-2c1d-4e5f-8a9b-1c2d3e4f5a6b";
const U2 = "1c9a7b4f-3d2e-4f6a-9b8c-2d3e4f5a6b7c";

function fd(entries: Array<[string, string]>) {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

// Documentos fictícios gerados apenas para teste (dígitos verificadores válidos).
const CPF_OK = "529.982.247-25";
const CNPJ_OK = "11.222.333/0001-81";

describe("documentos e contato", () => {
  it("valida CPF e CNPJ pelos dígitos verificadores", () => {
    expect(isValidCpf(CPF_OK)).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCnpj(CNPJ_OK)).toBe(true);
    expect(isValidCnpj("11222333000182")).toBe(false);
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false);
  });

  it("formata o documento no padrão brasileiro", () => {
    expect(formatDocument("52998224725")).toBe(CPF_OK);
    expect(formatDocument("11222333000181")).toBe(CNPJ_OK);
    expect(formatDocument("123")).toBe("123");
  });

  it("aceita e-mails comuns e recusa os malformados", () => {
    expect(isValidEmail("ana@empresa.com.br")).toBe(true);
    expect(isValidEmail("ana@empresa")).toBe(false);
    expect(isValidEmail("ana empresa@x.com")).toBe(false);
  });

  it("limpa a busca de caracteres que quebram o filtro", () => {
    expect(sanitizeSearch("  Condomínio (Torre), A*%  ")).toBe("Condomínio Torre A");
    expect(sanitizeSearch("   ")).toBeNull();
    expect(sanitizeSearch(null)).toBeNull();
    expect(sanitizeSearch("x".repeat(200))?.length).toBe(80);
  });

  it("normaliza o código do local", () => {
    expect(normalizeSiteCode("  jex ta ")).toBe("JEX-TA");
    expect(normalizeSiteCode("imo-gal")).toBe("IMO-GAL");
  });
});

describe("cliente", () => {
  it("exige razão social e usa o nome de exibição padrão", () => {
    const r = parseClientForm(fd([["kind", "pj"], ["legal_name", "  Condomínio Exemplo  "], ["email", "Sindico@Exemplo.com"]]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.legal_name).toBe("Condomínio Exemplo");
    expect(r.values.display_name).toBe("Condomínio Exemplo");
    expect(r.values.email).toBe("sindico@exemplo.com");
    expect(r.values.document).toBeNull();
  });

  it("recusa documento incompatível com o tipo e e-mail inválido", () => {
    const r = parseClientForm(fd([["kind", "pj"], ["legal_name", "X"], ["document", CPF_OK], ["email", "x@"]]));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fieldErrors.document).toMatch(/CNPJ/);
    expect(r.fieldErrors.email).toBeTruthy();
  });

  it("aceita CPF para pessoa física e grava formatado", () => {
    const r = parseClientForm(fd([["kind", "pf"], ["legal_name", "Maria"], ["document", "52998224725"]]));
    expect(r.ok && r.values.document).toBe(CPF_OK);
  });

  it("sem razão social devolve erro no campo", () => {
    const r = parseClientForm(fd([["kind", "pj"]]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fieldErrors)).toEqual(["legal_name"]);
  });
});

describe("responsável do cliente", () => {
  it("exige nome e mantém só locais válidos", () => {
    const r = parseContactForm(fd([["name", "Síndica"], ["site_ids", U1], ["site_ids", "x"], ["site_ids", U2]]));
    expect(r.ok && r.values.site_ids).toEqual([U1, U2]);
    const bad = parseContactForm(fd([["email", "sem-arroba"]]));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.fieldErrors).sort()).toEqual(["email", "name"]);
  });
});

describe("local", () => {
  const base: Array<[string, string]> = [
    ["name", "Torre C"],
    ["code", "jex tc"],
    ["site_type", "unidade_recorrente"],
  ];

  it("acesso e responsáveis do local (B-21): textos aparados, ids validados, vazios nulos", () => {
    const profile = "11111111-1111-4111-8111-111111111111";
    const contact = "22222222-2222-4222-8222-222222222222";
    const r = parseSiteForm(
      fd([
        ...base,
        ["access_hours", "  Seg a sex, 7h às 17h  "],
        ["access_instructions", "Retirar a chave na portaria."],
        ["responsible_profile_id", profile],
        ["client_responsible_contact_id", contact],
      ]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values).toMatchObject({
      access_hours: "Seg a sex, 7h às 17h",
      access_instructions: "Retirar a chave na portaria.",
      responsible_profile_id: profile,
      client_responsible_contact_id: contact,
    });
    const empty = parseSiteForm(fd(base));
    expect(empty.ok && [empty.values.access_hours, empty.values.responsible_profile_id, empty.values.client_responsible_contact_id]).toEqual([null, null, null]);
    const bad = parseSiteForm(fd([...base, ["responsible_profile_id", "x"], ["access_hours", "a".repeat(201)]]));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.fieldErrors).sort()).toEqual(["access_hours", "responsible_profile_id"]);
  });

  it("normaliza o código e aceita datas em ordem", () => {
    const r = parseSiteForm(fd([...base, ["planned_start", "2026-10-01"], ["planned_end", "2026-12-20"]]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.code).toBe("JEX-TC");
    expect(r.values.status).toBe("ativa");
  });

  it("recusa término antes do início, tipo e código inválidos", () => {
    const r = parseSiteForm(
      fd([["name", "Obra"], ["code", "çç!"], ["site_type", "outro"], ["planned_start", "2026-10-10"], ["planned_end", "2026-10-01"]]),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.fieldErrors).sort()).toEqual(["code", "planned_end", "site_type"]);
  });

  it("situação só aceita os valores conhecidos", () => {
    const r = parseSiteForm(fd([...base, ["status", "pausada"]]));
    expect(r.ok && r.values.status).toBe("pausada");
    const bad = parseSiteForm(fd([...base, ["status", "apagada"]]));
    expect(bad.ok).toBe(false);
  });

  it("setor exige nome; ordem é inteira e opcional", () => {
    expect(parseAreaForm(fd([["name", " Hall "]]))).toEqual({ ok: true, values: { name: "Hall", sort_order: 0 } });
    expect(parseAreaForm(fd([["name", "Hall"], ["sort_order", "3"]]))).toEqual({ ok: true, values: { name: "Hall", sort_order: 3 } });
    expect(parseAreaForm(fd([["name", ""]])).ok).toBe(false);
    expect(parseAreaForm(fd([["name", "Hall"], ["sort_order", "1,5"]])).ok).toBe(false);
  });

  it("vínculo começa hoje por padrão e não aceita data futura", () => {
    const today = "2026-10-25";
    expect(parseMembershipForm(fd([["profile_id", U1]]), today)).toEqual({ ok: true, values: { profile_id: U1, active_from: today } });
    const future = parseMembershipForm(fd([["profile_id", U1], ["active_from", "2026-10-26"]]), today);
    expect(future.ok).toBe(false);
    const none = parseMembershipForm(fd([]), today);
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.fieldErrors.profile_id).toBeTruthy();
  });
});

describe("usuários", () => {
  const base: Array<[string, string]> = [
    ["full_name", "Paulo Teste"],
    ["email", " Paulo@Exemplo.com "],
    ["role", "worker"],
  ];

  it("cria com senha de 8+ caracteres e e-mail em minúsculas", () => {
    const r = parseUserForm(fd([...base, ["password", "12345678"]]), { requirePassword: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.email).toBe("paulo@exemplo.com");
    expect(r.values.password).toBe("12345678");
  });

  it("nunca aceita o papel de cliente enquanto a decisão Q1 está pendente", () => {
    const r = parseUserForm(fd([...base.filter(([k]) => k !== "role"), ["role", "client"], ["password", "12345678"]]), {
      requirePassword: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.role).toBeTruthy();
  });

  it("senha curta ou ausente na criação", () => {
    const short = parseUserForm(fd([...base, ["password", "1234567"]]), { requirePassword: true });
    expect(short.ok).toBe(false);
    const edit = parseUserForm(fd([["full_name", "Paulo"], ["role", "foreman"]]), { requirePassword: false, requireEmail: false });
    expect(edit.ok).toBe(true);
  });

  it("senha provisória exige confirmação igual", () => {
    expect(parsePasswordForm(fd([["password", "abcdefgh"], ["confirm", "abcdefgh"]])).ok).toBe(true);
    const diff = parsePasswordForm(fd([["password", "abcdefgh"], ["confirm", "abcdefgx"]]));
    expect(diff.ok).toBe(false);
    if (!diff.ok) expect(diff.fieldErrors.confirm).toBeTruthy();
  });

  it("administrador não desativa nem rebaixa a si mesmo", () => {
    const me = U1;
    expect(guardSelfChange({ actorId: me, targetId: me, nextActive: false })).toMatch(/próprio acesso/);
    expect(guardSelfChange({ actorId: me, targetId: me, nextRole: "worker" })).toMatch(/próprio papel/);
    expect(guardSelfChange({ actorId: me, targetId: me, nextRole: "admin", nextActive: true })).toBeNull();
    expect(guardSelfChange({ actorId: me, targetId: U2, nextActive: false, nextRole: "worker" })).toBeNull();
  });
});

describe("configurações da empresa", () => {
  const required: Array<[string, string]> = [
    ["trade_name", "Megagyn"],
    ["report_objective_text", "Objetivo"],
    ["quote_intro_text", "Intro"],
    ["max_image_mb", "15"],
    ["max_pdf_mb", "20"],
    ["max_files_per_upload", "20"],
    ["activity_backdate_limit_days", "7"],
  ];

  it("aceita os campos e converte vazios em null", () => {
    const r = parseSettingsForm(fd([...required, ["cnpj", "11.222.333/0001-81"], ["website", "site-a-confirmar.example"], ["crea", ""]]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.crea).toBeNull();
    expect(r.values.legal_name).toBe("");
    expect(r.values.max_image_mb).toBe(15);
    expect(r.values.cnpj).toBe("11.222.333/0001-81");
  });

  it("CNPJ com dígito verificador errado é recusado (B-27)", () => {
    for (const cnpj of ["11.222.333/0001-82", "00.000.000/0000-00"]) {
      const r = parseSettingsForm(fd([...required, ["cnpj", cnpj]]));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.fieldErrors.cnpj).toBe("CNPJ inválido. Confira os 14 números ou deixe em branco.");
    }
  });

  it("CNPJ válido sem pontuação é aceito e gravado formatado; vazio fica nulo (B-27)", () => {
    const r = parseSettingsForm(fd([...required, ["cnpj", "11222333000181"]]));
    expect(r.ok && r.values.cnpj).toBe("11.222.333/0001-81");
    const empty = parseSettingsForm(fd([...required, ["cnpj", ""]]));
    expect(empty.ok && empty.values.cnpj).toBeNull();
  });

  it("limites fora da faixa e CNPJ incompleto", () => {
    const r = parseSettingsForm(
      fd([
        ...required.filter(([k]) => k !== "max_image_mb" && k !== "activity_backdate_limit_days"),
        ["max_image_mb", "0"],
        ["activity_backdate_limit_days", "400"],
        ["cnpj", "123"],
      ]),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.fieldErrors).sort()).toEqual(["activity_backdate_limit_days", "cnpj", "max_image_mb"]);
  });

  it("nome fantasia e textos padrão são obrigatórios", () => {
    const r = parseSettingsForm(fd([]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.trade_name).toBeTruthy();
  });
});

describe("catálogos", () => {
  it("todos os catálogos têm slug único e tabela conhecida", () => {
    const slugs = CATALOGS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(CATALOGS.map((c) => c.table).sort()).toEqual(
      ["expense_categories", "payment_methods", "pending_reasons", "priority_definitions", "service_categories", "suppliers", "task_kinds"].sort(),
    );
    expect(catalogBySlug("prioridades")?.table).toBe("priority_definitions");
    expect(catalogBySlug("nao-existe")).toBeNull();
  });

  it("prioridade exige nível inteiro e prazo opcional não negativo", () => {
    const def = catalogBySlug("prioridades")!;
    const r = parseCatalogForm(fd([["name", "Crítica"], ["level", "5"], ["sla_days", "1"], ["sort_order", "5"]]), def);
    expect(r).toEqual({ ok: true, values: { name: "Crítica", sort_order: 5, level: 5, sla_days: 1 } });
    const bad = parseCatalogForm(fd([["name", "Crítica"], ["sla_days", "-1"]]), def);
    expect(bad.ok).toBe(false);
  });

  it("fornecedor guarda documento, telefone e observações", () => {
    const def = catalogBySlug("fornecedores")!;
    const r = parseCatalogForm(fd([["name", "Casa do Construtor"], ["phone", "(62) 0000-0000"]]), def);
    expect(r).toEqual({
      ok: true,
      values: { name: "Casa do Construtor", sort_order: 0, document: null, phone: "(62) 0000-0000", notes: null },
    });
  });

  it("catálogo simples só tem nome e ordem", () => {
    const def = catalogBySlug("motivos-pendencia")!;
    expect(parseCatalogForm(fd([["name", "Chuva"], ["level", "9"]]), def)).toEqual({ ok: true, values: { name: "Chuva", sort_order: 0 } });
    expect(parseCatalogForm(fd([["name", " "]]), def).ok).toBe(false);
  });
});

describe("mensagens de duplicidade", () => {
  const rules = [{ constraint: "sites_code_key", field: "code", message: "Já existe um local com este código." }];

  it("traduz a violação de unicidade conhecida para o campo", () => {
    const state = friendlyUniqueViolation({ code: "23505", message: 'duplicate key value violates unique constraint "sites_code_key"' }, rules);
    expect(state).toEqual({ ok: false, message: "Já existe um local com este código.", fieldErrors: { code: "Já existe um local com este código." } });
  });

  it("CPF/CNPJ repetido vira erro no campo do documento (B-17)", () => {
    const pg = { code: "23505", message: 'duplicate key value violates unique constraint "clients_document_digits_uidx"' };
    expect(friendlyUniqueViolation(pg, [CLIENT_DOCUMENT_UNIQUE])).toEqual({
      ok: false,
      message: "CPF/CNPJ já cadastrado.",
      fieldErrors: { document: "CPF/CNPJ já cadastrado." },
    });
  });

  it("ignora outros erros", () => {
    expect(friendlyUniqueViolation({ code: "23503", message: "fk" }, rules)).toBeNull();
    expect(friendlyUniqueViolation({ code: "23505", message: 'constraint "outra"' }, rules)).toBeNull();
    expect(friendlyUniqueViolation(null, rules)).toBeNull();
  });
});
