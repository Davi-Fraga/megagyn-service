-- Compras/despesas INTERNAS com rateio entre obras, conferência e reembolso.
-- Nada aqui é visível a clientes (nenhuma política para o papel 'client').

create type public.expense_review_status as enum ('rascunho', 'enviado_para_conferencia', 'aprovado', 'devolvido_para_correcao');
create type public.expense_review_action as enum ('enviada', 'reenviada', 'editada', 'aprovada', 'devolvida', 'invalidada');
create type public.payer_kind as enum ('empresa', 'colaborador');
create type public.reimbursement_status as enum ('pendente', 'parcial', 'quitado');

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  supplier_id uuid references public.suppliers (id),
  supplier_name_free text,
  expense_category_id uuid references public.expense_categories (id),
  description text not null check (length(trim(description)) > 0),
  items_notes text,
  total_cents bigint not null check (total_cents > 0),
  payment_method_id uuid references public.payment_methods (id),
  document_number text,
  purchased_by uuid not null references public.profiles (id),
  paid_by_kind public.payer_kind not null default 'empresa',
  paid_by_profile_id uuid references public.profiles (id),
  service_request_id uuid references public.service_requests (id),
  task_occurrence_id uuid references public.task_occurrences (id),
  review_status public.expense_review_status not null default 'enviado_para_conferencia',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  approval_version integer not null default 0,
  notes text,
  client_request_id uuid not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, client_request_id),
  check (paid_by_kind = 'empresa' or paid_by_profile_id is not null)
);
create index expenses_date_idx on public.expenses (expense_date);
create index expenses_status_idx on public.expenses (review_status);
create index expenses_purchaser_idx on public.expenses (purchased_by);
create trigger expenses_updated_at before update on public.expenses
  for each row execute function private.set_updated_at();

create table public.expense_allocations (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id),
  site_id uuid not null references public.sites (id),
  amount_cents bigint not null check (amount_cents > 0),
  purpose text not null check (length(trim(purpose)) > 0),
  sort_order integer not null default 0,
  unique (expense_id, site_id)
);
create index expense_allocations_site_idx on public.expense_allocations (site_id);

create table public.expense_reviews (
  id bigint generated always as identity primary key,
  expense_id uuid not null references public.expenses (id),
  action public.expense_review_action not null,
  actor_id uuid references public.profiles (id),
  reason text,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index expense_reviews_expense_idx on public.expense_reviews (expense_id, created_at);
create trigger expense_reviews_immutable before update or delete on public.expense_reviews
  for each row execute function private.forbid_mutation();

create table public.reimbursements (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null unique references public.expenses (id),
  payee_profile_id uuid not null references public.profiles (id),
  amount_due_cents bigint not null check (amount_due_cents >= 0),
  amount_paid_cents bigint not null default 0 check (amount_paid_cents >= 0),
  status public.reimbursement_status not null default 'pendente',
  settled_by uuid references public.profiles (id),
  settled_at timestamptz,
  settlement_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_paid_cents <= amount_due_cents)
);
create trigger reimbursements_updated_at before update on public.reimbursements
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Integridade do rateio: verificada ao FIM da transação (constraint trigger adiado).
-- Soma das parcelas = total exato, ao menos 1 parcela. Inteiros em centavos.
-- ---------------------------------------------------------------------------
create or replace function private.check_expense_allocations() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_total bigint;
  v_sum bigint;
  v_count integer;
begin
  if tg_table_name = 'expenses' then
    v_id := new.id;
  elsif tg_op = 'DELETE' then
    v_id := old.expense_id;
  else
    v_id := new.expense_id;
  end if;

  select total_cents into v_total from public.expenses where id = v_id;
  if not found then
    return null;
  end if;
  select coalesce(sum(amount_cents), 0), count(*) into v_sum, v_count
    from public.expense_allocations where expense_id = v_id;
  if v_count = 0 then
    raise exception 'Indique ao menos uma obra beneficiada.' using errcode = '23514', hint = 'allocations';
  end if;
  if v_sum <> v_total then
    raise exception 'A soma das parcelas (%) é diferente do total da compra (%).', private.brl(v_sum), private.brl(v_total)
      using errcode = '23514', hint = 'allocations';
  end if;
  return null;
end $$;

create constraint trigger expenses_allocation_sum after insert or update on public.expenses
  deferrable initially deferred for each row execute function private.check_expense_allocations();
create constraint trigger expense_allocations_sum after insert or update or delete on public.expense_allocations
  deferrable initially deferred for each row execute function private.check_expense_allocations();

create or replace function private.reimbursement_status_trigger() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.status := case
    when new.amount_paid_cents = 0 then 'pendente'::public.reimbursement_status
    when new.amount_paid_cents < new.amount_due_cents then 'parcial'::public.reimbursement_status
    else 'quitado'::public.reimbursement_status end;
  return new;
end $$;
create trigger reimbursements_status before insert or update on public.reimbursements
  for each row execute function private.reimbursement_status_trigger();

create trigger audit_expenses after insert or update on public.expenses
  for each row execute function private.audit_row();
create trigger audit_expense_allocations after insert or update or delete on public.expense_allocations
  for each row execute function private.audit_row();
create trigger audit_reimbursements after insert or update or delete on public.reimbursements
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- RLS: leitura apenas para administração e para quem lançou/comprou. Escrita só por RPC.
-- ---------------------------------------------------------------------------
alter table public.expenses enable row level security;
alter table public.expense_allocations enable row level security;
alter table public.expense_reviews enable row level security;
alter table public.reimbursements enable row level security;

create policy expenses_select on public.expenses for select to authenticated using (
  public.is_admin() or (public.current_app_role() = 'foreman' and (created_by = auth.uid() or purchased_by = auth.uid()))
);
create policy expense_allocations_select on public.expense_allocations for select to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_allocations.expense_id));
create policy expense_reviews_select on public.expense_reviews for select to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_reviews.expense_id));
create policy reimbursements_select on public.reimbursements for select to authenticated
  using (public.is_admin() or (public.is_staff() and payee_profile_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function private.expense_snapshot(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total_cents', e.total_cents, 'expense_date', e.expense_date, 'paid_by_kind', e.paid_by_kind,
    'paid_by_profile_id', e.paid_by_profile_id, 'supplier_id', e.supplier_id, 'description', e.description,
    'allocations', coalesce((
      select jsonb_agg(jsonb_build_object('site_id', a.site_id, 'amount_cents', a.amount_cents, 'purpose', a.purpose) order by a.sort_order, a.site_id)
      from public.expense_allocations a where a.expense_id = e.id
    ), '[]'::jsonb)
  )
  from public.expenses e where e.id = p_id
$$;

-- Parte financeira do snapshot (o que invalida uma aprovação quando muda).
create or replace function private.expense_financial(p jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'total_cents', p -> 'total_cents', 'expense_date', p -> 'expense_date', 'paid_by_kind', p -> 'paid_by_kind',
    'paid_by_profile_id', p -> 'paid_by_profile_id',
    'allocations', (select coalesce(jsonb_agg(jsonb_build_object('site_id', x -> 'site_id', 'amount_cents', x -> 'amount_cents') order by x ->> 'site_id'), '[]'::jsonb)
                    from jsonb_array_elements(p -> 'allocations') x)
  )
$$;

create or replace function public.expense_save(
  p_client_request_id uuid,
  p_expense_date date,
  p_description text,
  p_total_cents bigint,
  p_allocations jsonb,
  p_expense_id uuid default null,
  p_supplier_id uuid default null,
  p_supplier_name_free text default null,
  p_expense_category_id uuid default null,
  p_items_notes text default null,
  p_payment_method_id uuid default null,
  p_document_number text default null,
  p_paid_by_kind public.payer_kind default 'empresa',
  p_paid_by_profile_id uuid default null,
  p_purchased_by uuid default null,
  p_service_request_id uuid default null,
  p_task_occurrence_id uuid default null,
  p_notes text default null,
  p_receipt_ids uuid[] default '{}',
  p_submit boolean default true
) returns public.expenses
language plpgsql security definer set search_path = '' as $$
declare
  v_role public.user_role := private.require_staff();
  v public.expenses;
  v_old jsonb;
  v_new jsonb;
  v_alloc jsonb;
  v_site uuid;
  v_amount bigint;
  v_i integer := 0;
  v_purchaser uuid;
  v_payee uuid;
  v_was_status public.expense_review_status;
  v_action public.expense_review_action;
  v_receipts integer;
  v_reimb public.reimbursements;
  v_sum bigint;
begin
  if v_role not in ('admin', 'foreman') then
    perform private.fail('Somente administração e encarregado registram compras.', null, '42501');
  end if;
  if p_expense_id is null then
    select * into v from public.expenses where created_by = auth.uid() and client_request_id = p_client_request_id;
    if found then
      return v;
    end if;
  end if;

  if p_expense_date is null then
    perform private.fail('Informe a data da compra.', 'expenseDate');
  end if;
  if p_expense_date > public.today_sp() then
    perform private.fail('A data da compra não pode ser futura.', 'expenseDate');
  end if;
  if private.blank(p_description) then
    perform private.fail('Descreva os itens ou serviços comprados.', 'description');
  end if;
  if p_total_cents is null or p_total_cents <= 0 then
    perform private.fail('Informe o valor total da compra (maior que zero).', 'totalCents');
  end if;
  if p_supplier_id is null and private.blank(p_supplier_name_free) then
    perform private.fail('Informe o fornecedor.', 'supplier');
  end if;
  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) = 0 then
    perform private.fail('Indique ao menos uma obra beneficiada.', 'allocations');
  end if;

  v_purchaser := case when v_role = 'admin' then coalesce(p_purchased_by, auth.uid()) else auth.uid() end;
  if not exists (select 1 from public.profiles where id = v_purchaser and role in ('admin', 'foreman', 'worker')) then
    perform private.fail('Comprador inválido.', 'purchasedBy');
  end if;
  v_payee := case when p_paid_by_kind = 'colaborador' then coalesce(p_paid_by_profile_id, v_purchaser) else null end;
  if v_payee is not null and not exists (select 1 from public.profiles where id = v_payee and role in ('admin', 'foreman', 'worker')) then
    perform private.fail('Pessoa a reembolsar inválida.', 'paidByProfileId');
  end if;

  if p_expense_id is null then
    begin
    insert into public.expenses (
      expense_date, supplier_id, supplier_name_free, expense_category_id, description, items_notes, total_cents,
      payment_method_id, document_number, purchased_by, paid_by_kind, paid_by_profile_id, service_request_id,
      task_occurrence_id, notes, review_status, submitted_at, client_request_id, created_by
    ) values (
      p_expense_date, p_supplier_id, nullif(trim(p_supplier_name_free), ''), p_expense_category_id, trim(p_description),
      nullif(trim(p_items_notes), ''), p_total_cents, p_payment_method_id, nullif(trim(p_document_number), ''),
      v_purchaser, p_paid_by_kind, v_payee, p_service_request_id, p_task_occurrence_id, nullif(trim(p_notes), ''),
      case when p_submit then 'enviado_para_conferencia'::public.expense_review_status else 'rascunho'::public.expense_review_status end,
      case when p_submit then now() end, p_client_request_id, auth.uid()
    ) returning * into v;
    exception when unique_violation then
      -- Envio simultâneo com a mesma chave (clique duplo): devolve o registro já criado.
      select * into v from public.expenses where created_by = auth.uid() and client_request_id = p_client_request_id;
      if found then
        return v;
      end if;
      raise;
    end;
    v_was_status := null;
  else
    select * into v from public.expenses where id = p_expense_id for update;
    if not found or (v_role <> 'admin' and v.created_by <> auth.uid()) then
      perform private.fail('Compra não encontrada.', null, 'P0002');
    end if;
    v_was_status := v.review_status;
    v_old := private.expense_snapshot(v.id);
    update public.expenses set
      expense_date = p_expense_date, supplier_id = p_supplier_id, supplier_name_free = nullif(trim(p_supplier_name_free), ''),
      expense_category_id = p_expense_category_id, description = trim(p_description), items_notes = nullif(trim(p_items_notes), ''),
      total_cents = p_total_cents, payment_method_id = p_payment_method_id, document_number = nullif(trim(p_document_number), ''),
      purchased_by = v_purchaser, paid_by_kind = p_paid_by_kind, paid_by_profile_id = v_payee,
      service_request_id = p_service_request_id, task_occurrence_id = p_task_occurrence_id, notes = nullif(trim(p_notes), '')
    where id = v.id returning * into v;
    delete from public.expense_allocations where expense_id = v.id;
  end if;

  for v_alloc in select * from jsonb_array_elements(p_allocations) loop
    v_site := nullif(v_alloc ->> 'site_id', '')::uuid;
    v_amount := (v_alloc ->> 'amount_cents')::bigint;
    if v_site is null then
      perform private.fail(format('Parcela %s: escolha a obra.', v_i + 1), 'allocations');
    end if;
    if v_amount is null or v_amount <= 0 then
      perform private.fail(format('Parcela %s: valor deve ser maior que zero.', v_i + 1), 'allocations');
    end if;
    if private.blank(v_alloc ->> 'purpose') then
      perform private.fail(format('Parcela %s: informe a finalidade.', v_i + 1), 'allocations');
    end if;
    if not public.has_site_access(v_site) then
      perform private.fail(format('Parcela %s: obra sem acesso autorizado.', v_i + 1), 'allocations');
    end if;
    begin
      insert into public.expense_allocations (expense_id, site_id, amount_cents, purpose, sort_order)
      values (v.id, v_site, v_amount, trim(v_alloc ->> 'purpose'), v_i);
    exception when unique_violation then
      perform private.fail(format('Parcela %s: obra repetida; some os valores numa parcela só.', v_i + 1), 'allocations');
    end;
    v_i := v_i + 1;
  end loop;

  -- Verificação antecipada (a constraint adiada repete no commit).
  select coalesce(sum(amount_cents), 0)::bigint into v_sum from public.expense_allocations where expense_id = v.id;
  if v_sum <> p_total_cents then
    perform private.fail(format('A soma das parcelas (%s) é diferente do total da compra (%s).',
      private.brl(v_sum), private.brl(p_total_cents)), 'allocations');
  end if;

  perform private.link_attachments(p_receipt_ids, 'expense', v.id, 'comprovante', null);
  select count(*) into v_receipts from public.attachment_links l join public.attachments a on a.id = l.attachment_id
   where l.entity_type = 'expense' and l.entity_id = v.id and a.revoked_at is null;
  if p_submit and v_receipts = 0 and v_role <> 'admin' then
    perform private.fail('Anexe a foto ou o PDF do comprovante.', 'receipts');
  end if;

  v_new := private.expense_snapshot(v.id);

  -- Situação da conferência.
  if v_was_status is null then
    v_action := case when p_submit then 'enviada'::public.expense_review_action else null end;
  elsif v_was_status = 'aprovado' and private.expense_financial(v_old) is distinct from private.expense_financial(v_new) then
    insert into public.expense_reviews (expense_id, action, actor_id, reason, snapshot)
    values (v.id, 'invalidada', auth.uid(), 'Valor, data, pagador ou rateio alterado após aprovação.', v_old);
    update public.expenses set review_status = 'enviado_para_conferencia', submitted_at = now(), reviewed_at = null, reviewed_by = null
     where id = v.id returning * into v;
    v_action := 'reenviada';
  elsif v_was_status = 'aprovado' then
    v_action := 'editada';
  elsif v_was_status in ('rascunho', 'devolvido_para_correcao') and p_submit then
    update public.expenses set review_status = 'enviado_para_conferencia', submitted_at = now()
     where id = v.id returning * into v;
    v_action := case when v_was_status = 'rascunho' then 'enviada'::public.expense_review_action else 'reenviada'::public.expense_review_action end;
  else
    v_action := 'editada';
  end if;
  if v_action is not null then
    insert into public.expense_reviews (expense_id, action, actor_id, snapshot) values (v.id, v_action, auth.uid(), v_new);
  end if;

  -- Reembolso independente da conferência.
  select * into v_reimb from public.reimbursements where expense_id = v.id for update;
  if p_paid_by_kind = 'colaborador' then
    if v_reimb.id is null then
      insert into public.reimbursements (expense_id, payee_profile_id, amount_due_cents) values (v.id, v_payee, p_total_cents);
    else
      if p_total_cents < v_reimb.amount_paid_cents then
        perform private.fail('O novo total é menor que o valor já reembolsado.', 'totalCents');
      end if;
      update public.reimbursements set payee_profile_id = v_payee, amount_due_cents = p_total_cents where id = v_reimb.id;
    end if;
  elsif v_reimb.id is not null then
    if v_reimb.amount_paid_cents > 0 then
      perform private.fail('Já há reembolso registrado para esta compra; ajuste com a administração.', 'paidByKind');
    end if;
    delete from public.reimbursements where id = v_reimb.id;
  end if;

  if v.review_status = 'enviado_para_conferencia' and v_action in ('enviada', 'reenviada') then
    perform private.notify(private.admin_ids(), 'despesa', 'Compra enviada para conferência',
      trim(p_description) || ' — ' || private.brl(p_total_cents), '/admin/despesas/' || v.id);
  end if;
  return v;
end $$;

create or replace function public.expense_approve(p_expense_id uuid, p_note text default null) returns public.expenses
language plpgsql security definer set search_path = '' as $$
declare
  v public.expenses;
begin
  perform private.require_admin();
  select * into v from public.expenses where id = p_expense_id for update;
  if not found then
    perform private.fail('Compra não encontrada.', null, 'P0002');
  end if;
  if v.review_status = 'aprovado' then
    return v;
  end if;
  if v.review_status <> 'enviado_para_conferencia' then
    perform private.fail('Somente compras enviadas para conferência podem ser aprovadas.');
  end if;
  update public.expenses set review_status = 'aprovado', reviewed_at = now(), reviewed_by = auth.uid(),
         approval_version = approval_version + 1
   where id = v.id returning * into v;
  insert into public.expense_reviews (expense_id, action, actor_id, reason, snapshot)
  values (v.id, 'aprovada', auth.uid(), nullif(trim(p_note), ''), private.expense_snapshot(v.id));
  return v;
end $$;

create or replace function public.expense_return(p_expense_id uuid, p_reason text) returns public.expenses
language plpgsql security definer set search_path = '' as $$
declare
  v public.expenses;
begin
  perform private.require_admin();
  if private.blank(p_reason) then
    perform private.fail('Informe a justificativa da devolução.', 'reason');
  end if;
  select * into v from public.expenses where id = p_expense_id for update;
  if not found then
    perform private.fail('Compra não encontrada.', null, 'P0002');
  end if;
  if v.review_status = 'devolvido_para_correcao' then
    return v;
  end if;
  if v.review_status not in ('enviado_para_conferencia', 'aprovado') then
    perform private.fail('Esta compra não está em conferência.');
  end if;
  update public.expenses set review_status = 'devolvido_para_correcao', reviewed_at = now(), reviewed_by = auth.uid()
   where id = v.id returning * into v;
  insert into public.expense_reviews (expense_id, action, actor_id, reason, snapshot)
  values (v.id, 'devolvida', auth.uid(), trim(p_reason), private.expense_snapshot(v.id));
  perform private.notify(array[v.created_by, v.purchased_by], 'despesa', 'Compra devolvida para correção', trim(p_reason), '/campo/compras/' || v.id);
  return v;
end $$;

-- Quitação manual (sem transferência bancária pelo sistema).
create or replace function public.reimbursement_register_payment(
  p_expense_id uuid,
  p_amount_cents bigint,
  p_notes text default null
) returns public.reimbursements
language plpgsql security definer set search_path = '' as $$
declare
  v public.reimbursements;
begin
  perform private.require_admin();
  if p_amount_cents is null or p_amount_cents <= 0 then
    perform private.fail('Informe o valor pago (maior que zero).', 'amountCents');
  end if;
  select * into v from public.reimbursements where expense_id = p_expense_id for update;
  if not found then
    perform private.fail('Esta compra não tem reembolso a fazer.', null, 'P0002');
  end if;
  if v.amount_paid_cents + p_amount_cents > v.amount_due_cents then
    perform private.fail(format('O valor excede o saldo a reembolsar (%s).', private.brl(v.amount_due_cents - v.amount_paid_cents)), 'amountCents');
  end if;
  update public.reimbursements
     set amount_paid_cents = amount_paid_cents + p_amount_cents, settled_by = auth.uid(), settled_at = now(),
         settlement_notes = concat_ws(E'\n', settlement_notes,
           to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') || ': ' || private.brl(p_amount_cents)
           || coalesce(' — ' || nullif(trim(p_notes), ''), ''))
   where id = v.id returning * into v;
  perform private.notify(array[v.payee_profile_id], 'reembolso', 'Reembolso registrado', private.brl(p_amount_cents), '/campo/compras');
  return v;
end $$;
