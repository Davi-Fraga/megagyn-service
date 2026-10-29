-- Orçamentos (COMPLEMENTO M7): fotos, transições de situação com versão congelada,
-- duplicação e travas de edição. Somente administração.
-- attachment_links não tem política de escrita: vínculos só por estas funções.

-- ---------------------------------------------------------------------------
-- Auxiliares
-- ---------------------------------------------------------------------------
create or replace function private.lock_quote(p_id uuid) returns public.quotes
language plpgsql security definer set search_path = '' as $$
declare
  v public.quotes;
begin
  select * into v from public.quotes where id = p_id for update;
  if not found then
    perform private.fail('Orçamento não encontrado.', null, 'P0002');
  end if;
  return v;
end $$;

-- "Expirado" é derivado: enviado com validade anterior a hoje (ou já materializado).
create or replace function private.quote_is_expired(v public.quotes) returns boolean
language sql stable set search_path = '' as $$
  select v.status = 'expirado'
      or (v.status = 'enviado' and v.valid_until is not null and v.valid_until < public.today_sp())
$$;

-- Conteúdo só muda em rascunho (enviado → "Revisar" volta para rascunho e o reenvio gera nova versão).
create or replace function private.quote_items_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
begin
  select status into v_status from public.quotes
   where id = case when tg_op = 'DELETE' then old.quote_id else new.quote_id end;
  if found and v_status <> 'rascunho' then
    raise exception 'Os itens só podem ser alterados com o orçamento em rascunho.' using errcode = 'P0001', hint = 'items';
  end if;
  if tg_op = 'UPDATE' and new.quote_id <> old.quote_id then
    raise exception 'Item não pode mudar de orçamento.' using errcode = 'P0001', hint = 'items';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;
create trigger quote_items_guard before insert or update or delete on public.quote_items
  for each row execute function private.quote_items_guard();

create or replace function private.quote_content_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status <> 'rascunho' and (
       new.client_id is distinct from old.client_id
    or new.client_contact_id is distinct from old.client_contact_id
    or new.site_id is distinct from old.site_id
    or new.service_location_text is distinct from old.service_location_text
    or new.title is distinct from old.title
    or new.issued_at is distinct from old.issued_at
    or new.execution_deadline_text is distinct from old.execution_deadline_text
    or new.payment_terms is distinct from old.payment_terms
    or new.warranty_text is distinct from old.warranty_text
    or new.inclusions_text is distinct from old.inclusions_text
    or new.observations is distinct from old.observations
    or new.technical_notes is distinct from old.technical_notes
    or new.intro_text is distinct from old.intro_text
    or new.declaration_text is distinct from old.declaration_text
    or new.number is distinct from old.number
    or new.created_by is distinct from old.created_by
  ) then
    raise exception 'Orçamento fora de rascunho não pode ser editado. Use "Revisar proposta".' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger quotes_content_guard before update on public.quotes
  for each row execute function private.quote_content_guard();

-- ---------------------------------------------------------------------------
-- Fotos do local / de serviços semelhantes
-- ---------------------------------------------------------------------------
create or replace function public.quote_link_photos(p_quote_id uuid, p_photo_ids uuid[], p_role public.evidence_role)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v public.quotes;
  v_offset integer;
  v_count integer;
begin
  perform private.require_admin();
  v := private.lock_quote(p_quote_id);
  if v.status <> 'rascunho' then
    perform private.fail('As fotos só podem ser alteradas com o orçamento em rascunho.');
  end if;
  if p_role is null or p_role not in ('local', 'referencia') then
    perform private.fail('Tipo de foto inválido.', 'role');
  end if;
  if coalesce(cardinality(p_photo_ids), 0) = 0 then
    perform private.fail('Envie ao menos 1 foto.', 'photo_ids');
  end if;
  if exists (select 1 from public.attachments a where a.id = any (p_photo_ids) and a.bucket <> 'quotes') then
    perform private.fail('Use fotos enviadas pelo orçamento.', 'photo_ids');
  end if;
  select coalesce(max(sort_order) + 1, 0) into v_offset
    from public.attachment_links where entity_type = 'quote' and entity_id = v.id;
  v_count := private.link_attachments(p_photo_ids, 'quote', v.id, p_role, null);
  -- link_attachments numera a partir de 0 a cada chamada: novas fotos vão para o fim.
  update public.attachment_links set sort_order = sort_order + v_offset
   where entity_type = 'quote' and entity_id = v.id and attachment_id = any (p_photo_ids) and linked_at = now();
  return v_count;
end $$;

-- Remove o vínculo (a foto em si não é apagada). Versões já enviadas guardam os ids no snapshot.
create or replace function public.quote_unlink_photo(p_quote_id uuid, p_attachment_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.quotes;
begin
  perform private.require_admin();
  v := private.lock_quote(p_quote_id);
  if v.status <> 'rascunho' then
    perform private.fail('As fotos só podem ser alteradas com o orçamento em rascunho.');
  end if;
  delete from public.attachment_links
   where entity_type = 'quote' and entity_id = v.id and attachment_id = p_attachment_id;
  if not found then
    perform private.fail('Foto não encontrada neste orçamento.', null, 'P0002');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Situação: rascunho → enviado → aprovado | rejeitado | expirado; rascunho/enviado → cancelado;
-- expirado → enviado (renovar). Enviar, aprovar e renovar congelam uma versão (snapshot).
-- Aceite é manual/administrativo (sem assinatura eletrônica).
-- ---------------------------------------------------------------------------
create or replace function public.quote_transition(
  p_quote_id uuid,
  p_action text,
  p_reason text default null,
  p_snapshot jsonb default null,
  p_valid_until date default null,
  p_accepted_on date default null
) returns public.quotes
language plpgsql security definer set search_path = '' as $$
declare
  v public.quotes;
  v_expired boolean;
  v_items integer;
  v_version_reason text;
  v_accepted date;
begin
  perform private.require_admin();
  v := private.lock_quote(p_quote_id);
  v_expired := private.quote_is_expired(v);
  select count(*) into v_items from public.quote_items where quote_id = v.id;

  if p_action = 'enviar' then
    if v.status <> 'rascunho' then
      perform private.fail('Só um rascunho pode ser marcado como enviado.');
    end if;
    if v_items = 0 then
      perform private.fail('Inclua ao menos 1 item antes de enviar.', 'items');
    end if;
    if v.valid_until is null then
      perform private.fail('Informe a validade da proposta antes de enviar.', 'valid_until');
    end if;
    if v.valid_until < public.today_sp() then
      perform private.fail('A validade já passou. Informe uma nova data de validade.', 'valid_until');
    end if;
    v_version_reason := case
      when v.current_version_no = 0 then 'Proposta enviada'
      else 'Nova versão enviada' || coalesce(' (revisão: ' || v.status_reason || ')', '')
    end;
    update public.quotes set status = 'enviado', status_reason = null where id = v.id returning * into v;

  elsif p_action = 'aprovar' then
    if v.status not in ('enviado', 'expirado') then
      perform private.fail('Só uma proposta enviada pode ser aprovada.');
    end if;
    if v_expired then
      perform private.fail('A validade desta proposta venceu. Renove a validade antes de registrar a aprovação.');
    end if;
    if private.blank(p_reason) then
      perform private.fail('Descreva quem aprovou e como (ex.: e-mail, WhatsApp, reunião).', 'reason');
    end if;
    v_accepted := coalesce(p_accepted_on, public.today_sp());
    if v_accepted > public.today_sp() then
      perform private.fail('A data da aprovação não pode ser futura.', 'accepted_on');
    end if;
    if v_accepted < v.issued_at then
      perform private.fail('A data da aprovação não pode ser anterior à emissão.', 'accepted_on');
    end if;
    v_version_reason := 'Aprovação do cliente registrada';
    update public.quotes
       set status = 'aprovado',
           status_reason = null,
           accepted_note = left(trim(p_reason), 1000),
           accepted_at = case when v_accepted = public.today_sp() then now()
                              else (v_accepted::timestamp + interval '12 hours') at time zone 'America/Sao_Paulo' end
     where id = v.id returning * into v;

  elsif p_action = 'renovar' then
    if not v_expired then
      perform private.fail('Só uma proposta vencida pode ter a validade renovada.');
    end if;
    if p_valid_until is null or p_valid_until < public.today_sp() then
      perform private.fail('Informe uma nova validade a partir de hoje.', 'valid_until');
    end if;
    v_version_reason := 'Validade renovada até ' || to_char(p_valid_until, 'DD/MM/YYYY');
    update public.quotes set status = 'enviado', valid_until = p_valid_until, status_reason = null
     where id = v.id returning * into v;

  elsif p_action = 'recusar' then
    if v.status not in ('enviado', 'expirado') then
      perform private.fail('Só uma proposta enviada pode ser recusada.');
    end if;
    if private.blank(p_reason) then
      perform private.fail('Informe o motivo da recusa.', 'reason');
    end if;
    update public.quotes set status = 'rejeitado', status_reason = left(trim(p_reason), 1000)
     where id = v.id returning * into v;

  elsif p_action = 'cancelar' then
    if v.status not in ('rascunho', 'enviado', 'expirado') then
      perform private.fail('Este orçamento não pode mais ser cancelado.');
    end if;
    if private.blank(p_reason) then
      perform private.fail('Informe o motivo do cancelamento.', 'reason');
    end if;
    update public.quotes set status = 'cancelado', status_reason = left(trim(p_reason), 1000)
     where id = v.id returning * into v;

  elsif p_action = 'revisar' then
    if v.status not in ('enviado', 'expirado') then
      perform private.fail('Só uma proposta enviada pode voltar para revisão.');
    end if;
    if private.blank(p_reason) then
      perform private.fail('Informe o que será revisado.', 'reason');
    end if;
    update public.quotes set status = 'rascunho', status_reason = left(trim(p_reason), 1000)
     where id = v.id returning * into v;

  else
    perform private.fail('Ação inválida.');
  end if;

  if v_version_reason is not null then
    if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' or jsonb_typeof(p_snapshot -> 'items') <> 'array' then
      perform private.fail('Conteúdo da versão ausente.');
    end if;
    -- O snapshot é montado na aplicação (extenso, fotos, empresa); o banco confere que bate com os dados atuais.
    if (p_snapshot ->> 'quote_id') is distinct from v.id::text
       or (p_snapshot ->> 'total_cents')::bigint is distinct from v.total_cents
       or jsonb_array_length(p_snapshot -> 'items') <> v_items then
      perform private.fail('O orçamento mudou enquanto a versão era gerada. Recarregue a página e tente de novo.');
    end if;
    insert into public.quote_versions (quote_id, version_no, snapshot, reason, created_by)
    values (
      v.id,
      v.current_version_no + 1,
      p_snapshot || jsonb_build_object(
        'version_no', v.current_version_no + 1,
        'status', v.status,
        'valid_until', v.valid_until,
        'accepted_at', v.accepted_at,
        'accepted_note', v.accepted_note
      ),
      v_version_reason,
      auth.uid()
    );
    update public.quotes set current_version_no = current_version_no + 1 where id = v.id returning * into v;
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Duplicar: novo rascunho com os mesmos campos, itens e fotos (emissão hoje,
-- mesma duração de validade). Nunca copia situação, aceite ou versões.
-- ---------------------------------------------------------------------------
create or replace function public.quote_duplicate(p_quote_id uuid) returns public.quotes
language plpgsql security definer set search_path = '' as $$
declare
  v public.quotes;
  v_new public.quotes;
begin
  perform private.require_admin();
  select * into v from public.quotes where id = p_quote_id;
  if not found then
    perform private.fail('Orçamento não encontrado.', null, 'P0002');
  end if;
  insert into public.quotes (
    client_id, client_contact_id, site_id, service_location_text, title, issued_at, valid_until,
    execution_deadline_text, payment_terms, warranty_text, inclusions_text, observations, technical_notes,
    intro_text, declaration_text, created_by
  ) values (
    v.client_id, v.client_contact_id, v.site_id, v.service_location_text, v.title, public.today_sp(),
    case when v.valid_until is not null then public.today_sp() + greatest(v.valid_until - v.issued_at, 0) end,
    v.execution_deadline_text, v.payment_terms, v.warranty_text, v.inclusions_text, v.observations, v.technical_notes,
    v.intro_text, v.declaration_text, auth.uid()
  ) returning * into v_new;

  insert into public.quote_items (quote_id, location_label, title, pricing_mode, quantity, unit, unit_price_cents, subtotal_cents, lines, notes, sort_order)
  select v_new.id, location_label, title, pricing_mode, quantity, unit, unit_price_cents, subtotal_cents, lines, notes, sort_order
    from public.quote_items where quote_id = v.id;

  insert into public.attachment_links (attachment_id, entity_type, entity_id, evidence_role, sort_order, linked_by)
  select l.attachment_id, 'quote', v_new.id, l.evidence_role, l.sort_order, auth.uid()
    from public.attachment_links l
    join public.attachments a on a.id = l.attachment_id
   where l.entity_type = 'quote' and l.entity_id = v.id and a.revoked_at is null;

  select * into v_new from public.quotes where id = v_new.id;
  return v_new;
end $$;

revoke all on function private.lock_quote(uuid) from anon, authenticated, public;
revoke all on function private.quote_is_expired(public.quotes) from anon, authenticated, public;
revoke all on function private.quote_items_guard() from anon, authenticated, public;
revoke all on function private.quote_content_guard() from anon, authenticated, public;

revoke execute on function public.quote_link_photos(uuid, uuid[], public.evidence_role) from anon, public;
grant execute on function public.quote_link_photos(uuid, uuid[], public.evidence_role) to authenticated;
revoke execute on function public.quote_unlink_photo(uuid, uuid) from anon, public;
grant execute on function public.quote_unlink_photo(uuid, uuid) to authenticated;
revoke execute on function public.quote_transition(uuid, text, text, jsonb, date, date) from anon, public;
grant execute on function public.quote_transition(uuid, text, text, jsonb, date, date) to authenticated;
revoke execute on function public.quote_duplicate(uuid) from anon, public;
grant execute on function public.quote_duplicate(uuid) to authenticated;
