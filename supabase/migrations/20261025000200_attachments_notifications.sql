-- Anexos (fotos, comprovantes, logos, PDFs gerados) e notificações internas.
-- Arquivos ficam em buckets PRIVADOS; o acesso aos bytes é concedido pelo servidor
-- somente após ler a linha de public.attachments com a sessão do usuário (RLS).

create type public.attachment_bucket as enum ('evidence', 'receipts', 'reports', 'branding');
create type public.attachment_visibility as enum ('internal', 'client');
create type public.evidence_role as enum (
  'inicial', 'intermediaria', 'resultado', 'comprovante', 'local', 'referencia', 'documento', 'logo', 'assinatura'
);
create type public.attachment_entity as enum ('service_request', 'work_entry', 'task_occurrence', 'expense', 'quote', 'site');

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  bucket public.attachment_bucket not null,
  storage_key text not null unique,
  site_id uuid references public.sites (id),
  original_name text,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  width integer,
  height integer,
  content_hash text,
  caption text,
  derivatives jsonb not null default '{}'::jsonb,
  uploaded_by uuid not null references public.profiles (id),
  uploaded_at timestamptz not null default now(),
  client_upload_id uuid not null,
  visibility public.attachment_visibility not null default 'client',
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id),
  revoke_reason text,
  unique (uploaded_by, client_upload_id),
  check (bucket <> 'evidence' or site_id is not null)
);
create index attachments_site_idx on public.attachments (site_id, uploaded_at desc);
create index attachments_hash_idx on public.attachments (content_hash);

create table public.attachment_links (
  id uuid primary key default gen_random_uuid(),
  attachment_id uuid not null references public.attachments (id),
  entity_type public.attachment_entity not null,
  entity_id uuid not null,
  evidence_role public.evidence_role not null,
  sort_order integer not null default 0,
  linked_by uuid references public.profiles (id),
  linked_at timestamptz not null default now(),
  unique (attachment_id, entity_type, entity_id)
);
create index attachment_links_entity_idx on public.attachment_links (entity_type, entity_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  kind text not null,
  title text not null,
  body text,
  link text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_profile_idx on public.notifications (profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.attachments enable row level security;
alter table public.attachment_links enable row level security;
alter table public.notifications enable row level security;

-- Fotos de evidência: quem tem acesso ao local. Comprovantes: administração e quem enviou.
-- Logos/assinatura: equipe. PDFs gerados: administração.
create policy attachments_select on public.attachments for select to authenticated using (
  (bucket = 'evidence' and public.has_site_access(site_id))
  or (bucket = 'receipts' and (public.is_admin() or uploaded_by = auth.uid()))
  or (bucket = 'branding' and public.is_staff())
  or (bucket = 'reports' and public.is_admin())
);

-- Inserção pelo servidor de upload com a sessão do usuário, já validado o conteúdo.
create policy attachments_insert on public.attachments for insert to authenticated with check (
  uploaded_by = auth.uid() and (
    (bucket = 'evidence' and public.has_site_access(site_id))
    or (bucket = 'receipts' and public.current_app_role() in ('admin', 'foreman'))
    or (bucket = 'branding' and public.is_admin())
  )
);

create policy attachment_links_select on public.attachment_links for select to authenticated using (
  exists (select 1 from public.attachments a where a.id = attachment_links.attachment_id)
);

create policy notifications_select on public.notifications for select to authenticated
  using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Funções internas
-- ---------------------------------------------------------------------------

-- Vincula anexos já enviados a uma entidade, validando dono, local e revogação.
create or replace function private.link_attachments(
  p_ids uuid[],
  p_entity public.attachment_entity,
  p_entity_id uuid,
  p_role public.evidence_role,
  p_site uuid
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_att public.attachments;
  v_count integer := 0;
begin
  if p_ids is null then
    return 0;
  end if;
  foreach v_id in array p_ids loop
    select * into v_att from public.attachments where id = v_id;
    if not found then
      raise exception 'Anexo não encontrado. Envie a foto novamente.' using errcode = 'P0001', hint = 'photos';
    end if;
    if v_att.revoked_at is not null then
      raise exception 'Um dos anexos foi removido e não pode ser usado.' using errcode = 'P0001', hint = 'photos';
    end if;
    if v_att.uploaded_by <> auth.uid() and not public.is_admin() then
      raise exception 'Anexo enviado por outra pessoa.' using errcode = '42501', hint = 'photos';
    end if;
    if p_site is not null and v_att.bucket = 'evidence' and v_att.site_id is distinct from p_site then
      raise exception 'Foto enviada para outro local.' using errcode = 'P0001', hint = 'photos';
    end if;
    insert into public.attachment_links (attachment_id, entity_type, entity_id, evidence_role, sort_order, linked_by)
    values (v_id, p_entity, p_entity_id, p_role, v_count, auth.uid())
    on conflict (attachment_id, entity_type, entity_id) do nothing;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

create or replace function private.notify(
  p_profiles uuid[],
  p_kind text,
  p_title text,
  p_body text,
  p_link text
) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (profile_id, kind, title, body, link)
  select distinct pid, p_kind, p_title, p_body, p_link
  from unnest(p_profiles) as pid
  where pid is not null and pid is distinct from auth.uid()
$$;

create or replace function private.admin_ids() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(id), '{}') from public.profiles where role = 'admin' and is_active
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.notifications_mark_read(p_ids uuid[] default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  update public.notifications set read_at = now()
  where profile_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Remove (revoga) um anexo mantendo histórico. Somente administração.
create or replace function public.attachment_revoke(p_attachment_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Somente a administração remove anexos.' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Informe o motivo da remoção.' using errcode = 'P0001', hint = 'reason';
  end if;
  update public.attachments
     set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = trim(p_reason)
   where id = p_attachment_id and revoked_at is null;
  if not found then
    raise exception 'Anexo não encontrado ou já removido.' using errcode = 'P0001';
  end if;
end $$;

create trigger audit_attachments after update on public.attachments
  for each row execute function private.audit_row();
