/**
 * Regras puras dos cadastros (clientes, responsáveis, locais, usuários, configurações e catálogos).
 * Validam a entrada dos formulários antes de gravar; o banco continua sendo a última barreira
 * (constraints e RLS). Erros vêm por campo, com o nome do input como chave.
 */
import type { ActionState } from "./action-errors";
import { isValidIsoDate } from "./dates";
import { fdStr, fdUuid, fdUuids } from "./form-data";

export type FieldErrors = Record<string, string>;
export type Parsed<T> = { ok: true; values: T } | { ok: false; fieldErrors: FieldErrors };

export type ClientKind = "pf" | "pj";
export type SiteType = "obra_temporaria" | "unidade_recorrente";
export type SiteStatus = "ativa" | "pausada" | "encerrada";
/** Papéis que a administração pode atribuir. "client" fica de fora enquanto a decisão Q1 (login do cliente) estiver pendente. */
export type StaffRole = "admin" | "worker" | "foreman";

export const CLIENT_KIND_LABEL: Record<ClientKind, string> = { pf: "Pessoa física", pj: "Pessoa jurídica" };
export const SITE_TYPE_LABEL: Record<SiteType, string> = {
  obra_temporaria: "Obra temporária",
  unidade_recorrente: "Unidade de manutenção recorrente",
};
export const SITE_STATUS_LABEL: Record<SiteStatus, string> = { ativa: "Ativa", pausada: "Pausada", encerrada: "Encerrada" };
export const STAFF_ROLES: StaffRole[] = ["admin", "worker", "foreman"];
export const MIN_PASSWORD_LENGTH = 8;

const CLIENT_KINDS = Object.keys(CLIENT_KIND_LABEL) as ClientKind[];
const SITE_TYPES = Object.keys(SITE_TYPE_LABEL) as SiteType[];
const SITE_STATUSES = Object.keys(SITE_STATUS_LABEL) as SiteStatus[];

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function checkDigit(digits: number[], weights: number[]): number {
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i]!, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const n = [...d].map(Number);
  const d1 = checkDigit(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = checkDigit(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === n[9] && d2 === n[10];
}

export function isValidCnpj(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const n = [...d].map(Number);
  const d1 = checkDigit(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = checkDigit(n.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === n[12] && d2 === n[13];
}

/** "52998224725" → "529.982.247-25"; CNPJ → "11.222.333/0001-81"; outros valores ficam como vieram. */
export function formatDocument(value: string): string {
  const d = onlyDigits(value);
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  return value.trim();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Texto de busca seguro para filtros do PostgREST (sem vírgulas, parênteses, curingas ou aspas). */
export function sanitizeSearch(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value.replace(/[,()*%"\\:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return clean === "" ? null : clean;
}

/** Código curto do local: maiúsculas, espaços viram hífen (ex.: "jex ta" → "JEX-TA"). */
export function normalizeSiteCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

const SITE_CODE_RE = /^[A-Z0-9][A-Z0-9._-]{0,29}$/;

// Leitores com limite de tamanho (o banco aceita textos longos, a tela não precisa).
function text(fd: FormData, key: string, max: number): string | null {
  const v = fdStr(fd, key);
  return v === null ? null : v.slice(0, max);
}

/** Inteiro opcional: null se vazio, NaN se inválido (para o chamador acusar o erro). */
function int(fd: FormData, key: string): number | null {
  const v = fdStr(fd, key);
  if (v === null) return null;
  return /^-?\d+$/.test(v) ? Number(v) : Number.NaN;
}

function result<T>(errors: FieldErrors, values: T): Parsed<T> {
  return Object.keys(errors).length > 0 ? { ok: false, fieldErrors: errors } : { ok: true, values };
}

function checkEmail(errors: FieldErrors, key: string, value: string | null) {
  if (value && !isValidEmail(value)) errors[key] = "Informe um e-mail válido (ex.: nome@empresa.com.br).";
}

// ---------------------------------------------------------------------------
// Clientes e responsáveis
// ---------------------------------------------------------------------------

export type ClientValues = {
  kind: ClientKind;
  legal_name: string;
  display_name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  address_text: string | null;
  billing_info: string | null;
  notes_internal: string | null;
};

export function parseClientForm(fd: FormData): Parsed<ClientValues> {
  const errors: FieldErrors = {};
  const kindRaw = fdStr(fd, "kind") ?? "pj";
  const kind = CLIENT_KINDS.includes(kindRaw as ClientKind) ? (kindRaw as ClientKind) : null;
  if (!kind) errors.kind = "Escolha pessoa física ou jurídica.";

  const legalName = text(fd, "legal_name", 200);
  if (!legalName) errors.legal_name = "Informe a razão social ou o nome completo.";
  const displayName = text(fd, "display_name", 120) ?? legalName ?? "";

  let document = fdStr(fd, "document");
  if (document && kind) {
    const valid = kind === "pf" ? isValidCpf(document) : isValidCnpj(document);
    if (!valid) errors.document = kind === "pf" ? "CPF inválido. Confira os 11 números." : "CNPJ inválido. Confira os 14 números.";
    else document = formatDocument(document);
  }

  const email = text(fd, "email", 200)?.toLowerCase() ?? null;
  checkEmail(errors, "email", email);

  return result(errors, {
    kind: kind ?? "pj",
    legal_name: legalName ?? "",
    display_name: displayName,
    document,
    email,
    phone: text(fd, "phone", 40),
    address_text: text(fd, "address_text", 500),
    billing_info: text(fd, "billing_info", 2000),
    notes_internal: text(fd, "notes_internal", 2000),
  });
}

export type ContactValues = {
  name: string;
  email: string | null;
  phone: string | null;
  role_title: string | null;
  site_ids: string[];
};

export function parseContactForm(fd: FormData): Parsed<ContactValues> {
  const errors: FieldErrors = {};
  const name = text(fd, "name", 160);
  if (!name) errors.name = "Informe o nome.";
  const email = text(fd, "email", 200)?.toLowerCase() ?? null;
  checkEmail(errors, "email", email);
  return result(errors, {
    name: name ?? "",
    email,
    phone: text(fd, "phone", 40),
    role_title: text(fd, "role_title", 120),
    site_ids: fdUuids(fd, "site_ids"),
  });
}

// ---------------------------------------------------------------------------
// Locais, setores e equipe
// ---------------------------------------------------------------------------

export type SiteValues = {
  name: string;
  code: string;
  site_type: SiteType;
  status: SiteStatus;
  address_text: string | null;
  planned_start: string | null;
  planned_end: string | null;
  notes_internal: string | null;
};

export function parseSiteForm(fd: FormData): Parsed<SiteValues> {
  const errors: FieldErrors = {};
  const name = text(fd, "name", 160);
  if (!name) errors.name = "Informe o nome do local.";

  const codeRaw = fdStr(fd, "code");
  const code = codeRaw ? normalizeSiteCode(codeRaw) : "";
  if (!code) errors.code = "Informe um código curto (ex.: JEX-TA).";
  else if (!SITE_CODE_RE.test(code)) errors.code = "Use até 30 letras sem acento, números ou hífen (ex.: JEX-TA).";

  const typeRaw = fdStr(fd, "site_type");
  const siteType = SITE_TYPES.includes(typeRaw as SiteType) ? (typeRaw as SiteType) : null;
  if (!siteType) errors.site_type = "Escolha o tipo do local.";

  const statusRaw = fdStr(fd, "status") ?? "ativa";
  const status = SITE_STATUSES.includes(statusRaw as SiteStatus) ? (statusRaw as SiteStatus) : null;
  if (!status) errors.status = "Situação inválida.";

  const startRaw = fdStr(fd, "planned_start");
  const endRaw = fdStr(fd, "planned_end");
  const start = startRaw && isValidIsoDate(startRaw) ? startRaw : null;
  const end = endRaw && isValidIsoDate(endRaw) ? endRaw : null;
  if (startRaw && !start) errors.planned_start = "Data inválida.";
  if (endRaw && !end) errors.planned_end = "Data inválida.";
  if (start && end && end < start) errors.planned_end = "O término previsto não pode ser antes do início.";

  return result(errors, {
    name: name ?? "",
    code,
    site_type: siteType ?? "obra_temporaria",
    status: status ?? "ativa",
    address_text: text(fd, "address_text", 500),
    planned_start: start,
    planned_end: end,
    notes_internal: text(fd, "notes_internal", 2000),
  });
}

export function parseAreaForm(fd: FormData): Parsed<{ name: string; sort_order: number }> {
  const errors: FieldErrors = {};
  const name = text(fd, "name", 120);
  if (!name) errors.name = "Informe o nome do setor ou ambiente.";
  const order = int(fd, "sort_order");
  if (order !== null && (!Number.isInteger(order) || order < 0 || order > 9999)) errors.sort_order = "Use um número inteiro de 0 a 9999.";
  return result(errors, { name: name ?? "", sort_order: order ?? 0 });
}

export function parseMembershipForm(fd: FormData, today: string): Parsed<{ profile_id: string; active_from: string }> {
  const errors: FieldErrors = {};
  const profileId = fdUuid(fd, "profile_id");
  if (!profileId) errors.profile_id = "Escolha a pessoa.";
  const fromRaw = fdStr(fd, "active_from");
  const from = fromRaw ?? today;
  if (!isValidIsoDate(from)) errors.active_from = "Data inválida.";
  else if (from > today) errors.active_from = "A data de início não pode ser futura. Dê o acesso no dia em que a pessoa começar.";
  return result(errors, { profile_id: profileId ?? "", active_from: from });
}

// ---------------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------------

export type UserValues = {
  full_name: string;
  email: string | null;
  phone: string | null;
  role: StaffRole;
  password: string | null;
};

export function parseUserForm(
  fd: FormData,
  options: { requirePassword: boolean; requireEmail?: boolean },
): Parsed<UserValues> {
  const errors: FieldErrors = {};
  const fullName = text(fd, "full_name", 160);
  if (!fullName) errors.full_name = "Informe o nome completo.";

  const email = text(fd, "email", 200)?.toLowerCase() ?? null;
  if (options.requireEmail !== false && !email) errors.email = "Informe o e-mail de acesso.";
  checkEmail(errors, "email", email);

  const roleRaw = fdStr(fd, "role");
  const role = STAFF_ROLES.includes(roleRaw as StaffRole) ? (roleRaw as StaffRole) : null;
  if (!role) errors.role = "Escolha o papel: administração, funcionário ou encarregado.";

  // Senha não é aparada: espaços podem fazer parte dela.
  const rawPassword = fd.get("password");
  const password = typeof rawPassword === "string" && rawPassword !== "" ? rawPassword : null;
  if (options.requirePassword && !password) errors.password = `Defina uma senha inicial com ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  else if (password && password.length < MIN_PASSWORD_LENGTH) errors.password = `A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;

  return result(errors, { full_name: fullName ?? "", email, phone: text(fd, "phone", 40), role: role ?? "worker", password });
}

export function parsePasswordForm(fd: FormData): Parsed<{ password: string }> {
  const errors: FieldErrors = {};
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) errors.password = `A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  else if (password !== confirm) errors.confirm = "Repita a mesma senha.";
  return result(errors, { password });
}

/** Impede que a administração tire o próprio acesso (evita ficar sem nenhum administrador). */
export function guardSelfChange(input: { actorId: string; targetId: string; nextRole?: string; nextActive?: boolean }): string | null {
  if (input.actorId !== input.targetId) return null;
  if (input.nextActive === false) return "Você não pode desativar o próprio acesso. Peça a outro administrador.";
  if (input.nextRole !== undefined && input.nextRole !== "admin") return "Você não pode alterar o próprio papel. Peça a outro administrador.";
  return null;
}

// ---------------------------------------------------------------------------
// Configurações da empresa
// ---------------------------------------------------------------------------

export type SettingsValues = {
  trade_name: string;
  legal_name: string;
  cnpj: string | null;
  address_text: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  technical_manager_name: string | null;
  technical_manager_title: string | null;
  crea: string | null;
  report_footer_text: string | null;
  report_city: string | null;
  report_objective_text: string;
  quote_intro_text: string;
  quote_declaration_text: string | null;
  max_image_mb: number;
  max_pdf_mb: number;
  max_files_per_upload: number;
  activity_backdate_limit_days: number;
  retention_policy: string | null;
};

const SETTINGS_LIMITS = {
  max_image_mb: { min: 1, max: 100, label: "MB" },
  max_pdf_mb: { min: 1, max: 100, label: "MB" },
  max_files_per_upload: { min: 1, max: 100, label: "arquivos" },
  activity_backdate_limit_days: { min: 0, max: 365, label: "dias" },
} as const;

export function parseSettingsForm(fd: FormData): Parsed<SettingsValues> {
  const errors: FieldErrors = {};
  const tradeName = text(fd, "trade_name", 120);
  if (!tradeName) errors.trade_name = "Informe o nome fantasia.";
  const objective = text(fd, "report_objective_text", 2000);
  if (!objective) errors.report_objective_text = "Informe o objetivo padrão do relatório.";
  const intro = text(fd, "quote_intro_text", 2000);
  if (!intro) errors.quote_intro_text = "Informe o texto de abertura do orçamento.";

  // Só confere a quantidade de números: o CNPJ oficial ainda está para confirmar (Q2).
  const cnpj = text(fd, "cnpj", 30);
  if (cnpj && onlyDigits(cnpj).length !== 14) errors.cnpj = "O CNPJ tem 14 números.";
  const email = text(fd, "email", 200)?.toLowerCase() ?? null;
  checkEmail(errors, "email", email);

  const numbers = {} as Record<keyof typeof SETTINGS_LIMITS, number>;
  for (const [key, lim] of Object.entries(SETTINGS_LIMITS) as Array<[keyof typeof SETTINGS_LIMITS, (typeof SETTINGS_LIMITS)[keyof typeof SETTINGS_LIMITS]]>) {
    const n = int(fd, key);
    if (n === null || !Number.isInteger(n) || n < lim.min || n > lim.max) {
      errors[key] = `Use um número inteiro de ${lim.min} a ${lim.max} ${lim.label}.`;
    } else numbers[key] = n;
  }

  return result(errors, {
    trade_name: tradeName ?? "",
    legal_name: text(fd, "legal_name", 200) ?? "",
    cnpj,
    address_text: text(fd, "address_text", 500),
    phone: text(fd, "phone", 40),
    email,
    website: text(fd, "website", 200),
    technical_manager_name: text(fd, "technical_manager_name", 160),
    technical_manager_title: text(fd, "technical_manager_title", 120),
    crea: text(fd, "crea", 60),
    report_footer_text: text(fd, "report_footer_text", 1000),
    report_city: text(fd, "report_city", 120),
    report_objective_text: objective ?? "",
    quote_intro_text: intro ?? "",
    quote_declaration_text: text(fd, "quote_declaration_text", 4000),
    max_image_mb: numbers.max_image_mb,
    max_pdf_mb: numbers.max_pdf_mb,
    max_files_per_upload: numbers.max_files_per_upload,
    activity_backdate_limit_days: numbers.activity_backdate_limit_days,
    retention_policy: text(fd, "retention_policy", 4000),
  });
}

// ---------------------------------------------------------------------------
// Catálogos (sem exclusão física: só ativar/desativar)
// ---------------------------------------------------------------------------

export type CatalogTable =
  | "service_categories"
  | "priority_definitions"
  | "pending_reasons"
  | "suppliers"
  | "expense_categories"
  | "payment_methods"
  | "task_kinds";

export type CatalogDef = {
  slug: string;
  table: CatalogTable;
  title: string;
  singular: string;
  description: string;
  extra: "priority" | "supplier" | null;
};

export const CATALOGS: CatalogDef[] = [
  {
    slug: "categorias",
    table: "service_categories",
    title: "Categorias de serviço",
    singular: "categoria",
    description: "Classificam os chamados (hidráulica, elétrica, pintura…).",
    extra: null,
  },
  {
    slug: "prioridades",
    table: "priority_definitions",
    title: "Prioridades",
    singular: "prioridade",
    description: "Nível de urgência dos chamados e prazo padrão em dias (opcional).",
    extra: "priority",
  },
  {
    slug: "motivos-pendencia",
    table: "pending_reasons",
    title: "Motivos de pendência",
    singular: "motivo",
    description: "O que a equipe escolhe ao informar que um serviço parou.",
    extra: null,
  },
  {
    slug: "tipos-tarefa",
    table: "task_kinds",
    title: "Tipos de tarefa",
    singular: "tipo",
    description: "Vistoria, visita técnica, recebimento de material…",
    extra: null,
  },
  {
    slug: "fornecedores",
    table: "suppliers",
    title: "Fornecedores",
    singular: "fornecedor",
    description: "Lojas e prestadores usados nas compras e despesas.",
    extra: "supplier",
  },
  {
    slug: "categorias-despesa",
    table: "expense_categories",
    title: "Categorias de despesa",
    singular: "categoria",
    description: "Agrupam compras e despesas no financeiro interno.",
    extra: null,
  },
  {
    slug: "formas-pagamento",
    table: "payment_methods",
    title: "Formas de pagamento",
    singular: "forma",
    description: "PIX, dinheiro, cartão…",
    extra: null,
  },
];

export function catalogBySlug(slug: string): CatalogDef | null {
  return CATALOGS.find((c) => c.slug === slug) ?? null;
}

export type CatalogValues =
  | { name: string; sort_order: number }
  | { name: string; sort_order: number; level: number; sla_days: number | null }
  | { name: string; sort_order: number; document: string | null; phone: string | null; notes: string | null };

export function parseCatalogForm(fd: FormData, def: CatalogDef): Parsed<CatalogValues> {
  const errors: FieldErrors = {};
  const name = text(fd, "name", 120);
  if (!name) errors.name = "Informe o nome.";
  const order = int(fd, "sort_order");
  if (order !== null && (!Number.isInteger(order) || order < 0 || order > 9999)) errors.sort_order = "Use um número inteiro de 0 a 9999.";
  const base = { name: name ?? "", sort_order: order ?? 0 };

  if (def.extra === "priority") {
    const level = int(fd, "level");
    if (level !== null && (!Number.isInteger(level) || level < 0 || level > 99)) errors.level = "Use um número inteiro de 0 a 99.";
    const sla = int(fd, "sla_days");
    if (sla !== null && (!Number.isInteger(sla) || sla < 0 || sla > 365)) errors.sla_days = "Use um número inteiro de 0 a 365, ou deixe em branco.";
    return result(errors, { ...base, level: level ?? 0, sla_days: sla });
  }
  if (def.extra === "supplier") {
    return result(errors, { ...base, document: text(fd, "document", 30), phone: text(fd, "phone", 40), notes: text(fd, "notes", 1000) });
  }
  return result(errors, base);
}

// ---------------------------------------------------------------------------
// Erros do banco
// ---------------------------------------------------------------------------

export type UniqueRule = { constraint: string; field: string; message: string };

/** Violação de unicidade conhecida → mensagem amigável no campo certo; null se não for o caso. */
export function friendlyUniqueViolation(error: unknown, rules: UniqueRule[]): ActionState<never> | null {
  const e = (error ?? {}) as { code?: string; message?: string };
  if (e.code !== "23505") return null;
  const rule = rules.find((r) => (e.message ?? "").includes(`"${r.constraint}"`));
  return rule ? { ok: false, message: rule.message, fieldErrors: { [rule.field]: rule.message } } : null;
}
