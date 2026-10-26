-- Megagyn Service — Fundação: perfis, papéis, escopo por local, cadastros, catálogos, auditoria.
-- Regras: RLS em todas as tabelas; escrita sensível só por funções (RPC) com checagem interna.
-- O papel 'client' existe no enum para evitar migração de tipo futura, mas NENHUMA política
-- concede acesso a ele enquanto a decisão Q1 (login do cliente) estiver pendente.

create extension if not exists btree_gist with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'worker', 'foreman', 'client');
create type public.site_type as enum ('obra_temporaria', 'unidade_recorrente');
create type public.site_status as enum ('ativa', 'pausada', 'encerrada');
create type public.client_kind as enum ('pf', 'pj');

-- ---------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------
create or replace function public.today_sp() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

create or replace function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function private.forbid_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Registro histórico não pode ser alterado nem excluído (%).', tg_table_name
    using errcode = '42501';
end $$;

-- "R$ 1.234,56" para mensagens de erro.
create or replace function private.brl(c bigint) returns text
language sql immutable set search_path = '' as $$
  select case when c < 0 then '-' else '' end || 'R$ '
    || translate(to_char(abs(c)::numeric / 100, 'FM999,999,999,990.00'), ',.', '.,')
$$;

-- ---------------------------------------------------------------------------
-- Perfis (1:1 com auth.users). Nunca excluídos: inativação preserva autorias.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  full_name text not null check (length(trim(full_name)) > 0),
  email text not null,
  phone text,
  role public.user_role not null,
  is_active boolean not null default true,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- Papel do usuário logado (null se inativo ou sem perfil). Lê a tabela a cada
-- chamada: inativação corta o acesso imediatamente, sem esperar o JWT expirar.
create or replace function public.current_app_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

-- Equipe Megagyn (administração + campo).
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() in ('admin', 'worker', 'foreman'), false)
$$;

-- ---------------------------------------------------------------------------
-- Configuração da empresa (linha única). Dados divergentes nos PDFs de origem
-- → tudo editável; nada codificado.
-- ---------------------------------------------------------------------------
create table public.company_settings (
  id smallint primary key default 1 check (id = 1),
  legal_name text not null default '',
  trade_name text not null default 'Megagyn',
  cnpj text,
  address_text text,
  phone text,
  email text,
  website text,
  logo_attachment_id uuid,
  signature_attachment_id uuid,
  technical_manager_name text,
  technical_manager_title text,
  crea text,
  report_footer_text text,
  report_city text,
  report_objective_text text not null default 'Apresentação dos serviços realizados, carga horária trabalhada e pendências do período.',
  quote_intro_text text not null default 'Segue o orçamento conforme solicitado.',
  quote_declaration_text text,
  max_image_mb integer not null default 15 check (max_image_mb between 1 and 100),
  max_pdf_mb integer not null default 20 check (max_pdf_mb between 1 and 100),
  max_files_per_upload integer not null default 20 check (max_files_per_upload between 1 and 100),
  activity_backdate_limit_days integer not null default 7 check (activity_backdate_limit_days between 0 and 365),
  retention_policy text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);
insert into public.company_settings (id) values (1);
create trigger company_settings_updated_at before update on public.company_settings
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Clientes, contatos (pessoas SEM conta por padrão — ver Q1), locais e ambientes
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  kind public.client_kind not null default 'pj',
  legal_name text not null check (length(trim(legal_name)) > 0),
  display_name text not null check (length(trim(display_name)) > 0),
  document text,
  email text,
  phone text,
  address_text text,
  billing_info text,
  notes_internal text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger clients_updated_at before update on public.clients
  for each row execute function private.set_updated_at();

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  name text not null check (length(trim(name)) > 0),
  email text,
  phone text,
  role_title text,
  -- Preenchido somente se o cenário A (login do cliente) for confirmado.
  user_id uuid unique references public.profiles (id),
  is_active boolean not null default true,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_contacts_client_idx on public.client_contacts (client_id);
create trigger client_contacts_updated_at before update on public.client_contacts
  for each row execute function private.set_updated_at();

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  name text not null check (length(trim(name)) > 0),
  code text not null unique check (length(trim(code)) > 0),
  site_type public.site_type not null,
  status public.site_status not null default 'ativa',
  address_text text,
  planned_start date,
  planned_end date,
  notes_internal text,
  quote_id uuid,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, client_id),
  check (planned_end is null or planned_start is null or planned_end >= planned_start)
);
create index sites_client_status_idx on public.sites (client_id, status);
create trigger sites_updated_at before update on public.sites
  for each row execute function private.set_updated_at();

create table public.site_areas (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id),
  name text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (site_id, name),
  unique (id, site_id)
);

create table public.client_contact_sites (
  client_contact_id uuid not null references public.client_contacts (id),
  site_id uuid not null references public.sites (id),
  can_open_requests boolean not null default true,
  can_view_reports boolean not null default true,
  primary key (client_contact_id, site_id)
);

-- Vínculo de pessoa da equipe com local (escopo de acesso de campo).
create table public.site_memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  site_id uuid not null references public.sites (id),
  active_from date not null default public.today_sp(),
  active_to date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (active_to is null or active_to >= active_from)
);
create unique index site_memberships_open_uidx on public.site_memberships (profile_id, site_id) where active_to is null;
create index site_memberships_site_idx on public.site_memberships (site_id);

-- Acesso a um local: administração vê tudo; campo vê locais com vínculo ativo;
-- qualquer outro papel (inclusive 'client', pendente) não vê nada.
create or replace function public.has_site_access(p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when r = 'admin' then true
    when r in ('worker', 'foreman') then exists (
      select 1 from public.site_memberships m
      where m.profile_id = auth.uid()
        and m.site_id = p_site
        and m.active_from <= public.today_sp()
        and (m.active_to is null or m.active_to >= public.today_sp())
    )
    else false
  end
  from (select public.current_app_role() as r) x
$$;

-- O perfil tem vínculo ativo com o local? (validação de atribuições)
create or replace function private.profile_can_work_at(p_profile uuid, p_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile and p.is_active and (
      p.role = 'admin' or (p.role in ('worker', 'foreman') and exists (
        select 1 from public.site_memberships m
        where m.profile_id = p.id and m.site_id = p_site
          and m.active_from <= public.today_sp()
          and (m.active_to is null or m.active_to >= public.today_sp())
      ))
    )
  )
$$;

-- ---------------------------------------------------------------------------
-- Catálogos editáveis (nunca excluídos fisicamente: is_active)
-- ---------------------------------------------------------------------------
create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.priority_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  level integer not null default 0,
  sla_days integer check (sla_days is null or sla_days >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.pending_reasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  document text,
  phone text,
  notes text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.task_kinds (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Valores iniciais editáveis (Word §3 e §4).
insert into public.pending_reasons (name, sort_order) values
  ('Falta de material', 1), ('Aguardando autorização', 2), ('Sem acesso ao local', 3),
  ('Depende de terceiro', 4), ('Outro motivo', 5);
insert into public.priority_definitions (name, level, sla_days, sort_order) values
  ('Baixa', 1, null, 1), ('Média', 2, null, 2), ('Alta', 3, null, 3), ('Urgente', 4, null, 4);
insert into public.service_categories (name, sort_order) values
  ('Hidráulica', 1), ('Elétrica', 2), ('Alvenaria', 3), ('Pintura', 4), ('Acabamento', 5),
  ('Cobertura', 6), ('Limpeza', 7), ('Serralheria', 8), ('Outros', 99);
insert into public.expense_categories (name, sort_order) values
  ('Material hidráulico', 1), ('Material elétrico', 2), ('Material de construção', 3), ('Tintas e acabamento', 4),
  ('Ferramentas e equipamentos', 5), ('Transporte', 6), ('Alimentação', 7), ('Serviços de terceiros', 8), ('Outros', 99);
insert into public.payment_methods (name, sort_order) values
  ('PIX', 1), ('Dinheiro', 2), ('Cartão de débito', 3), ('Cartão de crédito', 4), ('Boleto', 5), ('Transferência', 6);
insert into public.task_kinds (name, sort_order) values
  ('Vistoria', 1), ('Visita técnica', 2), ('Recebimento de material', 3), ('Apoio à equipe', 4),
  ('Compra', 5), ('Atividade programada', 6), ('Outro', 99);

-- ---------------------------------------------------------------------------
-- Numeração legível por ano (chamados, orçamentos)
-- ---------------------------------------------------------------------------
create table private.number_sequences (
  scope text not null,
  year integer not null,
  last_value integer not null,
  primary key (scope, year)
);

create or replace function private.next_number(p_scope text, p_year integer) returns integer
language sql security definer set search_path = '' as $$
  insert into private.number_sequences as s (scope, year, last_value)
  values (p_scope, p_year, 1)
  on conflict (scope, year) do update set last_value = s.last_value + 1
  returning last_value
$$;

-- ---------------------------------------------------------------------------
-- Auditoria (append-only)
-- ---------------------------------------------------------------------------
create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role text,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_events_entity_idx on public.audit_events (entity_type, entity_id, created_at);
create index audit_events_created_idx on public.audit_events (created_at desc);
create trigger audit_events_immutable before update or delete on public.audit_events
  for each row execute function private.forbid_mutation();

create or replace function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_id text;
begin
  if tg_op = 'INSERT' then
    v_after := to_jsonb(new);
    v_id := v_after ->> 'id';
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    if (v_before - 'updated_at' - 'version') = (v_after - 'updated_at' - 'version') then
      return new;
    end if;
    v_id := v_after ->> 'id';
  else
    v_before := to_jsonb(old);
    v_id := v_before ->> 'id';
  end if;

  insert into public.audit_events (actor_id, actor_role, entity_type, entity_id, action, before, after, reason)
  values (
    auth.uid(),
    (select p.role::text from public.profiles p where p.id = auth.uid()),
    tg_table_name,
    coalesce(v_id, '?'),
    lower(tg_op),
    v_before,
    v_after,
    nullif(current_setting('app.audit_reason', true), '')
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function private.audit_row();
create trigger audit_company_settings after update on public.company_settings
  for each row execute function private.audit_row();
create trigger audit_clients after insert or update or delete on public.clients
  for each row execute function private.audit_row();
create trigger audit_sites after insert or update or delete on public.sites
  for each row execute function private.audit_row();
create trigger audit_site_memberships after insert or update or delete on public.site_memberships
  for each row execute function private.audit_row();
create trigger audit_client_contacts after insert or update or delete on public.client_contacts
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.company_settings enable row level security;
alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.client_contact_sites enable row level security;
alter table public.sites enable row level security;
alter table public.site_areas enable row level security;
alter table public.site_memberships enable row level security;
alter table public.service_categories enable row level security;
alter table public.priority_definitions enable row level security;
alter table public.pending_reasons enable row level security;
alter table public.suppliers enable row level security;
alter table public.expense_categories enable row level security;
alter table public.payment_methods enable row level security;
alter table public.task_kinds enable row level security;
alter table public.audit_events enable row level security;

-- Perfis: a equipe vê colegas (nome/papel para atribuições); cada um vê a si mesmo.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy company_settings_select on public.company_settings for select to authenticated
  using (public.is_staff());
create policy company_settings_admin_update on public.company_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy clients_select on public.clients for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.sites s where s.client_id = clients.id and public.has_site_access(s.id)
  ));
create policy clients_admin_insert on public.clients for insert to authenticated with check (public.is_admin());
create policy clients_admin_update on public.clients for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy client_contacts_admin on public.client_contacts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy client_contact_sites_admin on public.client_contact_sites for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy sites_select on public.sites for select to authenticated using (public.has_site_access(id));
create policy sites_admin_insert on public.sites for insert to authenticated with check (public.is_admin());
create policy sites_admin_update on public.sites for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy site_areas_select on public.site_areas for select to authenticated using (public.has_site_access(site_id));
create policy site_areas_admin_insert on public.site_areas for insert to authenticated with check (public.is_admin());
create policy site_areas_admin_update on public.site_areas for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy site_memberships_select on public.site_memberships for select to authenticated
  using (public.is_admin() or profile_id = auth.uid() or public.has_site_access(site_id));
create policy site_memberships_admin_insert on public.site_memberships for insert to authenticated
  with check (public.is_admin());
create policy site_memberships_admin_update on public.site_memberships for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Catálogos operacionais: toda a equipe lê; catálogos financeiros: admin e encarregado.
create policy service_categories_select on public.service_categories for select to authenticated using (public.is_staff());
create policy priority_definitions_select on public.priority_definitions for select to authenticated using (public.is_staff());
create policy pending_reasons_select on public.pending_reasons for select to authenticated using (public.is_staff());
create policy task_kinds_select on public.task_kinds for select to authenticated using (public.is_staff());
create policy suppliers_select on public.suppliers for select to authenticated
  using (public.current_app_role() in ('admin', 'foreman'));
create policy expense_categories_select on public.expense_categories for select to authenticated
  using (public.current_app_role() in ('admin', 'foreman'));
create policy payment_methods_select on public.payment_methods for select to authenticated
  using (public.current_app_role() in ('admin', 'foreman'));

create policy service_categories_admin_write on public.service_categories for insert to authenticated with check (public.is_admin());
create policy service_categories_admin_update on public.service_categories for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy priority_definitions_admin_write on public.priority_definitions for insert to authenticated with check (public.is_admin());
create policy priority_definitions_admin_update on public.priority_definitions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pending_reasons_admin_write on public.pending_reasons for insert to authenticated with check (public.is_admin());
create policy pending_reasons_admin_update on public.pending_reasons for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy task_kinds_admin_write on public.task_kinds for insert to authenticated with check (public.is_admin());
create policy task_kinds_admin_update on public.task_kinds for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy suppliers_write on public.suppliers for insert to authenticated
  with check (public.current_app_role() in ('admin', 'foreman'));
create policy suppliers_admin_update on public.suppliers for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy expense_categories_admin_write on public.expense_categories for insert to authenticated with check (public.is_admin());
create policy expense_categories_admin_update on public.expense_categories for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy payment_methods_admin_write on public.payment_methods for insert to authenticated with check (public.is_admin());
create policy payment_methods_admin_update on public.payment_methods for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy audit_events_admin_select on public.audit_events for select to authenticated using (public.is_admin());
