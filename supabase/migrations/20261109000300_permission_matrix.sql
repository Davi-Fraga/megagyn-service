-- B-24 (M-14): matriz de permissões por módulo e ação, com exceções individuais.
-- Antes: as regras eram fixas nas RPCs e políticas (4 papéis), sem como liberar uma ação a alguém.
-- Agora:
--   * permission_catalog: as ações conhecidas, com os pisos do doc 04 §4.2 (piso = só a administração,
--     salvo exceção individual; cliente_nunca = o cliente não recebe nem por exceção);
--   * role_permissions: o que cada papel pode; o seed reproduz o comportamento de hoje (doc 04 §4.1).
--     A administração pode tudo e não tem linhas aqui, então ninguém altera a própria permissão pelo papel;
--   * permission_overrides: exceção individual, com motivo, opcionalmente num local e com validade;
--   * private.can(módulo, ação, local) e public.can para a própria sessão.
-- Pisos travados no banco: ação de administração não vai para um papel inteiro; o cliente nunca recebe
-- despesas, reembolsos, horas, usuários, configurações e auditoria; com local, só vale onde a pessoa tem
-- acesso; ninguém altera a própria exceção. Tudo fica na trilha (audit_row).
-- Compatibilidade: nenhuma RPC ou política consulta a matriz ainda; nada muda nas telas. As RPCs passam
-- a consultar can uma por PR. Dados existentes: nenhuma linha é alterada.

create table public.permission_catalog (
  module text not null,
  action text not null,
  label text not null,
  admin_floor boolean not null default false,
  client_never boolean not null default false,
  primary key (module, action)
);

insert into public.permission_catalog (module, action, label, admin_floor, client_never) values
  ('cadastros', 'ver', 'Clientes e locais: ver', false, false),
  ('cadastros', 'criar', 'Clientes e locais: criar', false, false),
  ('cadastros', 'editar', 'Clientes e locais: editar', false, false),
  ('cadastros', 'inativar', 'Clientes e locais: inativar', false, false),
  ('usuarios', 'ver', 'Colaboradores: ver', false, true),
  ('usuarios', 'criar', 'Colaboradores: criar', true, true),
  ('usuarios', 'editar', 'Colaboradores: editar', true, true),
  ('usuarios', 'bloquear', 'Colaboradores: bloquear', true, true),
  ('usuarios', 'permissoes', 'Colaboradores: gerenciar acessos', true, true),
  ('os', 'ver', 'O.S.: ver', false, false),
  ('os', 'criar', 'O.S.: abrir', false, false),
  ('os', 'editar', 'O.S.: editar', false, false),
  ('os', 'programar', 'O.S.: programar', false, false),
  ('os', 'registrar', 'O.S.: registrar atendimento', false, false),
  ('os', 'validar', 'O.S.: validar e encerrar', true, false),
  ('os', 'cancelar', 'O.S.: cancelar', true, false),
  ('os', 'reabrir', 'O.S.: reabrir', true, false),
  ('os', 'remover_foto', 'O.S.: remover foto', false, false),
  ('os', 'exportar', 'O.S.: exportar', false, false),
  ('tarefas', 'ver', 'Tarefas: ver', false, false),
  ('tarefas', 'criar', 'Tarefas: criar', false, false),
  ('tarefas', 'remarcar', 'Tarefas: remarcar', false, false),
  ('tarefas', 'cancelar', 'Tarefas: cancelar', false, false),
  ('tarefas', 'executar', 'Tarefas: iniciar e finalizar', false, false),
  ('diario', 'ver', 'Diário e atividades: ver', false, false),
  ('diario', 'criar', 'Diário e atividades: lançar', false, false),
  ('diario', 'ajustar', 'Diário e atividades: ajustar com motivo', false, false),
  ('diario', 'exportar', 'Diário e atividades: exportar', false, false),
  ('orcamentos', 'ver', 'Orçamentos: ver', false, false),
  ('orcamentos', 'criar', 'Orçamentos: criar', false, false),
  ('orcamentos', 'editar', 'Orçamentos: editar', false, false),
  ('orcamentos', 'mudar_situacao', 'Orçamentos: enviar, aprovar e cancelar', false, false),
  ('fechamentos', 'ver', 'Fechamentos e relatórios: ver', false, false),
  ('fechamentos', 'emitir', 'Fechamentos e relatórios: emitir', false, false),
  ('fechamentos', 'exportar', 'Fechamentos e relatórios: exportar', false, false),
  ('despesas', 'ver', 'Despesas: ver', false, true),
  ('despesas', 'criar', 'Despesas: lançar', false, true),
  ('despesas', 'editar', 'Despesas: editar', false, true),
  ('despesas', 'aprovar', 'Despesas: aprovar', false, true),
  ('despesas', 'devolver', 'Despesas: devolver', false, true),
  ('despesas', 'exportar', 'Despesas: exportar', false, true),
  ('reembolsos', 'ver', 'Reembolsos: ver', false, true),
  ('reembolsos', 'pagar', 'Reembolsos: registrar pagamento', false, true),
  ('horas', 'ver', 'Horas e diárias: ver', false, true),
  ('horas', 'registrar', 'Horas e diárias: registrar', false, true),
  ('horas', 'aprovar', 'Horas e diárias: aprovar diárias', false, true),
  ('horas', 'regras', 'Horas e diárias: regras de valor', false, true),
  ('configuracoes', 'ver', 'Configurações: ver', false, true),
  ('configuracoes', 'editar', 'Configurações: editar', true, true),
  ('configuracoes', 'incluir_fornecedor', 'Configurações: incluir fornecedor', false, true),
  ('auditoria', 'ver', 'Auditoria: ver', false, true);

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.user_role not null check (role in ('foreman', 'worker', 'client')),
  module text not null,
  action text not null,
  allowed boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  unique (role, module, action),
  foreign key (module, action) references public.permission_catalog (module, action)
);

-- Seed = comportamento de hoje (doc 04 §4.1, coluna "hoje"): encarregado e funcionário; o cliente não tem
-- acesso a nada enquanto o portal estiver desligado.
insert into public.role_permissions (role, module, action, allowed)
select r.role::public.user_role, c.module, c.action, (c.module || '.' || c.action) = any (
  case r.role
    when 'foreman' then array['cadastros.ver', 'usuarios.ver', 'os.ver', 'os.registrar', 'tarefas.ver', 'tarefas.executar',
      'diario.ver', 'diario.criar', 'despesas.ver', 'despesas.criar', 'despesas.editar', 'reembolsos.ver', 'horas.ver',
      'horas.registrar', 'configuracoes.ver', 'configuracoes.incluir_fornecedor']
    when 'worker' then array['cadastros.ver', 'usuarios.ver', 'os.ver', 'os.registrar', 'tarefas.ver', 'tarefas.executar',
      'diario.ver', 'diario.criar', 'reembolsos.ver', 'horas.ver', 'horas.registrar', 'configuracoes.ver']
    else array[]::text[]
  end)
from public.permission_catalog c
cross join (values ('foreman'), ('worker'), ('client')) as r (role);

create table public.permission_overrides (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  module text not null,
  action text not null,
  site_id uuid references public.sites (id),
  allowed boolean not null,
  reason text not null check (length(trim(reason)) > 0 and length(reason) <= 500),
  granted_by uuid references public.profiles (id) default auth.uid(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (module, action) references public.permission_catalog (module, action)
);
create index permission_overrides_profile_idx on public.permission_overrides (profile_id, module, action);

-- Pisos (doc 04 §4.2), conferidos em toda gravação.
create function private.guard_role_permission() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_cat public.permission_catalog;
begin
  select * into v_cat from public.permission_catalog where module = new.module and action = new.action;
  if new.allowed and v_cat.admin_floor then
    raise exception 'Esta ação exige a administração. Para liberar a uma pessoa, use uma exceção individual com motivo.'
      using errcode = '42501', hint = 'allowed';
  end if;
  if new.allowed and new.role = 'client' and v_cat.client_never then
    raise exception 'O cliente nunca recebe esta permissão.' using errcode = '42501', hint = 'allowed';
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger role_permissions_guard before insert or update on public.role_permissions
  for each row execute function private.guard_role_permission();

create function private.guard_permission_override() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_target uuid := coalesce(new.profile_id, old.profile_id);
  v_role public.user_role;
begin
  if v_target = auth.uid() then
    raise exception 'Ninguém altera a própria permissão. Peça a outro administrador.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  select role into v_role from public.profiles where id = new.profile_id;
  if new.allowed and v_role = 'client' and exists (
    select 1 from public.permission_catalog c where c.module = new.module and c.action = new.action and c.client_never
  ) then
    raise exception 'O cliente nunca recebe esta permissão.' using errcode = '42501', hint = 'allowed';
  end if;
  if tg_op = 'INSERT' then
    new.granted_by := auth.uid();
    new.created_at := now();
  end if;
  return new;
end $$;
create trigger permission_overrides_guard before insert or update or delete on public.permission_overrides
  for each row execute function private.guard_permission_override();

create trigger audit_role_permissions after insert or update or delete on public.role_permissions
  for each row execute function private.audit_row();
create trigger audit_permission_overrides after insert or update or delete on public.permission_overrides
  for each row execute function private.audit_row();

-- A pergunta "esta sessão pode?" (com local, só onde a pessoa tem acesso).
create function private.can(p_module text, p_action text, p_site uuid default null) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role public.user_role := public.current_app_role();
  v_cat public.permission_catalog;
  v_override boolean;
  v_allowed boolean;
begin
  select * into v_cat from public.permission_catalog where module = p_module and action = p_action;
  if not found then
    raise exception 'Permissão desconhecida: %.%', p_module, p_action using errcode = '22023';
  end if;
  if v_role is null then
    return false;
  end if;
  if v_role = 'admin' then
    return true;
  end if;
  if v_role = 'client' and v_cat.client_never then
    return false;
  end if;
  if p_site is not null and not public.has_site_access(p_site) then
    return false;
  end if;
  -- Exceção vigente: a do local vence a geral; entre iguais, a mais recente.
  select o.allowed into v_override
    from public.permission_overrides o
   where o.profile_id = auth.uid() and o.module = p_module and o.action = p_action
     and (o.site_id is null or o.site_id = p_site)
     and (o.expires_at is null or o.expires_at > now())
   order by (o.site_id is not null) desc, o.created_at desc
   limit 1;
  if found then
    return v_override;
  end if;
  if v_cat.admin_floor then
    return false;
  end if;
  select r.allowed into v_allowed from public.role_permissions r where r.role = v_role and r.module = p_module and r.action = p_action;
  return coalesce(v_allowed, false);
end $$;

create function public.can(p_module text, p_action text, p_site uuid default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can(p_module, p_action, p_site)
$$;

alter table public.permission_catalog enable row level security;
alter table public.role_permissions enable row level security;
alter table public.permission_overrides enable row level security;

create policy permission_catalog_select on public.permission_catalog for select to authenticated using (true);
create policy role_permissions_select on public.role_permissions for select to authenticated using (true);
create policy role_permissions_admin_update on public.role_permissions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy permission_overrides_select on public.permission_overrides for select to authenticated
  using (public.is_admin() or profile_id = auth.uid());
create policy permission_overrides_admin_insert on public.permission_overrides for insert to authenticated
  with check (public.is_admin());
create policy permission_overrides_admin_update on public.permission_overrides for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy permission_overrides_admin_delete on public.permission_overrides for delete to authenticated
  using (public.is_admin());

revoke all on public.permission_catalog, public.role_permissions, public.permission_overrides from anon;
revoke all on function private.can(text, text, uuid) from anon, authenticated, public;
revoke execute on function public.can(text, text, uuid) from anon, public;
grant execute on function public.can(text, text, uuid) to authenticated, service_role;
revoke all on function private.guard_role_permission() from anon, authenticated, public;
revoke all on function private.guard_permission_override() from anon, authenticated, public;
