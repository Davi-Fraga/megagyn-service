-- Fechamento mensal versionado, artefatos de relatório (PDF/CSV), publicação/entrega,
-- buckets privados e endurecimento de permissões.

create table public.monthly_closings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  site_id uuid references public.sites (id),
  period_year integer not null check (period_year between 2020 and 2100),
  period_month integer not null check (period_month between 1 and 12),
  status text not null default 'rascunho' check (status in ('rascunho', 'fechado')),
  current_version_id uuid,
  notes_internal text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index monthly_closings_period_uidx on public.monthly_closings (
  client_id, coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid), period_year, period_month
);
create trigger monthly_closings_updated_at before update on public.monthly_closings
  for each row execute function private.set_updated_at();

-- Versão emitida = snapshot imutável (critérios, cabeçalho, estado apurado, evidências).
create table public.closing_versions (
  id uuid primary key default gen_random_uuid(),
  closing_id uuid not null references public.monthly_closings (id),
  version_no integer not null check (version_no > 0),
  cutoff_at timestamptz not null,
  period_start timestamptz not null,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profiles (id),
  criteria jsonb not null,
  header_snapshot jsonb not null,
  payload jsonb not null,
  summary jsonb not null,
  reason text,
  supersedes_version_id uuid references public.closing_versions (id),
  unique (closing_id, version_no)
);
create trigger closing_versions_immutable before update or delete on public.closing_versions
  for each row execute function private.forbid_mutation();

alter table public.monthly_closings
  add constraint monthly_closings_current_version_fk foreign key (current_version_id) references public.closing_versions (id);

create table public.report_artifacts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'fechamento_detalhado', 'fechamento_resumo', 'os_individual', 'diario', 'atividades_pessoa',
    'despesas_internas', 'orcamento'
  )),
  source_type text not null,
  source_id uuid,
  params jsonb not null default '{}'::jsonb,
  file_name text not null,
  storage_key text,
  status text not null default 'na_fila' check (status in ('na_fila', 'processando', 'pronto', 'falhou')),
  attempts integer not null default 0,
  error_message text,
  page_count integer,
  size_bytes bigint,
  audience text not null default 'interno' check (audience in ('interno', 'cliente')),
  requested_by uuid references public.profiles (id),
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index report_artifacts_queue_idx on public.report_artifacts (requested_at) where status in ('na_fila', 'processando');
create index report_artifacts_source_idx on public.report_artifacts (source_type, source_id);

-- Liberação ao cliente. No cenário B registra a entrega feita por fora (canal + observação);
-- no cenário A (pendente) também alimentaria o portal.
create table public.report_publications (
  id uuid primary key default gen_random_uuid(),
  closing_version_id uuid not null references public.closing_versions (id),
  report_artifact_id uuid references public.report_artifacts (id),
  delivery_channel text,
  delivery_note text,
  published_by uuid references public.profiles (id),
  published_at timestamptz not null default now(),
  revoked_by uuid references public.profiles (id),
  revoked_at timestamptz,
  revoke_reason text
);
create index report_publications_version_idx on public.report_publications (closing_version_id);

create trigger audit_monthly_closings after insert or update on public.monthly_closings
  for each row execute function private.audit_row();
create trigger audit_closing_versions after insert on public.closing_versions
  for each row execute function private.audit_row();
create trigger audit_report_publications after insert or update on public.report_publications
  for each row execute function private.audit_row();

alter table public.monthly_closings enable row level security;
alter table public.closing_versions enable row level security;
alter table public.report_artifacts enable row level security;
alter table public.report_publications enable row level security;

create policy monthly_closings_admin_select on public.monthly_closings for select to authenticated using (public.is_admin());
create policy monthly_closings_admin_insert on public.monthly_closings for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());
create policy monthly_closings_admin_update on public.monthly_closings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy closing_versions_admin_select on public.closing_versions for select to authenticated using (public.is_admin());
create policy report_artifacts_admin_select on public.report_artifacts for select to authenticated using (public.is_admin());
create policy report_artifacts_admin_insert on public.report_artifacts for insert to authenticated
  with check (public.is_admin() and requested_by = auth.uid());
create policy report_publications_admin_select on public.report_publications for select to authenticated using (public.is_admin());

-- Emite nova versão do fechamento com numeração sequencial e trava de concorrência.
create or replace function public.closing_version_create(
  p_closing_id uuid,
  p_cutoff_at timestamptz,
  p_period_start timestamptz,
  p_criteria jsonb,
  p_header jsonb,
  p_payload jsonb,
  p_summary jsonb,
  p_reason text default null
) returns public.closing_versions
language plpgsql security definer set search_path = '' as $$
declare
  v_closing public.monthly_closings;
  v_version public.closing_versions;
  v_next integer;
begin
  perform private.require_admin();
  select * into v_closing from public.monthly_closings where id = p_closing_id for update;
  if not found then
    perform private.fail('Fechamento não encontrado.', null, 'P0002');
  end if;
  select coalesce(max(version_no), 0) + 1 into v_next from public.closing_versions where closing_id = p_closing_id;
  if v_next > 1 and private.blank(p_reason) then
    perform private.fail('Informe o motivo da nova versão.', 'reason');
  end if;
  insert into public.closing_versions (
    closing_id, version_no, cutoff_at, period_start, generated_by, criteria, header_snapshot, payload, summary, reason, supersedes_version_id
  ) values (
    p_closing_id, v_next, p_cutoff_at, p_period_start, auth.uid(), p_criteria, p_header, p_payload, p_summary,
    nullif(trim(p_reason), ''), v_closing.current_version_id
  ) returning * into v_version;
  update public.monthly_closings set status = 'fechado', current_version_id = v_version.id where id = p_closing_id;
  return v_version;
end $$;

create or replace function public.report_publication_register(
  p_closing_version_id uuid,
  p_report_artifact_id uuid,
  p_delivery_channel text,
  p_delivery_note text default null
) returns public.report_publications
language plpgsql security definer set search_path = '' as $$
declare
  v public.report_publications;
begin
  perform private.require_admin();
  if not exists (select 1 from public.closing_versions where id = p_closing_version_id) then
    perform private.fail('Versão não encontrada.', null, 'P0002');
  end if;
  if p_report_artifact_id is not null and not exists (
    select 1 from public.report_artifacts where id = p_report_artifact_id and status = 'pronto'
  ) then
    perform private.fail('Gere o PDF antes de registrar a entrega.', 'reportArtifactId');
  end if;
  if private.blank(p_delivery_channel) then
    perform private.fail('Informe como o relatório foi entregue.', 'deliveryChannel');
  end if;
  insert into public.report_publications (closing_version_id, report_artifact_id, delivery_channel, delivery_note, published_by)
  values (p_closing_version_id, p_report_artifact_id, trim(p_delivery_channel), nullif(trim(p_delivery_note), ''), auth.uid())
  returning * into v;
  return v;
end $$;

create or replace function public.report_publication_revoke(p_publication_id uuid, p_reason text) returns public.report_publications
language plpgsql security definer set search_path = '' as $$
declare
  v public.report_publications;
begin
  perform private.require_admin();
  if private.blank(p_reason) then
    perform private.fail('Informe o motivo.', 'reason');
  end if;
  update public.report_publications set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = trim(p_reason)
   where id = p_publication_id and revoked_at is null returning * into v;
  if not found then
    perform private.fail('Registro não encontrado ou já revogado.', null, 'P0002');
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Buckets privados. Sem políticas em storage.objects para anon/authenticated:
-- os bytes só saem pelo servidor, após a checagem de RLS na tabela attachments.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('evidence', 'evidence', false, 104857600, array['image/jpeg', 'image/png', 'image/webp']),
  ('receipts', 'receipts', false, 104857600, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('branding', 'branding', false, 20971520, array['image/jpeg', 'image/png', 'image/webp']),
  ('reports', 'reports', false, 524288000, array['application/pdf', 'text/csv'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Endurecimento: anon não executa funções; schema private inacessível pela API.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from anon, public;
revoke all on all tables in schema private from anon, authenticated;
revoke all on all functions in schema private from anon, authenticated, public;
