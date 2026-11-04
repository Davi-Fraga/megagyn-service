-- M-02 (Fase 0, B-06; achado A-05): tarefa não fica presa em "cancelada".
-- Arquivo: supabase/migrations/20261104001000_tasks_cancelled_at.sql
--
-- Antes (20261025000500_tasks_time_billing.sql:20-23): refresh_task_status mantinha "cancelada" para
-- sempre (ramo `when status = 'cancelada'`) e transformava em "cancelada" a tarefa cujas ocorrências
-- ficaram todas "não realizada". Remarcar a ocorrência não tirava a tarefa de "cancelada" e
-- task_add_occurrence respondia "Tarefa não encontrada".
-- Agora: cancelada só com cancelled_at (gravado por task_cancel). Todas as ocorrências terminais sem
-- nenhuma concluída = "planejada" (aguardando remarcação). Sem valor novo de enum; assinaturas iguais.
--
-- Correção de dados (bloco 4): tarefas hoje "cancelada" são separadas em
--   (a) cancelamento explícito: alguma ocorrência "cancelada", OU evento de trilha da tarefa indo para
--       "cancelada" com motivo, OU tarefa alterada depois da última mudança das ocorrências (o
--       task_cancel de uma tarefa já presa não deixa evento, porque audit_row ignora UPDATE sem mudança;
--       só tasks.updated_at registra). Recebem cancelled_at, cancelled_by e cancel_reason da trilha.
--   (b) presas: o restante. São recalculadas pela regra nova.
-- Rode antes o diagnóstico D2 do README e confira a lista (b).

-- ---------------------------------------------------------------------------
-- 1. Colunas do cancelamento explícito (coluna nova, toda nula: a FK não tem o que validar)
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references public.profiles (id),
  add column cancel_reason text;

-- ---------------------------------------------------------------------------
-- 2. Situação derivada (corpo anterior: 20261025000500_tasks_time_billing.sql:6-27)
-- ---------------------------------------------------------------------------
create or replace function private.refresh_task_status(p_task uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_total integer;
  v_terminal integer;
  v_done integer;
  v_started integer;
begin
  select count(*),
         count(*) filter (where status in ('concluida', 'nao_realizada', 'cancelada')),
         count(*) filter (where status = 'concluida'),
         count(*) filter (where status in ('iniciada', 'concluida'))
    into v_total, v_terminal, v_done, v_started
    from public.task_occurrences where task_id = p_task;
  -- Cancelada só pelo cancelamento explícito (task_cancel grava cancelled_at). Ocorrências todas
  -- terminais sem nenhuma concluída (ex.: todas "não realizada") deixam a tarefa planejada,
  -- aguardando remarcação.
  update public.tasks set status = case
      when cancelled_at is not null then 'cancelada'::public.task_status
      when v_total > 0 and v_terminal = v_total and v_done > 0 then 'concluida'::public.task_status
      when v_started > 0 then 'em_andamento'::public.task_status
      else 'planejada'::public.task_status end
   where id = p_task;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Cancelamento explícito (corpo anterior: 20261025001400_review_fixes.sql:344-361)
-- ---------------------------------------------------------------------------
create or replace function public.task_cancel(p_task_id uuid, p_reason text) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare
  v public.tasks;
begin
  perform private.require_admin();
  if private.blank(p_reason) then
    perform private.fail('Informe o motivo.', 'reason');
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  -- A tarefa primeiro: quando as ocorrências mudarem, refresh_task_status já encontra cancelled_at.
  -- Cancelar de novo não troca a data, o autor nem o motivo do primeiro cancelamento.
  update public.tasks
     set status = 'cancelada',
         cancelled_at = coalesce(cancelled_at, now()),
         cancelled_by = coalesce(cancelled_by, auth.uid()),
         cancel_reason = coalesce(cancel_reason, trim(p_reason))
   where id = p_task_id returning * into v;
  if v.id is null then
    perform private.fail('Tarefa não encontrada.', null, 'P0002');
  end if;
  update public.task_occurrences set status = 'cancelada' where task_id = p_task_id and status in ('prevista', 'iniciada');
  perform set_config('app.audit_reason', '', true);
  select * into v from public.tasks where id = p_task_id;
  return v;
end $$;

revoke all on function private.refresh_task_status(uuid) from anon, authenticated, public;
revoke execute on function public.task_cancel(uuid, text) from anon, public;
grant execute on function public.task_cancel(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Correção de dados (mesma lógica do diagnóstico D2 do README)
-- ---------------------------------------------------------------------------
do $$
declare
  -- Tarefas que o diagnóstico D2 classificou como "presa", mas que a Megagyn confirmar que foram
  -- canceladas de propósito: coloque os ids aqui antes de aplicar (ficam canceladas).
  v_keep_cancelled uuid[] := '{}'::uuid[];
  v_explicit integer;
  v_recalc integer := 0;
  v_id uuid;
begin
  perform set_config('app.audit_reason', 'M-02 (A-05): cancelamento anterior registrado em cancelled_at.', true);
  with occ as (
    select o.task_id,
           count(*) filter (where o.status = 'cancelada') as cancelled_occ,
           max(o.updated_at) as last_occ_change
      from public.task_occurrences o
     group by o.task_id
  ),
  task_cancel_event as (
    -- Transição da própria tarefa para "cancelada" feita por task_cancel (que sempre grava motivo).
    select distinct on (e.entity_id) e.entity_id, e.created_at, e.actor_id, e.reason
      from public.audit_events e
     where e.entity_type = 'tasks'
       and e.action = 'update'
       and e.after ->> 'status' = 'cancelada'
       and e.before ->> 'status' is distinct from 'cancelada'
       and nullif(trim(e.reason), '') is not null
     order by e.entity_id, e.created_at desc, e.id desc
  ),
  occ_cancel_event as (
    -- Ocorrência cancelada: só task_cancel faz isso; o evento guarda autor e motivo.
    select distinct on (e.after ->> 'task_id') e.after ->> 'task_id' as task_id, e.created_at, e.actor_id, e.reason
      from public.audit_events e
     where e.entity_type = 'task_occurrences'
       and e.action = 'update'
       and e.after ->> 'status' = 'cancelada'
       and e.before ->> 'status' is distinct from 'cancelada'
     order by e.after ->> 'task_id', e.created_at desc, e.id desc
  ),
  explicit as (
    select t.id,
           coalesce(te.created_at, oe.created_at, t.updated_at) as cancelled_at,
           coalesce(te.actor_id, oe.actor_id) as cancelled_by,
           coalesce(nullif(trim(te.reason), ''), nullif(trim(oe.reason), ''),
                    'Cancelada antes da correção A-05; motivo não encontrado na trilha.') as cancel_reason
      from public.tasks t
      left join occ o on o.task_id = t.id
      left join task_cancel_event te on te.entity_id = t.id::text
      left join occ_cancel_event oe on oe.task_id = t.id::text
     where t.status = 'cancelada'
       and (coalesce(o.cancelled_occ, 0) > 0
            or te.entity_id is not null
            or t.updated_at > coalesce(o.last_occ_change, '-infinity'::timestamptz)
            or t.id = any (v_keep_cancelled))
  )
  update public.tasks t
     set cancelled_at = e.cancelled_at,
         cancelled_by = (select p.id from public.profiles p where p.id = e.cancelled_by),
         cancel_reason = e.cancel_reason
    from explicit e
   where e.id = t.id;
  get diagnostics v_explicit = row_count;

  perform set_config('app.audit_reason', 'M-02 (A-05): situação recalculada; a tarefa não tinha sido cancelada pela administração.', true);
  for v_id in select id from public.tasks where status = 'cancelada' and cancelled_at is null loop
    perform private.refresh_task_status(v_id);
    v_recalc := v_recalc + 1;
  end loop;
  perform set_config('app.audit_reason', '', true);

  if exists (select 1 from public.tasks where status = 'cancelada' and cancelled_at is null) then
    raise exception 'M-02: ainda há tarefa cancelada sem cancelled_at. Migração interrompida.';
  end if;
  raise notice 'M-02: % tarefa(s) com cancelamento explícito registrado; % tarefa(s) presa(s) recalculada(s).', v_explicit, v_recalc;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Regra de 04-fluxos-e-permissoes.md §2.2: "cancelada só com cancelled_at".
--    NOT VALID: vale já para toda linha nova ou alterada; as antigas são conferidas depois.
--    Depois do diagnóstico D4 do README vazio, em migração própria:
--      alter table public.tasks validate constraint tasks_cancelled_only_with_cancelled_at;
-- ---------------------------------------------------------------------------
alter table public.tasks
  add constraint tasks_cancelled_only_with_cancelled_at
  check ((status = 'cancelada') = (cancelled_at is not null)) not valid;
