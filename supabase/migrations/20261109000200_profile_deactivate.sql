-- B-20 (M-13, A-12): desligamento de colaborador com pendências.
-- Antes: desativar só marcava o perfil; os vínculos com locais e as atribuições em chamados e tarefas
-- ficavam abertos, e "Reprogramar" com o mesmo grupo passava a falhar.
-- Agora:
--   * profile_open_items(p_profile): prévia, só para a administração, do que a pessoa tem aberto;
--   * profile_deactivate(p_profile, p_reason, p_reassign_to): numa transação só, tira a pessoa dos
--     chamados não encerrados e das tarefas abertas (transfere para p_reassign_to onde ela pode trabalhar
--     no local; o resto fica sem responsável e é contado), encerra os vínculos com locais, desativa o
--     perfil e avisa a administração. Cada chamado ganha um evento "atribuicao" no histórico.
-- Autoria: eventos, registros de trabalho, fotos e despesas da pessoa não mudam.
-- Funções novas: nenhuma assinatura existente muda. Dados existentes: nenhuma linha é alterada.

create function public.profile_open_items(p_profile uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'number', r.number, 'title', r.title, 'status', r.status,
               'site_id', r.site_id, 'site_name', s.name) order by r.number)
        from public.request_assignments a
        join public.service_requests r on r.id = a.service_request_id
        join public.sites s on s.id = r.site_id
       where a.profile_id = p_profile and a.unassigned_at is null and r.status not in ('concluida', 'cancelada')
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'status', t.status, 'scheduled_date', t.scheduled_date)
               order by t.scheduled_date, t.title)
        from public.task_assignments ta
        join public.tasks t on t.id = ta.task_id
       where ta.profile_id = p_profile and t.status in ('planejada', 'em_andamento')
    ), '[]'::jsonb),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'site_id', m.site_id, 'site_name', s.name) order by s.name)
        from public.site_memberships m
        join public.sites s on s.id = m.site_id
       where m.profile_id = p_profile and (m.active_to is null or m.active_to > public.today_sp())
    ), '[]'::jsonb)
  );
end $$;

create function public.profile_deactivate(p_profile uuid, p_reason text, p_reassign_to uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_person public.profiles;
  v_to public.profiles;
  v_req record;
  v_task record;
  v_moved boolean;
  v_requests_moved integer := 0;
  v_requests_left integer := 0;
  v_tasks_moved integer := 0;
  v_tasks_left integer := 0;
  v_memberships integer := 0;
begin
  perform private.require_admin();
  if p_profile = auth.uid() then
    perform private.fail('Você não pode desativar o próprio acesso. Peça a outro administrador.');
  end if;
  if private.blank(p_reason) then
    perform private.fail('Informe o motivo do desligamento.', 'reason');
  end if;
  select * into v_person from public.profiles where id = p_profile for update;
  if not found then
    perform private.fail('Usuário não encontrado. Atualize a página.');
  end if;
  if not v_person.is_active then
    perform private.fail('Este acesso já está desativado.');
  end if;
  if p_reassign_to is not null then
    select * into v_to from public.profiles where id = p_reassign_to;
    if not found or not v_to.is_active or v_to.role = 'client' or v_to.id = p_profile then
      perform private.fail('Escolha uma pessoa ativa da equipe para receber as pendências.', 'reassignTo');
    end if;
  end if;

  perform set_config('app.audit_reason', trim(p_reason), true);

  -- Chamados não encerrados: sai a pessoa; entra quem recebe, se puder trabalhar no local.
  for v_req in
    select a.id as assignment_id, r.id, r.site_id
      from public.request_assignments a
      join public.service_requests r on r.id = a.service_request_id
     where a.profile_id = p_profile and a.unassigned_at is null and r.status not in ('concluida', 'cancelada')
     order by r.number
       for update of a
  loop
    update public.request_assignments set unassigned_at = now(), unassigned_by = auth.uid() where id = v_req.assignment_id;
    v_moved := p_reassign_to is not null and private.profile_can_work_at(p_reassign_to, v_req.site_id);
    if v_moved then
      insert into public.request_assignments (service_request_id, profile_id, assigned_by)
      values (v_req.id, p_reassign_to, auth.uid())
      on conflict do nothing;
      v_requests_moved := v_requests_moved + 1;
    else
      v_requests_left := v_requests_left + 1;
    end if;
    insert into public.request_events (service_request_id, event_type, actor_id, reason, payload)
    values (v_req.id, 'atribuicao', auth.uid(), trim(p_reason), jsonb_build_object(
      'deactivated_profile_id', p_profile, 'deactivated_name', v_person.full_name,
      'transferred_to', case when v_moved then p_reassign_to end,
      'transferred_to_name', case when v_moved then v_to.full_name end));
  end loop;

  -- Tarefas abertas: entra quem recebe só se puder trabalhar em todos os locais ainda previstos.
  for v_task in
    select t.id
      from public.task_assignments ta
      join public.tasks t on t.id = ta.task_id
     where ta.profile_id = p_profile and t.status in ('planejada', 'em_andamento')
  loop
    delete from public.task_assignments where task_id = v_task.id and profile_id = p_profile;
    v_moved := p_reassign_to is not null and not exists (
      select 1 from public.task_occurrences o
       where o.task_id = v_task.id and o.status in ('prevista', 'iniciada')
         and not private.profile_can_work_at(p_reassign_to, o.site_id));
    if v_moved then
      insert into public.task_assignments (task_id, profile_id, assigned_by)
      values (v_task.id, p_reassign_to, auth.uid())
      on conflict do nothing;
      v_tasks_moved := v_tasks_moved + 1;
    else
      v_tasks_left := v_tasks_left + 1;
    end if;
  end loop;

  -- Vínculos com locais: encerrados hoje (os que começariam no futuro, no próprio dia de início).
  update public.site_memberships
     set active_to = greatest(active_from, public.today_sp())
   where profile_id = p_profile and (active_to is null or active_to > public.today_sp());
  get diagnostics v_memberships = row_count;

  update public.profiles set is_active = false, deactivated_at = now() where id = p_profile;
  perform set_config('app.audit_reason', '', true);

  perform private.notify(private.admin_ids(), 'desligamento', 'Acesso de ' || v_person.full_name || ' desativado',
    format('Transferidos: %s chamado(s) e %s tarefa(s). Sem responsável: %s chamado(s) e %s tarefa(s).',
      v_requests_moved, v_tasks_moved, v_requests_left, v_tasks_left),
    '/admin/usuarios/' || p_profile);

  return jsonb_build_object('requests_moved', v_requests_moved, 'requests_left', v_requests_left,
    'tasks_moved', v_tasks_moved, 'tasks_left', v_tasks_left, 'memberships_ended', v_memberships);
end $$;

revoke execute on function public.profile_open_items(uuid) from anon, public;
revoke execute on function public.profile_deactivate(uuid, text, uuid) from anon, public;
grant execute on function public.profile_open_items(uuid) to authenticated, service_role;
grant execute on function public.profile_deactivate(uuid, text, uuid) to authenticated, service_role;
