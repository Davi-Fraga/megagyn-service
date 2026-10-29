-- Orçamentos/propostas comerciais (COMPLEMENTO M7). Valor comercial: não é despesa nem receita.

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  client_id uuid not null references public.clients (id),
  client_contact_id uuid references public.client_contacts (id),
  site_id uuid references public.sites (id),
  service_location_text text,
  title text,
  issued_at date not null default public.today_sp(),
  valid_until date,
  execution_deadline_text text,
  payment_terms text,
  warranty_text text,
  inclusions_text text,
  observations text,
  technical_notes text,
  intro_text text,
  declaration_text text,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'enviado', 'aprovado', 'rejeitado', 'expirado', 'cancelado')),
  total_cents bigint not null default 0 check (total_cents >= 0),
  accepted_at timestamptz,
  accepted_note text,
  status_reason text,
  current_version_no integer not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= issued_at)
);
create index quotes_client_idx on public.quotes (client_id, issued_at desc);
create index quotes_status_idx on public.quotes (status);
create trigger quotes_updated_at before update on public.quotes
  for each row execute function private.set_updated_at();

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  location_label text not null check (length(trim(location_label)) > 0),
  title text,
  pricing_mode text not null check (pricing_mode in ('global', 'detalhado')),
  quantity numeric(12, 3) check (quantity is null or quantity > 0),
  unit text,
  unit_price_cents bigint check (unit_price_cents is null or unit_price_cents > 0),
  subtotal_cents bigint not null check (subtotal_cents > 0),
  lines text[] not null default '{}',
  notes text,
  sort_order integer not null default 0,
  check (pricing_mode = 'global' or (quantity is not null and unit_price_cents is not null)),
  -- Subtotal detalhado = quantidade × preço, arredondado half-up (round de numeric).
  check (pricing_mode = 'global' or subtotal_cents = round(quantity * unit_price_cents))
);
create index quote_items_quote_idx on public.quote_items (quote_id, sort_order);

create table public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id),
  version_no integer not null,
  snapshot jsonb not null,
  reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (quote_id, version_no)
);
create trigger quote_versions_immutable before update or delete on public.quote_versions
  for each row execute function private.forbid_mutation();

-- Número ORC-AAAA-NNNN atribuído no banco.
create or replace function private.quote_number() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_year integer := extract(year from (now() at time zone 'America/Sao_Paulo'))::integer;
begin
  if new.number is null or new.number = '' then
    new.number := 'ORC-' || v_year || '-' || lpad(private.next_number('quote', v_year)::text, 4, '0');
  end if;
  return new;
end $$;
create trigger quotes_number before insert on public.quotes
  for each row execute function private.quote_number();

-- Total sempre igual à soma dos itens.
create or replace function private.quote_total() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_quote uuid := case when tg_op = 'DELETE' then old.quote_id else new.quote_id end;
begin
  update public.quotes set total_cents = coalesce((select sum(subtotal_cents) from public.quote_items where quote_id = v_quote), 0)
   where id = v_quote;
  return null;
end $$;
create trigger quote_items_total after insert or update or delete on public.quote_items
  for each row execute function private.quote_total();

create trigger audit_quotes after insert or update on public.quotes
  for each row execute function private.audit_row();

alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.quote_versions enable row level security;

create policy quotes_admin_select on public.quotes for select to authenticated using (public.is_admin());
create policy quotes_admin_insert on public.quotes for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
create policy quotes_admin_update on public.quotes for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy quote_items_admin_all on public.quote_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy quote_versions_admin_select on public.quote_versions for select to authenticated using (public.is_admin());
create policy quote_versions_admin_insert on public.quote_versions for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());

alter table public.sites add constraint sites_quote_fk foreign key (quote_id) references public.quotes (id);
