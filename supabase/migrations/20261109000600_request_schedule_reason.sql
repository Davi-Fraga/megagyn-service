-- B-34 (M-19): na reprogramação, mudar prazo ou prioridade exige motivo, como já exige a edição dos dados
-- (request_update). A triagem do chamado Aberto não pede motivo: a tela nem mostra o campo nessa etapa.
-- Mesma assinatura: create or replace mantém as permissões.
create or replace function public.request_schedule(
  p_request_id uuid,
  p_assignee_ids uuid[],
  p_scheduled_date date,
  p_due_date date default null,
  p_priority_id uuid default null,
  p_service_category_id uuid default null,
  p_reason text default null,
  p_client_request_id uuid default null
) returns public.service_requests
language plpgsql security definer set search_path = '' as $$
declare
  v public.service_requests;
  v_pid uuid;
  v_names text[];
  v_before text[];
  v_event public.request_event_type;
begin
  perform private.require_admin();
  v := private.lock_request(p_request_id);
  if private.event_applied(v.id, p_client_request_id) then
    return v;
  end if;
  perform private.require_status(v, array['aberta', 'programada', 'pendente']::public.request_status[], 'programar');
  if v.status <> 'aberta' and private.blank(p_reason) and (
       (p_due_date is not null and p_due_date is distinct from v.due_date)
    or (p_priority_id is not null and p_priority_id is distinct from v.priority_id)) then
    perform private.fail('Informe o motivo da mudança de prazo ou prioridade.', 'reason');
  end if;
  if coalesce(array_length(p_assignee_ids, 1), 0) = 0 then
    perform private.fail('Escolha ao menos 1 responsável.', 'assigneeIds');
  end if;
  if p_scheduled_date is null then
    perform private.fail('Informe a data programada.', 'scheduledDate');
  end if;
  foreach v_pid in array p_assignee_ids loop
    if not private.profile_can_work_at(v_pid, v.site_id) then
      perform private.fail('Responsável sem vínculo ativo com este local. Vincule a pessoa ao local antes.', 'assigneeIds');
    end if;
  end loop;

  select coalesce(array_agg(p.full_name order by p.full_name), '{}') into v_before
    from public.request_assignments a join public.profiles p on p.id = a.profile_id
   where a.service_request_id = v.id and a.unassigned_at is null;

  update public.request_assignments set unassigned_at = now(), unassigned_by = auth.uid()
   where service_request_id = v.id and unassigned_at is null and not (profile_id = any (p_assignee_ids));
  insert into public.request_assignments (service_request_id, profile_id, assigned_by)
  select v.id, x, auth.uid() from unnest(p_assignee_ids) as x
  on conflict do nothing;

  select coalesce(array_agg(full_name order by full_name), '{}') into v_names from public.profiles where id = any (p_assignee_ids);

  update public.service_requests
     set scheduled_date = p_scheduled_date,
         due_date = coalesce(p_due_date, due_date),
         priority_id = coalesce(p_priority_id, priority_id),
         service_category_id = coalesce(p_service_category_id, service_category_id)
   where id = v.id
   returning * into v;

  v_event := case when v.status = 'aberta' then 'classificacao' else 'reprogramacao' end;
  v := private.request_transition(v, 'programada', v_event, p_reason, jsonb_build_object(
    'scheduled_date', p_scheduled_date, 'due_date', v.due_date, 'assignee_ids', to_jsonb(p_assignee_ids),
    'assignee_names', to_jsonb(v_names), 'previous_assignee_names', to_jsonb(v_before),
    'priority_id', v.priority_id, 'service_category_id', v.service_category_id,
    'client_request_id', p_client_request_id
  ));

  perform private.notify(p_assignee_ids, 'atribuicao', 'Chamado ' || v.number || ' programado para você',
    v.title || ' — ' || to_char(p_scheduled_date, 'DD/MM/YYYY'), '/campo/chamados/' || v.id);
  return v;
end $$;
