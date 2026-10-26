-- Agenda/tarefas (multiobra), jornada por profissional e regras de valor de serviço (COMPLEMENTO M8).

-- ---------------------------------------------------------------------------
-- Tarefas
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
  update public.tasks set status = case
      when status = 'cancelada' then 'cancelada'::public.task_status
      when v_total > 0 and v_terminal = v_total and v_done > 0 then 'concluida'::public.task_status
      when v_total > 0 and v_terminal = v_total then 'cancelada'::public.task_status
      when v_started > 0 then 'em_andamento'::public.task_status
      else 'planejada'::public.task_status end
   where id = p_task;
end $$;

create or replace function private.after_occurrence_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.refresh_task_status(new.task_id);
  return new;
end $$;
create trigger task_occurrences_refresh after insert or update of status on public.task_occurrences
  for each row execute function private.after_occurrence_change();

create or replace function public.task_create(
  p_client_request_id uuid,
  p_title text,
  p_scheduled_date date,
  p_assignee_ids uuid[],
  p_occurrences jsonb,
  p_description text default null,
  p_kind_id uuid default null,
  p_priority_id uuid default null,
  p_due_date date default null,
  p_service_request_id uuid default null
) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare
  v_task public.tasks;
  v_occ jsonb;
  v_site uuid;
  v_area uuid;
  v_date date;
  v_pid uuid;
  v_i integer := 0;
begin
  perform private.require_admin();
  select * into v_task from public.tasks where created_by = auth.uid() and client_request_id = p_client_request_id;
  if found then
    return v_task;
  end if;
  if private.blank(p_title) then
    perform private.fail('Informe a descrição curta da tarefa.', 'title');
  end if;
  if p_scheduled_date is null then
    perform private.fail('Informe o dia da tarefa.', 'scheduledDate');
  end if;
  if coalesce(array_length(p_assignee_ids, 1), 0) = 0 then
    perform private.fail('Escolha ao menos 1 responsável.', 'assigneeIds');
  end if;
  if p_occurrences is null or jsonb_typeof(p_occurrences) <> 'array' or jsonb_array_length(p_occurrences) = 0 then
    perform private.fail('Indique ao menos um local.', 'occurrences');
  end if;
  if p_service_request_id is not null and not exists (select 1 from public.service_requests where id = p_service_request_id) then
    perform private.fail('Chamado não encontrado.', 'serviceRequestId');
  end if;

  begin
    insert into public.tasks (title, description, kind_id, priority_id, scheduled_date, due_date, service_request_id, client_request_id, created_by)
    values (trim(p_title), nullif(trim(p_description), ''), p_kind_id, p_priority_id, p_scheduled_date, p_due_date,
            p_service_request_id, p_client_request_id, auth.uid())
    returning * into v_task;
  exception when unique_violation then
    select * into v_task from public.tasks where created_by = auth.uid() and client_request_id = p_client_request_id;
    if found then
      return v_task;
    end if;
    raise;
  end;

  insert into public.task_assignments (task_id, profile_id, assigned_by)
  select v_task.id, x, auth.uid() from (select distinct unnest(p_assignee_ids) as x) s;

  for v_occ in select * from jsonb_array_elements(p_occurrences) loop
    v_site := (v_occ ->> 'site_id')::uuid;
    v_area := nullif(v_occ ->> 'site_area_id', '')::uuid;
    v_date := coalesce(nullif(v_occ ->> 'scheduled_date', '')::date, p_scheduled_date);
    if v_site is null or not exists (select 1 from public.sites where id = v_site) then
      perform private.fail('Local inválido na tarefa.', 'occurrences');
    end if;
    foreach v_pid in array p_assignee_ids loop
      if not private.profile_can_work_at(v_pid, v_site) then
        perform private.fail('Responsável sem vínculo ativo com um dos locais da tarefa.', 'assigneeIds');
      end if;
    end loop;
    insert into public.task_occurrences (task_id, site_id, site_area_id, scheduled_date, sort_order)
    values (v_task.id, v_site, v_area, v_date, v_i);
    v_i := v_i + 1;
  end loop;

  perform private.notify(p_assignee_ids, 'tarefa', 'Nova tarefa: ' || v_task.title,
    'Para ' || to_char(p_scheduled_date, 'DD/MM/YYYY'), '/campo/tarefas');
  return v_task;
end $$;

-- Desdobra a tarefa em mais um local, mantendo a tarefa-pai.
create or replace function public.task_add_occurrence(p_task_id uuid, p_site_id uuid, p_scheduled_date date, p_site_area_id uuid default null)
returns public.task_occurrences
language plpgsql security definer set search_path = '' as $$
declare
  v_occ public.task_occurrences;
  v_pid uuid;
begin
  if not public.is_admin() then
    -- Encarregado/funcionário atribuído também pode registrar que a tarefa o levou a outro local autorizado.
    perform private.require_staff();
    if not public.is_task_assignee(p_task_id) or not public.has_site_access(p_site_id) then
      perform private.fail('Sem acesso a esta tarefa ou local.', null, '42501');
    end if;
  end if;
  if not exists (select 1 from public.tasks where id = p_task_id and status <> 'cancelada') then
    perform private.fail('Tarefa não encontrada.', null, 'P0002');
  end if;
  for v_pid in select profile_id from public.task_assignments where task_id = p_task_id loop
    if not private.profile_can_work_at(v_pid, p_site_id) then
      perform private.fail('Um dos responsáveis não tem vínculo com este local.', 'siteId');
    end if;
  end loop;
  insert into public.task_occurrences (task_id, site_id, site_area_id, scheduled_date, sort_order)
  values (p_task_id, p_site_id, p_site_area_id, coalesce(p_scheduled_date, public.today_sp()),
          (select coalesce(max(sort_order), 0) + 1 from public.task_occurrences where task_id = p_task_id))
  returning * into v_occ;
  return v_occ;
end $$;

create or replace function private.lock_occurrence(p_id uuid) returns public.task_occurrences
language plpgsql security definer set search_path = '' as $$
declare
  v public.task_occurrences;
begin
  select * into v from public.task_occurrences where id = p_id for update;
  if not found or not public.has_site_access(v.site_id)
     or (not public.is_admin() and not public.is_task_assignee(v.task_id)) then
    perform private.fail('Tarefa não encontrada.', null, 'P0002');
  end if;
  return v;
end $$;

create or replace function public.task_occurrence_start(p_occurrence_id uuid) returns public.task_occurrences
language plpgsql security definer set search_path = '' as $$
declare
  v public.task_occurrences;
begin
  perform private.require_staff();
  v := private.lock_occurrence(p_occurrence_id);
  if v.status = 'iniciada' then
    return v;
  end if;
  if v.status <> 'prevista' then
    perform private.fail('Esta tarefa não pode ser iniciada na situação atual.');
  end if;
  update public.task_occurrences set status = 'iniciada', started_at = now() where id = v.id returning * into v;
  return v;
end $$;

create or replace function public.task_occurrence_finish(p_occurrence_id uuid, p_notes text default null) returns public.task_occurrences
language plpgsql security definer set search_path = '' as $$
declare
  v public.task_occurrences;
begin
  perform private.require_staff();
  v := private.lock_occurrence(p_occurrence_id);
  if v.status = 'concluida' then
    return v;
  end if;
  if v.status not in ('prevista', 'iniciada') then
    perform private.fail('Esta tarefa não pode ser finalizada na situação atual.');
  end if;
  update public.task_occurrences
     set status = 'concluida', finished_at = now(), started_at = coalesce(started_at, now()),
         notes = coalesce(nullif(trim(p_notes), ''), notes)
   where id = v.id returning * into v;
  return v;
end $$;

-- Dia programado sem execução aceita justificativa (Word §5).
create or replace function public.task_occurrence_not_done(p_occurrence_id uuid, p_reason text) returns public.task_occurrences
language plpgsql security definer set search_path = '' as $$
declare
  v public.task_occurrences;
begin
  perform private.require_staff();
  v := private.lock_occurrence(p_occurrence_id);
  if v.status = 'nao_realizada' then
    return v;
  end if;
  if v.status not in ('prevista', 'iniciada') then
    perform private.fail('Esta tarefa não pode ser marcada como não realizada na situação atual.');
  end if;
  if private.blank(p_reason) then
    perform private.fail('Informe o motivo de não ter sido realizada.', 'reason');
  end if;
  update public.task_occurrences set status = 'nao_realizada', no_show_reason = trim(p_reason), finished_at = now()
   where id = v.id returning * into v;
  perform private.notify(private.admin_ids(), 'tarefa', 'Tarefa não realizada', trim(p_reason), '/admin/agenda');
  return v;
end $$;

create or replace function public.task_occurrence_reschedule(p_occurrence_id uuid, p_scheduled_date date, p_reason text)
returns public.task_occurrences
language plpgsql security definer set search_path = '' as $$
declare
  v public.task_occurrences;
begin
  perform private.require_admin();
  v := private.lock_occurrence(p_occurrence_id);
  if p_scheduled_date is null then
    perform private.fail('Informe a nova data.', 'scheduledDate');
  end if;
  if private.blank(p_reason) then
    perform private.fail('Informe o motivo da alteração.', 'reason');
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.task_occurrences
     set scheduled_date = p_scheduled_date,
         status = case when status = 'nao_realizada' then 'prevista'::public.occurrence_status else status end
   where id = v.id returning * into v;
  perform set_config('app.audit_reason', '', true);
  return v;
end $$;

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
  update public.task_occurrences set status = 'cancelada' where task_id = p_task_id and status in ('prevista', 'iniciada');
  update public.tasks set status = 'cancelada' where id = p_task_id returning * into v;
  perform set_config('app.audit_reason', '', true);
  if not found then
    perform private.fail('Tarefa não encontrada.', null, 'P0002');
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Jornada por profissional/dia (horas ≠ diárias cobradas)
-- ---------------------------------------------------------------------------
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  site_id uuid not null references public.sites (id),
  work_date date not null,
  hours numeric(5, 2) check (hours is null or (hours > 0 and hours <= 24)),
  billable boolean not null default true,
  billing_units numeric(6, 2) not null default 1 check (billing_units >= 0),
  notes text,
  source text not null default 'trabalhador' check (source in ('trabalhador', 'admin')),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, site_id, work_date)
);
create index time_entries_site_date_idx on public.time_entries (site_id, work_date);
create trigger time_entries_updated_at before update on public.time_entries
  for each row execute function private.set_updated_at();
create trigger audit_time_entries after insert or update on public.time_entries
  for each row execute function private.audit_row();

alter table public.time_entries enable row level security;
create policy time_entries_select on public.time_entries for select to authenticated
  using (public.is_admin() or profile_id = auth.uid());

create or replace function public.time_entry_upsert(
  p_site_id uuid,
  p_work_date date,
  p_hours numeric,
  p_notes text default null,
  p_profile_id uuid default null,
  p_billable boolean default null,
  p_billing_units numeric default null
) returns public.time_entries
language plpgsql security definer set search_path = '' as $$
declare
  v_role public.user_role := private.require_staff();
  v_profile uuid := coalesce(p_profile_id, auth.uid());
  v public.time_entries;
begin
  if v_role <> 'admin' and v_profile <> auth.uid() then
    perform private.fail('Você só registra a sua própria jornada.', null, '42501');
  end if;
  if v_role <> 'admin' and (p_billable is not null or p_billing_units is not null) then
    perform private.fail('Somente a administração ajusta diárias faturáveis.', null, '42501');
  end if;
  if not private.profile_can_work_at(v_profile, p_site_id) then
    perform private.fail('Profissional sem vínculo ativo com este local.', 'siteId');
  end if;
  perform private.check_activity_date(p_work_date, v_role);
  if p_hours is not null and (p_hours <= 0 or p_hours > 24) then
    perform private.fail('Horas devem estar entre 0 e 24.', 'hours');
  end if;
  if p_billing_units is not null and (p_billing_units < 0 or p_billing_units > 10) then
    perform private.fail('Quantidade de diárias inválida.', 'billingUnits');
  end if;

  select * into v from public.time_entries where profile_id = v_profile and site_id = p_site_id and work_date = p_work_date for update;
  if found then
    if v_role <> 'admin' and v.approved_at is not null then
      perform private.fail('Jornada já conferida pela administração; peça o ajuste.', null, '42501');
    end if;
    update public.time_entries
       set hours = p_hours, notes = nullif(trim(p_notes), ''),
           billable = coalesce(p_billable, billable), billing_units = coalesce(p_billing_units, billing_units),
           source = case when v_role = 'admin' then 'admin' else source end
     where id = v.id returning * into v;
  else
    insert into public.time_entries (profile_id, site_id, work_date, hours, notes, billable, billing_units, source, created_by)
    values (v_profile, p_site_id, p_work_date, p_hours, nullif(trim(p_notes), ''), coalesce(p_billable, true),
            coalesce(p_billing_units, 1), case when v_role = 'admin' then 'admin' else 'trabalhador' end, auth.uid())
    returning * into v;
  end if;
  return v;
end $$;

create or replace function public.time_entries_approve(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  perform private.require_admin();
  update public.time_entries set approved_by = auth.uid(), approved_at = now()
   where id = any (p_ids) and approved_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Regras de valor de serviço por contrato (cobrança ao cliente; não é salário nem custo)
-- ---------------------------------------------------------------------------
create table public.billing_rules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  site_id uuid references public.sites (id),
  unit_type text not null check (unit_type in ('diaria', 'hora')),
  unit_price_cents bigint not null check (unit_price_cents > 0),
  valid_from date not null,
  valid_to date,
  show_in_client_report boolean not null default false,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from),
  constraint billing_rules_no_overlap exclude using gist (
    client_id with =,
    (coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid)) with =,
    unit_type with =,
    daterange(valid_from, coalesce(valid_to, 'infinity'::date), '[]') with &&
  )
);
create trigger billing_rules_updated_at before update on public.billing_rules
  for each row execute function private.set_updated_at();
create trigger audit_billing_rules after insert or update or delete on public.billing_rules
  for each row execute function private.audit_row();

alter table public.billing_rules enable row level security;
create policy billing_rules_admin_select on public.billing_rules for select to authenticated using (public.is_admin());
create policy billing_rules_admin_insert on public.billing_rules for insert to authenticated with check (public.is_admin());
create policy billing_rules_admin_update on public.billing_rules for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
