-- Correções da revisão independente (25/10/2026). Cada item tem teste em tests/db/review-fixes.test.ts
-- ou tests/db/closings.test.ts que falhou antes desta migração.

-- C1: anexos só entram pela rota de upload (chave de serviço, após validar conteúdo e acesso).
drop policy if exists attachments_insert on public.attachments;

alter table public.attachments
  add constraint attachments_mime_allowed
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')) not valid,
  add constraint attachments_storage_key_format
    check (storage_key ~ '^[0-9a-f-]{36}/[0-9]{4}/[0-9]{2}/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$') not valid,
  add constraint attachments_derivatives_format
    check (
      derivatives = '{}'::jsonb
      or ((derivatives ->> 'thumb') ~ '^[0-9a-f-]{36}/[0-9]{4}/[0-9]{2}/[0-9a-f-]{36}_thumb\.jpg$'
          and (derivatives ->> 'medium') ~ '^[0-9a-f-]{36}/[0-9]{4}/[0-9]{2}/[0-9a-f-]{36}_medium\.jpg$')
    ) not valid;

-- C1 + I2 + I3: vínculo só com arquivo existente, bucket certo para cada tipo de registro
-- e contagem apenas dos vínculos realmente criados.
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
  v_rows integer;
  v_bucket public.attachment_bucket := case
    when p_entity = 'expense' then 'receipts'::public.attachment_bucket
    when p_entity = 'quote' then 'quotes'::public.attachment_bucket
    else 'evidence'::public.attachment_bucket end;
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
    if v_att.bucket <> v_bucket then
      raise exception 'Este arquivo não pode ser usado aqui (ex.: comprovante de compra não serve como foto de serviço).'
        using errcode = 'P0001', hint = 'photos';
    end if;
    if v_bucket = 'evidence' and p_site is not null and v_att.site_id is distinct from p_site then
      raise exception 'Foto enviada para outro local.' using errcode = 'P0001', hint = 'photos';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = v_att.bucket::text and o.name = v_att.storage_key) then
      raise exception 'O arquivo desta foto não foi recebido. Envie novamente.' using errcode = 'P0001', hint = 'photos';
    end if;
    insert into public.attachment_links (attachment_id, entity_type, entity_id, evidence_role, sort_order, linked_by)
    values (v_id, p_entity, p_entity_id, p_role, v_count, auth.uid())
    on conflict (attachment_id, entity_type, entity_id) do nothing;
    get diagnostics v_rows = row_count;
    v_count := v_count + v_rows;
  end loop;
  return v_count;
end $$;

-- I5: fornecedor faz parte do que exige nova conferência.
create or replace function private.expense_snapshot(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total_cents', e.total_cents, 'expense_date', e.expense_date, 'paid_by_kind', e.paid_by_kind,
    'paid_by_profile_id', e.paid_by_profile_id, 'supplier_id', e.supplier_id, 'supplier_name_free', e.supplier_name_free,
    'description', e.description,
    'allocations', coalesce((
      select jsonb_agg(jsonb_build_object('site_id', a.site_id, 'amount_cents', a.amount_cents, 'purpose', a.purpose) order by a.sort_order, a.site_id)
      from public.expense_allocations a where a.expense_id = e.id
    ), '[]'::jsonb)
  )
  from public.expenses e where e.id = p_id
$$;

create or replace function private.expense_financial(p jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'total_cents', p -> 'total_cents', 'expense_date', p -> 'expense_date', 'paid_by_kind', p -> 'paid_by_kind',
    'paid_by_profile_id', p -> 'paid_by_profile_id', 'supplier_id', p -> 'supplier_id', 'supplier_name_free', p -> 'supplier_name_free',
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
  if v.id is null then
    perform private.fail('Lançamento não encontrado.', null, 'P0002');
  end if;
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
  if v.id is null then
    perform private.fail('Tarefa não encontrada.', null, 'P0002');
  end if;
  return v;
end $$;

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
    'executado', null, null, p_participant_ids,
    -- Fotos do resultado têm prioridade: não entram também como "durante o serviço".
    array(select x from unnest(coalesce(p_photo_ids, '{}')) as x where not (x = any (coalesce(p_result_photo_ids, '{}')))),
    'intermediaria'
  );
  v_linked := private.link_attachments(p_result_photo_ids, 'work_entry', v_entry.id, 'resultado', v.site_id);
  if not exists (
    select 1 from public.attachment_links l
     where l.entity_type = 'work_entry' and l.entity_id = v_entry.id and l.evidence_role = 'resultado'
  ) then
    perform private.fail('Envie ao menos 1 foto do resultado.', 'resultPhotoIds');
  end if;

  v := private.request_transition(v, 'executada', 'execucao_informada', null,
    jsonb_build_object('client_request_id', p_client_request_id, 'solution', trim(p_solution), 'result_photo_count', v_linked),
    v_entry.id);

  perform private.notify(private.admin_ids(), 'validacao', 'Chamado ' || v.number || ' aguardando validação',
    v.title, '/admin/chamados/' || v.id);
  return v;
end $$;

-- Menores: leitura de "própria linha" exige pessoa ativa da equipe (inativo ou papel client não lê nada).
drop policy if exists time_entries_select on public.time_entries;
create policy time_entries_select on public.time_entries for select to authenticated
  using (public.is_admin() or (public.is_staff() and profile_id = auth.uid()));

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (public.is_staff() and profile_id = auth.uid());

drop policy if exists site_memberships_select on public.site_memberships;
create policy site_memberships_select on public.site_memberships for select to authenticated
  using (public.is_admin() or (public.is_staff() and (profile_id = auth.uid() or public.has_site_access(site_id))));

drop policy if exists attachments_select on public.attachments;
create policy attachments_select on public.attachments for select to authenticated using (
  (bucket = 'evidence' and public.has_site_access(site_id))
  or (bucket = 'receipts' and (public.is_admin() or (public.current_app_role() = 'foreman' and uploaded_by = auth.uid())))
  or (bucket = 'branding' and public.is_staff())
  or (bucket in ('reports', 'quotes') and public.is_admin())
);

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;
revoke all on all functions in schema private from anon, authenticated, public;
