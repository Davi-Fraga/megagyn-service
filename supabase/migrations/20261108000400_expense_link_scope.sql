-- M-04b (Fase 0, B-14; achado A-22): compra só se liga a O.S. ou ocorrência de tarefa de uma obra do
-- rateio, à qual quem lança tem acesso.
-- (Segunda metade da M-04 do doc 03; PR próprio, separado do B-09.)
--
-- Antes (20261025001400_review_fixes.sql:113-114, :188, :213): p_service_request_id e
-- p_task_occurrence_id iam direto para a linha; só a FK era conferida. Pela API, o encarregado ligava a
-- compra a uma O.S. de local sem acesso, e qualquer perfil ligava a O.S. de obra fora do rateio.
-- Agora: a O.S. ou ocorrência ligada precisa (1) existir num local com acesso de quem lança e (2) ser de
-- uma obra que está no rateio desta compra. Vale para todos os perfis (a administração passa sempre no
-- item 1). Mesma assinatura: CREATE OR REPLACE, sem sobrecarga.
--
-- Dados existentes: nenhuma linha é alterada. Compra antiga com vínculo fora da regra (diagnóstico D1
-- do README) só passa a dar erro quando for editada; aí é preciso tirar o vínculo ou incluir a obra.

-- Corpo anterior: 20261025001400_review_fixes.sql:97-303. Mudanças marcadas "M-04b".
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
  v_link_site uuid; -- M-04b
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
  -- Só a administração direciona reembolso para outra pessoa.
  if v_role <> 'admin' and v_payee is not null and v_payee <> auth.uid() then
    perform private.fail('O reembolso só pode ser para você mesmo.', 'paidByProfileId', '42501');
  end if;
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

  -- M-04b (A-22): O.S. ou ocorrência ligada é de obra do rateio, com acesso de quem lança.
  -- Inexistente e sem acesso dão a mesma mensagem (não revela chamado de outro local).
  if p_service_request_id is not null then
    select r.site_id into v_link_site from public.service_requests r where r.id = p_service_request_id;
    if v_link_site is null or not public.has_site_access(v_link_site) then
      perform private.fail('Chamado não encontrado entre os locais a que você tem acesso.', 'serviceRequestId', 'P0002');
    end if;
    if not exists (select 1 from public.expense_allocations a where a.expense_id = v.id and a.site_id = v_link_site) then
      perform private.fail('O chamado escolhido é de uma obra que não está no rateio desta compra. Inclua a obra no rateio ou retire o chamado.', 'serviceRequestId');
    end if;
  end if;
  if p_task_occurrence_id is not null then
    select o.site_id into v_link_site from public.task_occurrences o where o.id = p_task_occurrence_id;
    if v_link_site is null or not public.has_site_access(v_link_site) then
      perform private.fail('Tarefa não encontrada entre os locais a que você tem acesso.', 'taskOccurrenceId', 'P0002');
    end if;
    if not exists (select 1 from public.expense_allocations a where a.expense_id = v.id and a.site_id = v_link_site) then
      perform private.fail('A tarefa escolhida é de uma obra que não está no rateio desta compra. Inclua a obra no rateio ou retire a tarefa.', 'taskOccurrenceId');
    end if;
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
  elsif v_was_status = 'aprovado' and (v_role <> 'admin' or private.expense_financial(v_old) is distinct from private.expense_financial(v_new)) then
    insert into public.expense_reviews (expense_id, action, actor_id, reason, snapshot)
    values (v.id, 'invalidada', auth.uid(), 'Compra aprovada alterada: precisa de nova conferência.', v_old);
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

revoke execute on function public.expense_save(
  uuid, date, text, bigint, jsonb, uuid, uuid, text, uuid, text, uuid, text, public.payer_kind, uuid, uuid, uuid, uuid, text, uuid[], boolean
) from anon, public;
grant execute on function public.expense_save(
  uuid, date, text, bigint, jsonb, uuid, uuid, text, uuid, text, uuid, text, public.payer_kind, uuid, uuid, uuid, uuid, text, uuid[], boolean
) to authenticated, service_role;
