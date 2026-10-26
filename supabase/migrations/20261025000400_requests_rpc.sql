-- Funções de negócio do chamado/OS e dos lançamentos de atividade.
-- Todas SECURITY DEFINER com checagem explícita de papel e escopo, pois as tabelas
-- não têm política de escrita: a API do Supabase não permite contornar estas regras.

-- ---------------------------------------------------------------------------
-- Auxiliares
-- ---------------------------------------------------------------------------
create or replace function private.fail(p_message text, p_field text default null, p_code text default 'P0001')
returns void language plpgsql set search_path = '' as $$
begin
  raise exception using message = p_message, errcode = p_code, hint = coalesce(p_field, '');
end $$;

create or replace function private.require_staff() returns public.user_role
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role public.user_role := public.current_app_role();
begin
  if v_role is null or v_role = 'client' then
    perform private.fail('Acesso não autorizado.', null, '42501');
  end if;
  return v_role;
end $$;

create or replace function private.require_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    perform private.fail('Somente a administração pode fazer isso.', null, '42501');
  end if;
end $$;

create or replace function private.status_label(s public.request_status) returns text
language sql immutable set search_path = '' as $$
  select case s
    when 'aberta' then 'Aberta' when 'programada' then 'Programada' when 'em_execucao' then 'Em execução'
    when 'pendente' then 'Pendente' when 'executada' then 'Executada' when 'concluida' then 'Concluída'
    when 'cancelada' then 'Cancelada' end
$$;

create or replace function private.blank(t text) returns boolean
language sql immutable set search_path = '' as $$ select coalesce(trim(t), '') = '' $$;

-- Bloqueia a linha (concorrência) e garante escopo. Mesma mensagem para inexistente e sem acesso.
create or replace function private.lock_request(p_id uuid) returns public.service_requests
language plpgsql security definer set search_path = '' as $$
declare
  v public.service_requests;
begin
  select * into v from public.service_requests where id = p_id for update;
  if not found or not public.has_site_access(v.site_id) then
    perform private.fail('Chamado não encontrado.', null, 'P0002');
  end if;
  return v;
end $$;

create or replace function private.require_status(v public.service_requests, p_allowed public.request_status[], p_action text)
returns void language plpgsql set search_path = '' as $$
begin
  if not (v.status = any (p_allowed)) then
    perform private.fail(format('Não é possível %s: o chamado %s está "%s".', p_action, v.number, private.status_label(v.status)));
  end if;
end $$;

-- Evita aplicar duas vezes a mesma ação (clique duplo / rede instável).
create or replace function private.event_applied(p_request uuid, p_client_request_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_client_request_id is not null and exists (
    select 1 from public.request_events e
    where e.service_request_id = p_request and e.actor_id = auth.uid()
      and e.payload ->> 'client_request_id' = p_client_request_id::text
  )
$$;

create or replace function private.request_transition(
  p_req public.service_requests,
  p_to public.request_status,
  p_event public.request_event_type,
  p_reason text default null,
  p_payload jsonb default '{}'::jsonb,
  p_work_entry uuid default null
) returns public.service_requests
language plpgsql security definer set search_path = '' as $$
declare
  v public.service_requests;
begin
  perform set_config('app.in_transition', 'on', true);
  perform set_config('app.audit_reason', coalesce(p_reason, ''), true);
  update public.service_requests
     set status = p_to,
         version = version + 1,
         closed_at = case when p_to = 'concluida' then now() when p_to = 'aberta' then null else closed_at end,
         cancelled_at = case when p_to = 'cancelada' then now() when p_to = 'aberta' then null else cancelled_at end,
         current_pending = case when p_to = 'pendente' then p_payload else null end
   where id = p_req.id
   returning * into v;
  perform set_config('app.in_transition', 'off', true);
  perform set_config('app.audit_reason', '', true);

  insert into public.request_events (service_request_id, event_type, from_status, to_status, actor_id, reason, payload, work_entry_id)
  values (p_req.id, p_event, p_req.status, p_to, auth.uid(), nullif(trim(p_reason), ''), coalesce(p_payload, '{}'::jsonb), p_work_entry);
  return v;
end $$;

create or replace function private.active_assignees(p_request uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(profile_id), '{}') from public.request_assignments
  where service_request_id = p_request and unassigned_at is null
$$;

create or replace function private.check_activity_date(p_date date, p_role public.user_role) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_limit integer;
begin
  if p_date is null then
    perform private.fail('Informe a data da atividade.', 'activityDate');
  end if;
  if p_date > public.today_sp() then
    perform private.fail('A data da atividade não pode ser futura.', 'activityDate');
  end if;
  if p_role <> 'admin' then
    select activity_backdate_limit_days into v_limit from public.company_settings where id = 1;
    if p_date < public.today_sp() - v_limit then
      perform private.fail(format('Lançamentos com mais de %s dias de atraso devem ser feitos pela administração.', v_limit), 'activityDate');
    end if;
  end if;
end $$;

-- Insere o fato (lançamento) sem eventos de chamado. Usado por work_entry_create e request_mark_executed.
create or replace function private.insert_work_entry(
  p_client_request_id uuid,
  p_site_id uuid,
  p_site_area_id uuid,
  p_activity_date date,
  p_kind public.work_kind,
  p_request_id uuid,
  p_occurrence_id uuid,
  p_description text,
  p_solution text,
  p_materials text,
  p_hours numeric,
  p_outcome public.work_outcome,
  p_blocker_reason_id uuid,
  p_next_step text,
  p_participant_ids uuid[],
  p_photo_ids uuid[],
  p_photo_role public.evidence_role
) returns public.work_entries
language plpgsql security definer set search_path = '' as $$
declare
  v_entry public.work_entries;
  v_pid uuid;
  v_participants uuid[];
begin
  if private.blank(p_description) then
    perform private.fail('Descreva o que foi feito.', 'description');
  end if;
  if p_hours is not null and (p_hours <= 0 or p_hours > 24) then
    perform private.fail('Horas trabalhadas devem estar entre 0 e 24.', 'hoursWorked');
  end if;
  if p_outcome <> 'executado' and p_blocker_reason_id is null then
    perform private.fail('Informe o motivo da atividade parcial ou não executada.', 'blockerReasonId');
  end if;
  if p_site_area_id is not null and not exists (
    select 1 from public.site_areas a where a.id = p_site_area_id and a.site_id = p_site_id
  ) then
    perform private.fail('Ambiente não pertence ao local.', 'siteAreaId');
  end if;

  v_participants := array(select distinct x from unnest(coalesce(p_participant_ids, '{}') || auth.uid()) as x where x is not null);
  foreach v_pid in array v_participants loop
    if not private.profile_can_work_at(v_pid, p_site_id) then
      perform private.fail('Participante sem vínculo ativo com este local.', 'participantIds');
    end if;
  end loop;

  insert into public.work_entries (
    site_id, site_area_id, activity_date, author_id, service_request_id, task_occurrence_id, kind,
    description, solution, materials, hours_worked, outcome, blocker_reason_id, next_step,
    submitted_payload, client_request_id
  ) values (
    p_site_id, p_site_area_id, p_activity_date, auth.uid(), p_request_id, p_occurrence_id, p_kind,
    trim(p_description), nullif(trim(p_solution), ''), nullif(trim(p_materials), ''), p_hours, p_outcome,
    p_blocker_reason_id, nullif(trim(p_next_step), ''),
    jsonb_build_object(
      'activity_date', p_activity_date, 'kind', p_kind, 'description', p_description, 'solution', p_solution,
      'materials', p_materials, 'hours_worked', p_hours, 'outcome', p_outcome, 'blocker_reason_id', p_blocker_reason_id,
      'next_step', p_next_step, 'participant_ids', to_jsonb(v_participants), 'photo_ids', to_jsonb(coalesce(p_photo_ids, '{}'))
    ),
    p_client_request_id
  ) returning * into v_entry;

  insert into public.work_entry_participants (work_entry_id, profile_id)
  select v_entry.id, x from unnest(v_participants) as x;

  perform private.link_attachments(p_photo_ids, 'work_entry', v_entry.id, p_photo_role, p_site_id);
  return v_entry;
end $$;

-- ---------------------------------------------------------------------------
-- Abertura (administração em ambos os cenários; portal do cliente pendente Q1)
-- ---------------------------------------------------------------------------
create or replace function public.request_open(
  p_client_request_id uuid,
  p_site_id uuid,
  p_title text,
  p_description text,
  p_origin public.request_origin default 'cliente_externo',
  p_channel public.request_channel default null,
  p_requester_contact_id uuid default null,
  p_requester_name text default null,
  p_site_area_id uuid default null,
  p_service_category_id uuid default null,
  p_priority_id uuid default null,
  p_due_date date default null,
  p_is_internal boolean default false,
  p_photo_ids uuid[] default '{}'
) returns public.service_requests
language plpgsql security definer set search_path = '' as $$
declare
  v public.service_requests;
  v_client uuid;
  v_requester text;
  v_year integer := extract(year from (now() at time zone 'America/Sao_Paulo'))::integer;
  v_number text;
begin
  perform private.require_admin();

  select * into v from public.service_requests where created_by = auth.uid() and client_request_id = p_client_request_id;
  if found then
    return v;
  end if;

  select client_id into v_client from public.sites where id = p_site_id;
  if v_client is null then
    perform private.fail('Escolha o local (obra ou unidade).', 'siteId');
  end if;
  if private.blank(p_title) then
    perform private.fail('Informe o título.', 'title');
  end if;
  if private.blank(p_description) then
    perform private.fail('Descreva o problema ou serviço.', 'description');
  end if;
  if p_origin = 'cliente_portal' then
    perform private.fail('Origem "portal do cliente" só é usada por chamados abertos pelo próprio cliente.', 'origin');
  end if;
  if p_requester_contact_id is not null and not exists (
    select 1 from public.client_contacts c where c.id = p_requester_contact_id and c.client_id = v_client
  ) then
    perform private.fail('O solicitante não pertence a este cliente.', 'requesterContactId');
  end if;

  v_requester := coalesce(
    (select c.name from public.client_contacts c where c.id = p_requester_contact_id),
    nullif(trim(p_requester_name), '')
  );
  if p_origin = 'cliente_externo' and v_requester is null then
    perform private.fail('Informe quem solicitou.', 'requesterName');
  end if;
  if p_site_area_id is not null and not exists (
    select 1 from public.site_areas a where a.id = p_site_area_id and a.site_id = p_site_id
  ) then
    perform private.fail('Ambiente não pertence ao local.', 'siteAreaId');
  end if;

  v_number := v_year::text || '-' || lpad(private.next_number('service_request', v_year)::text, 6, '0');

  begin
    insert into public.service_requests (
      number, client_id, site_id, site_area_id, origin, channel, requester_contact_id, requester_name,
      title, description, service_category_id, priority_id, due_date, is_internal, client_request_id, created_by
    ) values (
      v_number, v_client, p_site_id, p_site_area_id, p_origin, p_channel, p_requester_contact_id, v_requester,
      trim(p_title), trim(p_description), p_service_category_id, p_priority_id, p_due_date,
      coalesce(p_is_internal, false), p_client_request_id, auth.uid()
    ) returning * into v;
  exception when unique_violation then
    select * into v from public.service_requests where created_by = auth.uid() and client_request_id = p_client_request_id;
    if found then
      return v;
    end if;
    raise;
  end;

  insert into public.request_events (service_request_id, event_type, to_status, actor_id, payload)
  values (v.id, 'abertura', 'aberta', auth.uid(), jsonb_build_object(
    'origin', p_origin, 'channel', p_channel, 'requester_name', v_requester,
    'photo_count', coalesce(array_length(p_photo_ids, 1), 0), 'client_request_id', p_client_request_id
  ));
  perform private.link_attachments(p_photo_ids, 'service_request', v.id, 'inicial', p_site_id);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Triagem / programação / reprogramação
-- ---------------------------------------------------------------------------
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

-- Edição de dados (prioridade, prazo, categoria, textos) sem mudar a situação.
create or replace function public.request_update(
  p_request_id uuid,
  p_title text,
  p_description text,
  p_priority_id uuid,
  p_service_category_id uuid,
  p_due_date date,
  p_site_area_id uuid,
  p_is_internal boolean,
  p_reason text default null,
  p_client_request_id uuid default null
) returns public.service_requests
language plpgsql security definer set search_path = '' as $$
declare
  v public.service_requests;
  v_before jsonb;
  v_after jsonb;
  v_changed jsonb := '{}'::jsonb;
  v_key text;
begin
  perform private.require_admin();
  v := private.lock_request(p_request_id);
  if private.event_applied(v.id, p_client_request_id) then
    return v;
  end if;
  if v.status in ('concluida', 'cancelada') then
    perform private.fail('Reabra o chamado antes de editar.');
  end if;
  if private.blank(p_title) then
    perform private.fail('Informe o título.', 'title');
  end if;
  if private.blank(p_description) then
    perform private.fail('Descreva o problema ou serviço.', 'description');
  end if;
  if p_site_area_id is not null and not exists (
    select 1 from public.site_areas a where a.id = p_site_area_id and a.site_id = v.site_id
  ) then
    perform private.fail('Ambiente não pertence ao local.', 'siteAreaId');
  end if;

  v_before := jsonb_build_object('title', v.title, 'description', v.description, 'priority_id', v.priority_id,
    'service_category_id', v.service_category_id, 'due_date', v.due_date, 'site_area_id', v.site_area_id, 'is_internal', v.is_internal);
  v_after := jsonb_build_object('title', trim(p_title), 'description', trim(p_description), 'priority_id', p_priority_id,
    'service_category_id', p_service_category_id, 'due_date', p_due_date, 'site_area_id', p_site_area_id, 'is_internal', coalesce(p_is_internal, false));

  for v_key in select jsonb_object_keys(v_after) loop
    if (v_before -> v_key) is distinct from (v_after -> v_key) then
      v_changed := v_changed || jsonb_build_object(v_key, jsonb_build_object('de', v_before -> v_key, 'para', v_after -> v_key));
    end if;
  end loop;
  if v_changed = '{}'::jsonb then
    return v;
  end if;
  if (v_changed ? 'due_date' or v_changed ? 'priority_id') and private.blank(p_reason) then
    perform private.fail('Informe o motivo da alteração de prazo ou prioridade.', 'reason');
  end if;

  perform set_config('app.audit_reason', coalesce(p_reason, ''), true);
  update public.service_requests
     set title = trim(p_title), description = trim(p_description), priority_id = p_priority_id,
         service_category_id = p_service_category_id, due_date = p_due_date, site_area_id = p_site_area_id,
         is_internal = coalesce(p_is_internal, false)
   where id = v.id
   returning * into v;
  perform set_config('app.audit_reason', '', true);

  insert into public.request_events (service_request_id, event_type, actor_id, reason, payload)
  values (v.id, case when v_changed ? 'due_date' then 'prorrogacao'::public.request_event_type else 'edicao'::public.request_event_type end,
          auth.uid(), nullif(trim(p_reason), ''), jsonb_build_object('changes', v_changed, 'client_request_id', p_client_request_id));
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Execução de campo
-- ---------------------------------------------------------------------------
create or replace function public.request_start(p_request_id uuid, p_client_request_id uuid default null)
returns public.service_requests
language plpgsql security definer set search_path = '' as $$
declare
  v public.service_requests;
begin
  perform private.require_staff();
  v := private.lock_request(p_request_id);
  if private.event_applied(v.id, p_client_request_id) or v.status = 'em_execucao' then
    return v;
  end if;
  perform private.require_status(v, array['programada']::public.request_status[], 'iniciar');
  return private.request_transition(v, 'em_execucao', 'inicio', null, jsonb_build_object('client_request_id', p_client_request_id));
end $$;

create or replace function public.work_entry_create(
  p_client_request_id uuid,
  p_site_id uuid,
  p_activity_date date,
  p_description text,
  p_kind public.work_kind default 'execucao',
  p_service_request_id uuid default null,
  p_task_occurrence_id uuid default null,
  p_site_area_id uuid default null,
  p_solution text default null,
  p_materials text default null,
  p_hours_worked numeric default null,
  p_outcome public.work_outcome default 'executado',
  p_blocker_reason_id uuid default null,
  p_next_step text default null,
  p_participant_ids uuid[] default '{}',
  p_photo_ids uuid[] default '{}'
) returns public.work_entries
language plpgsql security definer set search_path = '' as $$
declare
  v_role public.user_role := private.require_staff();
  v_entry public.work_entries;
  v_req public.service_requests;
  v_occ public.task_occurrences;
  v_task public.tasks;
  v_request_id uuid := p_service_request_id;
begin
  select * into v_entry from public.work_entries where author_id = auth.uid() and client_request_id = p_client_request_id;
  if found then
    return v_entry;
  end if;

  if p_site_id is null or not public.has_site_access(p_site_id) then
    perform private.fail('Local não encontrado.', 'siteId', 'P0002');
  end if;
  perform private.check_activity_date(p_activity_date, v_role);

  if p_task_occurrence_id is not null then
    select * into v_occ from public.task_occurrences where id = p_task_occurrence_id for update;
    if not found or v_occ.site_id <> p_site_id then
      perform private.fail('Tarefa não encontrada para este local.', 'taskOccurrenceId', 'P0002');
    end if;
    if v_role <> 'admin' and not public.is_task_assignee(v_occ.task_id) then
      perform private.fail('Esta tarefa não está atribuída a você.', null, '42501');
    end if;
    if v_occ.status = 'cancelada' then
      perform private.fail('Tarefa cancelada.');
    end if;
    select * into v_task from public.tasks where id = v_occ.task_id;
    -- Tarefa ligada a um chamado do mesmo local: o MESMO lançamento recebe os dois vínculos (sem duplicar o fato).
    if v_request_id is null and v_task.service_request_id is not null and exists (
      select 1 from public.service_requests r
       where r.id = v_task.service_request_id and r.site_id = p_site_id and r.status in ('programada', 'em_execucao')
    ) then
      v_request_id := v_task.service_request_id;
    end if;
  end if;

  if v_request_id is not null then
    v_req := private.lock_request(v_request_id);
    if v_req.site_id <> p_site_id then
      perform private.fail('O chamado é de outro local.', 'serviceRequestId');
    end if;
    perform private.require_status(v_req, array['programada', 'em_execucao']::public.request_status[], 'registrar atividade');
  end if;

  begin
    v_entry := private.insert_work_entry(
      p_client_request_id, p_site_id, p_site_area_id, p_activity_date, p_kind, v_request_id, p_task_occurrence_id,
      p_description, p_solution, p_materials, p_hours_worked, p_outcome, p_blocker_reason_id, p_next_step,
      p_participant_ids, p_photo_ids, 'intermediaria'
    );
  exception when unique_violation then
    select * into v_entry from public.work_entries where author_id = auth.uid() and client_request_id = p_client_request_id;
    if found then
      return v_entry;
    end if;
    raise;
  end;

  if v_request_id is not null then
    if v_req.status = 'programada' then
      v_req := private.request_transition(v_req, 'em_execucao', 'inicio', null, '{}'::jsonb);
    end if;
    insert into public.request_events (service_request_id, event_type, actor_id, payload, work_entry_id)
    values (v_req.id, 'atividade', auth.uid(),
            jsonb_build_object('client_request_id', p_client_request_id, 'outcome', p_outcome, 'activity_date', p_activity_date),
            v_entry.id);
  end if;

  if v_occ.id is not null and v_occ.status = 'prevista' then
    update public.task_occurrences set status = 'iniciada', started_at = now() where id = v_occ.id;
  end if;
  return v_entry;
end $$;

create or replace function public.request_report_pending(
  p_request_id uuid,
  p_client_request_id uuid,
  p_pending_reason_id uuid,
  p_explanation text,
  p_next_action text,
  p_next_action_owner_id uuid,
  p_expected_return_date date,
  p_photo_ids uuid[] default '{}'
) returns public.service_requests
language plpgsql security definer set search_path = '' as $$
declare
  v public.service_requests;
  v_reason text;
  v_owner text;
  v_payload jsonb;
begin
  perform private.require_staff();
  v := private.lock_request(p_request_id);
  if private.event_applied(v.id, p_client_request_id) then
    return v;
  end if;
  perform private.require_status(v, array['programada', 'em_execucao']::public.request_status[], 'informar pendência');

  select name into v_reason from public.pending_reasons where id = p_pending_reason_id and is_active;
  if v_reason is null then
    perform private.fail('Escolha o motivo.', 'pendingReasonId');
  end if;
  if private.blank(p_explanation) then
    perform private.fail('Explique o que aconteceu.', 'explanation');
  end if;
  if private.blank(p_next_action) then
    perform private.fail('Informe a providência necessária.', 'nextAction');
  end if;
  select full_name into v_owner from public.profiles
   where id = p_next_action_owner_id and is_active and role in ('admin', 'worker', 'foreman');
  if v_owner is null then
    perform private.fail('Indique quem faz a próxima ação.', 'nextActionOwnerId');
  end if;
  if p_expected_return_date is null then
    perform private.fail('Informe a previsão de retorno.', 'expectedReturnDate');
  end if;
  if p_expected_return_date < public.today_sp() then
    perform private.fail('A previsão de retorno não pode estar no passado.', 'expectedReturnDate');
  end if;

  v_payload := jsonb_build_object(
    'client_request_id', p_client_request_id,
    'pending_reason_id', p_pending_reason_id, 'pending_reason', v_reason,
    'explanation', trim(p_explanation), 'next_action', trim(p_next_action),
    'next_action_owner_id', p_next_action_owner_id, 'next_action_owner_name', v_owner,
    'expected_return_date', p_expected_return_date
  );
  perform private.link_attachments(p_photo_ids, 'service_request', v.id, 'intermediaria', v.site_id);
  v := private.request_transition(v, 'pendente', 'pendencia', trim(p_explanation), v_payload);

  perform private.notify(private.admin_ids() || p_next_action_owner_id, 'pendencia',
    'Chamado ' || v.number || ' pendente: ' || v_reason, trim(p_next_action), '/admin/chamados/' || v.id);
  return v;
end $$;

create or replace function public.request_resume(p_request_id uuid, p_client_request_id uuid default null, p_note text default null)
returns public.service_requests
language plpgsql security definer set search_path = '' as $$
declare
  v public.service_requests;
begin
  perform private.require_staff();
  v := private.lock_request(p_request_id);
  if private.event_applied(v.id, p_client_request_id) then
    return v;
  end if;
  perform private.require_status(v, array['pendente']::public.request_status[], 'retomar');
  return private.request_transition(v, 'em_execucao', 'retomada', p_note, jsonb_build_object('client_request_id', p_client_request_id));
end $$;

-- "Concluí": exige solução + ao menos 1 foto de RESULTADO já enviada (Word §4, controle obrigatório).
create or replace function public.request_mark_executed(
  p_request_id uuid,
  p_client_request_id uuid,
  p_solution text,
  p_result_photo_ids uuid[],
  p_activity_date date default null,
  p_description text default null,
  p_materials text default null,
  p_hours_worked numeric default null,
  p_participant_ids uuid[] default '{}',
  p_photo_ids uuid[] default '{}'
) returns public.service_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_role public.user_role := private.require_staff();
  v public.service_requests;
  v_entry public.work_entries;
  v_linked integer;
  v_date date := coalesce(p_activity_date, public.today_sp());
begin
  v := private.lock_request(p_request_id);
  if private.event_applied(v.id, p_client_request_id) then
    return v;
  end if;
  perform private.require_status(v, array['programada', 'em_execucao']::public.request_status[], 'informar a execução');
  if private.blank(p_solution) then
    perform private.fail('Descreva a solução aplicada.', 'solution');
  end if;
  if coalesce(array_length(p_result_photo_ids, 1), 0) = 0 then
    perform private.fail('Envie ao menos 1 foto do resultado.', 'resultPhotoIds');
  end if;
  perform private.check_activity_date(v_date, v_role);

  if v.status = 'programada' then
    v := private.request_transition(v, 'em_execucao', 'inicio', null, '{}'::jsonb);
  end if;

  v_entry := private.insert_work_entry(
    p_client_request_id, v.site_id, v.site_area_id, v_date, 'execucao', v.id, null,
    coalesce(nullif(trim(p_description), ''), p_solution), p_solution, p_materials, p_hours_worked,
    'executado', null, null, p_participant_ids, p_photo_ids, 'intermediaria'
  );
  v_linked := private.link_attachments(p_result_photo_ids, 'work_entry', v_entry.id, 'resultado', v.site_id);
  if v_linked < 1 then
    perform private.fail('Envie ao menos 1 foto do resultado.', 'resultPhotoIds');
  end if;

  v := private.request_transition(v, 'executada', 'execucao_informada', null,
    jsonb_build_object('client_request_id', p_client_request_id, 'solution', trim(p_solution), 'result_photo_count', v_linked),
    v_entry.id);

  perform private.notify(private.admin_ids(), 'validacao', 'Chamado ' || v.number || ' aguardando validação',
    v.title, '/admin/chamados/' || v.id);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Decisões da administração
-- ---------------------------------------------------------------------------
create or replace function public.request_validate(p_request_id uuid, p_note text default null, p_client_request_id uuid default null)
returns public.service_requests
language plpgsql security definer set search_path = '' as $$
declare
  v public.service_requests;
begin
  perform private.require_admin();
  v := private.lock_request(p_request_id);
  if private.event_applied(v.id, p_client_request_id) then
    return v;
  end if;
  perform private.require_status(v, array['executada']::public.request_status[], 'validar');
  v := private.request_transition(v, 'concluida', 'validacao', p_note, jsonb_build_object('client_request_id', p_client_request_id));
  perform private.notify(private.active_assignees(v.id), 'validacao', 'Chamado ' || v.number || ' validado e concluído', v.title, '/campo/chamados/' || v.id);
  return v;
end $$;

create or replace function public.request_return(p_request_id uuid, p_reason text, p_client_request_id uuid default null)
returns public.service_requests
language plpgsql security definer set search_path = '' as $$
declare
  v public.service_requests;
begin
  perform private.require_admin();
  v := private.lock_request(p_request_id);
  if private.event_applied(v.id, p_client_request_id) then
    return v;
  end if;
  perform private.require_status(v, array['executada']::public.request_status[], 'devolver para correção');
  if private.blank(p_reason) then
    perform private.fail('Informe o motivo.', 'reason');
  end if;
  v := private.request_transition(v, 'em_execucao', 'devolucao', p_reason, jsonb_build_object('client_request_id', p_client_request_id));
  perform private.notify(private.active_assignees(v.id), 'devolucao', 'Chamado ' || v.number || ' devolvido para correção', trim(p_reason), '/campo/chamados/' || v.id);
  return v;
end $$;

create or replace function public.request_cancel(p_request_id uuid, p_reason text, p_client_request_id uuid default null)
returns public.service_requests
language plpgsql security definer set search_path = '' as $$
declare
  v public.service_requests;
begin
  perform private.require_admin();
  v := private.lock_request(p_request_id);
  if private.event_applied(v.id, p_client_request_id) then
    return v;
  end if;
  perform private.require_status(v, array['aberta', 'programada', 'em_execucao', 'pendente']::public.request_status[], 'cancelar');
  if private.blank(p_reason) then
    perform private.fail('Informe o motivo.', 'reason');
  end if;
  v := private.request_transition(v, 'cancelada', 'cancelamento', p_reason, jsonb_build_object('client_request_id', p_client_request_id));
  perform private.notify(private.active_assignees(v.id), 'cancelamento', 'Chamado ' || v.number || ' cancelado', trim(p_reason), '/campo/chamados/' || v.id);
  return v;
end $$;

-- Reabertura preserva o evento de conclusão anterior (eventos são imutáveis).
create or replace function public.request_reopen(p_request_id uuid, p_reason text, p_client_request_id uuid default null)
returns public.service_requests
language plpgsql security definer set search_path = '' as $$
declare
  v public.service_requests;
begin
  perform private.require_admin();
  v := private.lock_request(p_request_id);
  if private.event_applied(v.id, p_client_request_id) then
    return v;
  end if;
  perform private.require_status(v, array['concluida', 'cancelada']::public.request_status[], 'reabrir');
  if private.blank(p_reason) then
    perform private.fail('Informe o motivo.', 'reason');
  end if;
  return private.request_transition(v, 'aberta', 'reabertura', p_reason, jsonb_build_object('client_request_id', p_client_request_id));
end $$;

create or replace function public.request_comment(
  p_request_id uuid,
  p_client_request_id uuid,
  p_body text,
  p_is_internal boolean default false
) returns public.request_comments
language plpgsql security definer set search_path = '' as $$
declare
  v public.service_requests;
  v_comment public.request_comments;
begin
  perform private.require_staff();
  select * into v_comment from public.request_comments where author_id = auth.uid() and client_request_id = p_client_request_id;
  if found then
    return v_comment;
  end if;
  v := private.lock_request(p_request_id);
  if private.blank(p_body) then
    perform private.fail('Escreva o comentário.', 'body');
  end if;
  select * into v_comment from public.request_comments where author_id = auth.uid() and client_request_id = p_client_request_id;
  if found then
    return v_comment;
  end if;
  insert into public.request_comments (service_request_id, author_id, body, is_internal, client_request_id)
  values (v.id, auth.uid(), trim(p_body), coalesce(p_is_internal, false), p_client_request_id)
  returning * into v_comment;
  insert into public.request_events (service_request_id, event_type, actor_id, payload, is_internal)
  values (v.id, 'comentario', auth.uid(), jsonb_build_object('comment_id', v_comment.id, 'client_request_id', p_client_request_id), v_comment.is_internal);
  return v_comment;
end $$;

create or replace function public.request_add_photos(
  p_request_id uuid,
  p_client_request_id uuid,
  p_photo_ids uuid[],
  p_role public.evidence_role default 'intermediaria'
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v public.service_requests;
  v_count integer;
begin
  perform private.require_staff();
  v := private.lock_request(p_request_id);
  if private.event_applied(v.id, p_client_request_id) then
    return 0;
  end if;
  if p_role not in ('inicial', 'intermediaria', 'resultado') then
    perform private.fail('Tipo de foto inválido.', 'role');
  end if;
  if v.status in ('concluida', 'cancelada') and not public.is_admin() then
    perform private.fail('Chamado encerrado; peça à administração para reabrir.');
  end if;
  v_count := private.link_attachments(p_photo_ids, 'service_request', v.id, p_role, v.site_id);
  insert into public.request_events (service_request_id, event_type, actor_id, payload)
  values (v.id, 'anexo_adicionado', auth.uid(), jsonb_build_object('count', v_count, 'role', p_role, 'client_request_id', p_client_request_id));
  return v_count;
end $$;

-- Revogação de anexo também registra evento no(s) chamado(s) afetado(s).
create or replace function public.attachment_revoke(p_attachment_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_request uuid;
begin
  perform private.require_admin();
  if private.blank(p_reason) then
    perform private.fail('Informe o motivo da remoção.', 'reason');
  end if;
  update public.attachments
     set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = trim(p_reason)
   where id = p_attachment_id and revoked_at is null;
  if not found then
    perform private.fail('Anexo não encontrado ou já removido.');
  end if;
  for v_request in
    select l.entity_id from public.attachment_links l where l.attachment_id = p_attachment_id and l.entity_type = 'service_request'
    union
    select w.service_request_id from public.attachment_links l join public.work_entries w on w.id = l.entity_id
     where l.attachment_id = p_attachment_id and l.entity_type = 'work_entry' and w.service_request_id is not null
  loop
    insert into public.request_events (service_request_id, event_type, actor_id, reason, payload)
    values (v_request, 'anexo_revogado', auth.uid(), trim(p_reason), jsonb_build_object('attachment_id', p_attachment_id));
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Revisão dos lançamentos pela administração (original preservado)
-- ---------------------------------------------------------------------------
create or replace function public.work_entry_adjust(
  p_work_entry_id uuid,
  p_reason text,
  p_description text,
  p_solution text,
  p_materials text,
  p_hours_worked numeric,
  p_activity_date date,
  p_client_visible boolean
) returns public.work_entries
language plpgsql security definer set search_path = '' as $$
declare
  v public.work_entries;
begin
  perform private.require_admin();
  if private.blank(p_reason) then
    perform private.fail('Informe o motivo do ajuste.', 'reason');
  end if;
  if private.blank(p_description) then
    perform private.fail('Descreva o que foi feito.', 'description');
  end if;
  if p_hours_worked is not null and (p_hours_worked <= 0 or p_hours_worked > 24) then
    perform private.fail('Horas trabalhadas devem estar entre 0 e 24.', 'hoursWorked');
  end if;
  perform private.check_activity_date(p_activity_date, 'admin');
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.work_entries
     set description = trim(p_description), solution = nullif(trim(p_solution), ''), materials = nullif(trim(p_materials), ''),
         hours_worked = p_hours_worked, activity_date = p_activity_date, client_visible = coalesce(p_client_visible, true),
         review_status = 'ajustado', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_work_entry_id
   returning * into v;
  perform set_config('app.audit_reason', '', true);
  if not found then
    perform private.fail('Lançamento não encontrado.', null, 'P0002');
  end if;
  return v;
end $$;

create or replace function public.work_entries_mark_reviewed(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  perform private.require_admin();
  update public.work_entries set review_status = 'revisado', reviewed_by = auth.uid(), reviewed_at = now()
   where id = any (p_ids) and review_status = 'enviado';
  get diagnostics v_count = row_count;
  return v_count;
end $$;
