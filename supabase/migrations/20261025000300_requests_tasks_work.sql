-- Chamados/OS (mesmo registro do início ao fim), tarefas/agenda e lançamentos de atividade.
-- work_entries é a FONTE ÚNICA do que foi feito; diário e relatórios são projeções.

create type public.request_status as enum (
  'aberta', 'programada', 'em_execucao', 'pendente', 'executada', 'concluida', 'cancelada'
);
create type public.request_origin as enum ('cliente_portal', 'cliente_externo', 'interna', 'programada');
create type public.request_channel as enum ('portal', 'whatsapp', 'telefone', 'email', 'presencial', 'outro');
create type public.request_event_type as enum (
  'abertura', 'classificacao', 'atribuicao', 'reprogramacao', 'prorrogacao', 'inicio', 'atividade', 'pendencia',
  'retomada', 'execucao_informada', 'devolucao', 'validacao', 'cancelamento', 'reabertura', 'comentario',
  'anexo_adicionado', 'anexo_revogado', 'edicao'
);
create type public.task_status as enum ('planejada', 'em_andamento', 'concluida', 'cancelada');
create type public.occurrence_status as enum ('prevista', 'iniciada', 'concluida', 'nao_realizada', 'cancelada');
create type public.work_kind as enum ('execucao', 'visita', 'vistoria', 'recebimento_material', 'apoio', 'compra', 'outro');
create type public.work_outcome as enum ('executado', 'parcial', 'nao_executado');
create type public.work_review_status as enum ('enviado', 'revisado', 'ajustado');

-- ---------------------------------------------------------------------------
-- Chamados / ordens de serviço
-- ---------------------------------------------------------------------------
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  client_id uuid not null references public.clients (id),
  site_id uuid not null,
  site_area_id uuid,
  origin public.request_origin not null,
  channel public.request_channel,
  requester_contact_id uuid references public.client_contacts (id),
  requester_name text,
  title text not null check (length(trim(title)) > 0),
  description text not null check (length(trim(description)) > 0),
  service_category_id uuid references public.service_categories (id),
  priority_id uuid references public.priority_definitions (id),
  status public.request_status not null default 'aberta',
  scheduled_date date,
  due_date date,
  task_id uuid,
  is_internal boolean not null default false,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  cancelled_at timestamptz,
  current_pending jsonb,
  version integer not null default 1,
  client_request_id uuid not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, client_request_id),
  foreign key (site_id, client_id) references public.sites (id, client_id),
  foreign key (site_area_id, site_id) references public.site_areas (id, site_id)
);
create index service_requests_site_status_idx on public.service_requests (site_id, status);
create index service_requests_client_opened_idx on public.service_requests (client_id, opened_at);
create index service_requests_status_due_idx on public.service_requests (status, due_date);
create index service_requests_scheduled_idx on public.service_requests (scheduled_date);

create trigger service_requests_updated_at before update on public.service_requests
  for each row execute function private.set_updated_at();

-- A situação só muda pelas funções de transição (que ligam app.in_transition).
create or replace function private.guard_request_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.in_transition', true), '') <> 'on' then
    raise exception 'A situação do chamado só muda pelas ações do sistema.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger service_requests_status_guard before update on public.service_requests
  for each row execute function private.guard_request_status();

create table public.request_assignments (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests (id),
  profile_id uuid not null references public.profiles (id),
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles (id),
  unassigned_at timestamptz,
  unassigned_by uuid references public.profiles (id)
);
create unique index request_assignments_open_uidx on public.request_assignments (service_request_id, profile_id)
  where unassigned_at is null;
create index request_assignments_profile_idx on public.request_assignments (profile_id) where unassigned_at is null;

-- Trilha imutável. clock_timestamp() ordena eventos da mesma transação.
create table public.request_events (
  id bigint generated always as identity primary key,
  service_request_id uuid not null references public.service_requests (id),
  event_type public.request_event_type not null,
  from_status public.request_status,
  to_status public.request_status,
  actor_id uuid references public.profiles (id),
  occurred_at timestamptz not null default clock_timestamp(),
  reason text,
  payload jsonb not null default '{}'::jsonb,
  work_entry_id uuid,
  is_internal boolean not null default false
);
create index request_events_request_idx on public.request_events (service_request_id, occurred_at, id);
create index request_events_status_idx on public.request_events (occurred_at) where to_status is not null;
create trigger request_events_immutable before update or delete on public.request_events
  for each row execute function private.forbid_mutation();

create table public.request_comments (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests (id),
  author_id uuid not null references public.profiles (id),
  body text not null check (length(trim(body)) > 0),
  is_internal boolean not null default false,
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  unique (author_id, client_request_id)
);
create index request_comments_request_idx on public.request_comments (service_request_id, created_at);

-- ---------------------------------------------------------------------------
-- Tarefas (agenda) e ocorrências por local
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  kind_id uuid references public.task_kinds (id),
  priority_id uuid references public.priority_definitions (id),
  scheduled_date date not null,
  due_date date,
  status public.task_status not null default 'planejada',
  service_request_id uuid references public.service_requests (id),
  client_request_id uuid not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, client_request_id)
);
create index tasks_scheduled_idx on public.tasks (scheduled_date);
create trigger tasks_updated_at before update on public.tasks
  for each row execute function private.set_updated_at();

alter table public.service_requests
  add constraint service_requests_task_fk foreign key (task_id) references public.tasks (id);

create table public.task_assignments (
  task_id uuid not null references public.tasks (id),
  profile_id uuid not null references public.profiles (id),
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles (id),
  primary key (task_id, profile_id)
);
create index task_assignments_profile_idx on public.task_assignments (profile_id);

create table public.task_occurrences (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id),
  site_id uuid not null references public.sites (id),
  site_area_id uuid,
  scheduled_date date not null,
  status public.occurrence_status not null default 'prevista',
  started_at timestamptz,
  finished_at timestamptz,
  no_show_reason text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (site_area_id, site_id) references public.site_areas (id, site_id)
);
create index task_occurrences_site_date_idx on public.task_occurrences (site_id, scheduled_date);
create index task_occurrences_task_idx on public.task_occurrences (task_id);
create trigger task_occurrences_updated_at before update on public.task_occurrences
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Lançamentos de atividade (fonte única)
-- ---------------------------------------------------------------------------
create table public.work_entries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id),
  site_area_id uuid,
  activity_date date not null,
  author_id uuid not null references public.profiles (id),
  service_request_id uuid references public.service_requests (id),
  task_occurrence_id uuid references public.task_occurrences (id),
  kind public.work_kind not null default 'execucao',
  description text not null check (length(trim(description)) > 0),
  solution text,
  materials text,
  hours_worked numeric(5, 2) check (hours_worked is null or (hours_worked > 0 and hours_worked <= 24)),
  outcome public.work_outcome not null default 'executado',
  blocker_reason_id uuid references public.pending_reasons (id),
  next_step text,
  client_visible boolean not null default true,
  review_status public.work_review_status not null default 'enviado',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  submitted_payload jsonb not null,
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, client_request_id),
  foreign key (site_area_id, site_id) references public.site_areas (id, site_id),
  check (outcome = 'executado' or blocker_reason_id is not null)
);
create index work_entries_site_date_idx on public.work_entries (site_id, activity_date);
create index work_entries_request_idx on public.work_entries (service_request_id);
create index work_entries_occurrence_idx on public.work_entries (task_occurrence_id);
create index work_entries_author_date_idx on public.work_entries (author_id, activity_date);
create trigger work_entries_updated_at before update on public.work_entries
  for each row execute function private.set_updated_at();

alter table public.request_events
  add constraint request_events_work_entry_fk foreign key (work_entry_id) references public.work_entries (id);

create table public.work_entry_participants (
  work_entry_id uuid not null references public.work_entries (id),
  profile_id uuid not null references public.profiles (id),
  primary key (work_entry_id, profile_id)
);
create index work_entry_participants_profile_idx on public.work_entry_participants (profile_id);

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------
create trigger audit_service_requests after update on public.service_requests
  for each row execute function private.audit_row();
create trigger audit_work_entries after update on public.work_entries
  for each row execute function private.audit_row();
create trigger audit_tasks after insert or update on public.tasks
  for each row execute function private.audit_row();
create trigger audit_task_occurrences after insert or update on public.task_occurrences
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- RLS (escrita somente via RPC)
-- ---------------------------------------------------------------------------
alter table public.service_requests enable row level security;
alter table public.request_assignments enable row level security;
alter table public.request_events enable row level security;
alter table public.request_comments enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;
alter table public.task_occurrences enable row level security;
alter table public.work_entries enable row level security;
alter table public.work_entry_participants enable row level security;

create or replace function public.is_task_assignee(p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.task_assignments ta where ta.task_id = p_task and ta.profile_id = auth.uid())
$$;

create policy service_requests_select on public.service_requests for select to authenticated
  using (public.has_site_access(site_id));

create policy request_assignments_select on public.request_assignments for select to authenticated
  using (exists (select 1 from public.service_requests r where r.id = request_assignments.service_request_id));

create policy request_events_select on public.request_events for select to authenticated
  using (exists (select 1 from public.service_requests r where r.id = request_events.service_request_id));

create policy request_comments_select on public.request_comments for select to authenticated
  using (exists (select 1 from public.service_requests r where r.id = request_comments.service_request_id));

create policy tasks_select on public.tasks for select to authenticated
  using (public.is_admin() or (public.is_staff() and public.is_task_assignee(id)));

create policy task_assignments_select on public.task_assignments for select to authenticated
  using (public.is_admin() or (public.is_staff() and public.is_task_assignee(task_id)));

create policy task_occurrences_select on public.task_occurrences for select to authenticated
  using (public.is_admin() or (public.is_task_assignee(task_id) and public.has_site_access(site_id)));

create policy work_entries_select on public.work_entries for select to authenticated
  using (public.has_site_access(site_id));

create policy work_entry_participants_select on public.work_entry_participants for select to authenticated
  using (exists (select 1 from public.work_entries w where w.id = work_entry_participants.work_entry_id));
