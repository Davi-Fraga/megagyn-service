-- M-04a (Fase 0, B-09; achado A-08): pagamento de reembolso em linha própria, imutável e idempotente.
-- (Primeira metade da M-04 do doc 03. A segunda, B-14/A-22, está em M-04b, com PR próprio.)
--
-- Antes (20261025000600_expenses.sql:445-474): cada pagamento somava em reimbursements.amount_paid_cents
-- e acrescentava uma linha de texto em settlement_notes. Sem chave de idempotência: resposta perdida +
-- novo toque = dois pagamentos (limitados ao saldo), sem linha própria para conferir ou estornar.
-- Agora:
--   * reimbursement_payments: uma linha por pagamento (valor, data, forma, observação, autor), imutável;
--     client_request_id único por autor;
--   * amount_paid_cents passa a ser a soma das linhas, por gatilho;
--   * reimbursement_register_payment ganha p_client_request_id (e data e forma do pagamento), todos com
--     DEFAULT: o app em produção continua chamando só com p_expense_id, p_amount_cents e p_notes.
--     A assinatura antiga sai NESTE arquivo (senão o Postgres cria uma sobrecarga e o PostgREST responde
--     "could not choose the best candidate function").
--   * reembolsos com valor já pago ganham UMA linha "saldo_migrado" com o total pago até hoje.
--     Totais e situação não mudam (conferido no fim do bloco 3; a migração aborta se divergir).
--   * settlement_notes fica como está (histórico) e continua recebendo a linha de texto, porque as telas
--     atuais (admin/reembolsos, admin/despesas) ainda a exibem. Parar de gravar é decisão do PR do app.

-- ---------------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------------
create table public.reimbursement_payments (
  id uuid primary key default gen_random_uuid(),
  reimbursement_id uuid not null references public.reimbursements (id),
  kind text not null default 'pagamento' check (kind in ('pagamento', 'saldo_migrado')),
  amount_cents bigint not null check (amount_cents > 0),
  paid_on date not null,
  payment_method_id uuid references public.payment_methods (id),
  notes text,
  client_request_id uuid not null default gen_random_uuid(),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (created_by, client_request_id),
  -- Pagamento novo sempre tem autor; só a linha de migração pode não ter (o texto antigo não diz quem pagou cada parte).
  check (kind = 'saldo_migrado' or created_by is not null)
);
create index reimbursement_payments_reimbursement_idx on public.reimbursement_payments (reimbursement_id, paid_on, created_at);
create unique index reimbursement_payments_migrated_uidx on public.reimbursement_payments (reimbursement_id)
  where kind = 'saldo_migrado';

create trigger reimbursement_payments_immutable before update or delete on public.reimbursement_payments
  for each row execute function private.forbid_mutation();
create trigger audit_reimbursement_payments after insert on public.reimbursement_payments
  for each row execute function private.audit_row();

alter table public.reimbursement_payments enable row level security;
-- Mesmo alcance do reembolso: administração e a pessoa reembolsada (reimbursements_select, 0600:160-161).
create policy reimbursement_payments_select on public.reimbursement_payments for select to authenticated
  using (exists (select 1 from public.reimbursements r where r.id = reimbursement_payments.reimbursement_id));

-- ---------------------------------------------------------------------------
-- 2. Saldo já pago vira uma linha por reembolso (antes do gatilho de soma: nenhum reembolso é tocado)
-- ---------------------------------------------------------------------------
do $$
begin
  perform set_config('app.audit_reason', 'M-04 (A-08): saldo pago antes do registro por linha.', true);
  insert into public.reimbursement_payments (reimbursement_id, kind, amount_cents, paid_on, notes, created_by, created_at)
  select r.id,
         'saldo_migrado',
         r.amount_paid_cents,
         (coalesce(r.settled_at, r.updated_at) at time zone 'America/Sao_Paulo')::date,
         'Total pago antes do registro por pagamento (migração M-04). Detalhe no histórico de quitação do reembolso.',
         null,
         coalesce(r.settled_at, r.updated_at)
    from public.reimbursements r
   where r.amount_paid_cents > 0;
  perform set_config('app.audit_reason', '', true);

  if exists (
    select 1
      from public.reimbursements r
      left join (select p.reimbursement_id, sum(p.amount_cents) as total
                   from public.reimbursement_payments p group by p.reimbursement_id) s on s.reimbursement_id = r.id
     where coalesce(s.total, 0) <> r.amount_paid_cents
  ) then
    raise exception 'M-04: soma das linhas diferente do total pago em algum reembolso. Migração interrompida.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Total pago = soma das linhas (pagamentos são imutáveis: só INSERT)
-- ---------------------------------------------------------------------------
create or replace function private.reimbursement_paid_sum() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.reimbursements r
     set amount_paid_cents = (
       select coalesce(sum(p.amount_cents), 0) from public.reimbursement_payments p where p.reimbursement_id = new.reimbursement_id
     )
   where r.id = new.reimbursement_id;
  return null;
end $$;
create trigger reimbursement_payments_sum after insert on public.reimbursement_payments
  for each row execute function private.reimbursement_paid_sum();

-- ---------------------------------------------------------------------------
-- 4. RPC de pagamento: assinatura antiga sai, nova entra com os parâmetros novos em DEFAULT
--    (corpo anterior: 20261025000600_expenses.sql:445-474)
-- ---------------------------------------------------------------------------
drop function if exists public.reimbursement_register_payment(uuid, bigint, text);

-- Quitação manual (sem transferência bancária pelo sistema).
create function public.reimbursement_register_payment(
  p_expense_id uuid,
  p_amount_cents bigint,
  p_notes text default null,
  p_client_request_id uuid default null,
  p_paid_on date default null,
  p_payment_method_id uuid default null
) returns public.reimbursements
language plpgsql security definer set search_path = '' as $$
declare
  v public.reimbursements;
  v_paid_on date := coalesce(p_paid_on, public.today_sp());
  v_done public.reimbursement_payments;
begin
  perform private.require_admin();
  -- Reenvio com a mesma chave (resposta perdida, toque repetido): devolve o reembolso sem lançar de novo.
  if p_client_request_id is not null then
    select * into v_done from public.reimbursement_payments
     where created_by = auth.uid() and client_request_id = p_client_request_id;
    if found then
      select * into v from public.reimbursements where id = v_done.reimbursement_id;
      return v;
    end if;
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    perform private.fail('Informe o valor pago (maior que zero).', 'amountCents');
  end if;
  if v_paid_on > public.today_sp() then
    perform private.fail('A data do pagamento não pode ser futura.', 'paidOn');
  end if;
  if p_payment_method_id is not null and not exists (
    select 1 from public.payment_methods m where m.id = p_payment_method_id and m.is_active
  ) then
    perform private.fail('Escolha uma forma de pagamento ativa.', 'paymentMethodId');
  end if;
  select * into v from public.reimbursements where expense_id = p_expense_id for update;
  if not found then
    perform private.fail('Esta compra não tem reembolso a fazer.', null, 'P0002');
  end if;
  -- Segunda conferência com a linha travada: duas chamadas simultâneas com a mesma chave esperam
  -- uma pela outra aqui, e a segunda encontra o pagamento da primeira.
  if p_client_request_id is not null and exists (
    select 1 from public.reimbursement_payments
     where created_by = auth.uid() and client_request_id = p_client_request_id
  ) then
    return v;
  end if;
  if v.amount_paid_cents + p_amount_cents > v.amount_due_cents then
    perform private.fail(format('O valor excede o saldo a reembolsar (%s).', private.brl(v.amount_due_cents - v.amount_paid_cents)), 'amountCents');
  end if;

  begin
    insert into public.reimbursement_payments (reimbursement_id, amount_cents, paid_on, payment_method_id, notes, client_request_id, created_by)
    values (v.id, p_amount_cents, v_paid_on, p_payment_method_id, nullif(trim(p_notes), ''),
            coalesce(p_client_request_id, gen_random_uuid()), auth.uid());
  exception when unique_violation then
    select * into v from public.reimbursements where id = v.id;
    return v;
  end;

  -- amount_paid_cents já foi recalculado pelo gatilho reimbursement_payments_sum.
  update public.reimbursements
     set settled_by = auth.uid(), settled_at = now(),
         settlement_notes = concat_ws(E'\n', settlement_notes,
           to_char(v_paid_on, 'DD/MM/YYYY') || ': ' || private.brl(p_amount_cents)
           || coalesce(' — ' || nullif(trim(p_notes), ''), ''))
   where id = v.id returning * into v;
  perform private.notify(array[v.payee_profile_id], 'reembolso', 'Reembolso registrado', private.brl(p_amount_cents), '/campo/compras');
  return v;
end $$;

revoke all on function private.reimbursement_paid_sum() from anon, authenticated, public;
revoke execute on function public.reimbursement_register_payment(uuid, bigint, text, uuid, date, uuid) from anon, public;
grant execute on function public.reimbursement_register_payment(uuid, bigint, text, uuid, date, uuid) to authenticated, service_role;
