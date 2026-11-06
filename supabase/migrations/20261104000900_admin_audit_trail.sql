-- M-05 (Fase 0, B-10; achado A-09): trilha das ações administrativas.
-- Arquivo: supabase/migrations/20261104000900_admin_audit_trail.sql
--
-- Antes:
--   * o perfil novo é inserido com service_role (src/server/actions/registry.ts:378): o gatilho grava
--     actor_id nulo; banir, reativar no Auth e definir senha provisória (:424, :461) não deixam nada no banco;
--   * o vínculo responsável do cliente × local é apagado sem gatilho (registry.ts:152-155; 0100:451-452);
--   * setores, catálogos, itens de orçamento, vínculos de anexo e atribuições não têm gatilho de auditoria.
-- Agora:
--   1. private.audit_row aceita os nomes das colunas da chave como argumentos do gatilho, para as tabelas
--      sem coluna "id" (client_contact_sites, task_assignments); sem argumentos, nada muda;
--   2. client_contact_sites.ended_at: o app passa a encerrar com data em vez de apagar;
--   3. gatilhos de auditoria nas tabelas listadas no doc 03 (M-05);
--   4. public.audit_admin_action: só administração, ator = auth.uid(), para as ações do Auth.
--
-- Compatibilidade: o DELETE em client_contact_sites continua permitido (o app em produção ainda apaga);
-- a partir desta migração ele fica registrado na trilha. Bloquear o DELETE é um passo posterior, depois
-- do PR do app (ver "M-05, passo posterior" no README).
-- Dados existentes: nenhuma linha é alterada; audit_events passa a receber mais linhas daqui em diante.

-- ---------------------------------------------------------------------------
-- 1. Auditoria com chave composta (corpo anterior: 20261025000100_foundation.sql:361-395)
-- ---------------------------------------------------------------------------
create or replace function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_id text;
  v_row jsonb;
  v_i integer;
begin
  if tg_op = 'INSERT' then
    v_after := to_jsonb(new);
    v_row := v_after;
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    if (v_before - 'updated_at' - 'version') = (v_after - 'updated_at' - 'version') then
      return new;
    end if;
    v_row := v_after;
  else
    v_before := to_jsonb(old);
    v_row := v_before;
  end if;

  -- M-05: tabela sem coluna "id" passa as colunas da chave como argumentos do gatilho
  -- (ex.: audit_row('client_contact_id', 'site_id')); o entity_id vira "valor1:valor2".
  if tg_nargs > 0 then
    v_id := '';
    for v_i in 0 .. tg_nargs - 1 loop
      v_id := v_id || case when v_i > 0 then ':' else '' end || coalesce(v_row ->> tg_argv[v_i], '?');
    end loop;
  else
    v_id := v_row ->> 'id';
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

-- ---------------------------------------------------------------------------
-- 2. Vínculo responsável do cliente × local: encerramento com data
-- ---------------------------------------------------------------------------
alter table public.client_contact_sites add column ended_at timestamptz;

-- ---------------------------------------------------------------------------
-- 3. Gatilhos de auditoria
-- ---------------------------------------------------------------------------
create trigger audit_client_contact_sites after insert or update or delete on public.client_contact_sites
  for each row execute function private.audit_row('client_contact_id', 'site_id');
create trigger audit_site_areas after insert or update or delete on public.site_areas
  for each row execute function private.audit_row();

create trigger audit_service_categories after insert or update or delete on public.service_categories
  for each row execute function private.audit_row();
create trigger audit_priority_definitions after insert or update or delete on public.priority_definitions
  for each row execute function private.audit_row();
create trigger audit_pending_reasons after insert or update or delete on public.pending_reasons
  for each row execute function private.audit_row();
create trigger audit_suppliers after insert or update or delete on public.suppliers
  for each row execute function private.audit_row();
create trigger audit_expense_categories after insert or update or delete on public.expense_categories
  for each row execute function private.audit_row();
create trigger audit_payment_methods after insert or update or delete on public.payment_methods
  for each row execute function private.audit_row();
create trigger audit_task_kinds after insert or update or delete on public.task_kinds
  for each row execute function private.audit_row();

create trigger audit_quote_items after insert or update or delete on public.quote_items
  for each row execute function private.audit_row();
create trigger audit_attachment_links after insert or update or delete on public.attachment_links
  for each row execute function private.audit_row();
create trigger audit_request_assignments after insert or update or delete on public.request_assignments
  for each row execute function private.audit_row();
create trigger audit_task_assignments after insert or update or delete on public.task_assignments
  for each row execute function private.audit_row('task_id', 'profile_id');

-- ---------------------------------------------------------------------------
-- 4. Ações do Auth com o ator real (chamada pela sessão do admin, depois da chamada ao Auth)
-- ---------------------------------------------------------------------------
create or replace function public.audit_admin_action(
  p_entity text,
  p_entity_id text,
  p_action text,
  p_reason text default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_profile uuid;
  v_after jsonb;
  v_id bigint;
begin
  perform private.require_admin();
  -- Lista fechada: a trilha não aceita evento livre, nem para a administração.
  if p_entity is distinct from 'profiles' then
    perform private.fail('Tipo de registro inválido para a trilha.', 'entity');
  end if;
  if p_action is null or p_action not in (
    'auth_criar', 'auth_convidar', 'auth_bloquear', 'auth_reativar', 'auth_senha_provisoria', 'auth_link_senha'
  ) then
    perform private.fail('Ação inválida para a trilha.', 'action');
  end if;
  if p_entity_id is null or p_entity_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    perform private.fail('Usuário não encontrado.', null, 'P0002');
  end if;
  select p.id, jsonb_build_object('full_name', p.full_name, 'email', p.email, 'role', p.role, 'is_active', p.is_active)
    into v_profile, v_after
    from public.profiles p where p.id = p_entity_id::uuid;
  if v_profile is null then
    perform private.fail('Usuário não encontrado.', null, 'P0002');
  end if;
  insert into public.audit_events (actor_id, actor_role, entity_type, entity_id, action, before, after, reason)
  values (
    auth.uid(),
    (select p.role::text from public.profiles p where p.id = auth.uid()),
    'profiles',
    v_profile::text,
    p_action,
    null,
    v_after,
    nullif(trim(p_reason), '')
  )
  returning id into v_id;
  return v_id;
end $$;

revoke all on function private.audit_row() from anon, authenticated, public;
revoke execute on function public.audit_admin_action(text, text, text, text) from anon, public;
grant execute on function public.audit_admin_action(text, text, text, text) to authenticated;
