-- M-03 (Fase 0, B-04; achados A-03 e A-16): a aprovação aponta a revisão enviada e a situação do
-- orçamento só muda por quote_transition.
--
-- A-03: em 'aprovar', a aplicação montava um snapshot NOVO com os dados atuais (cliente, empresa) e o
-- banco congelava esse snapshot como v(n+1). Se o endereço do cliente ou os dados da empresa mudaram
-- depois do envio, a versão "aprovada" não era o que o cliente recebeu.
-- Agora: 'aprovar' ignora p_snapshot e copia o snapshot da última versão enviada (v(n)); a versão de
-- aprovação v(n+1) tem o mesmo conteúdo de v(n) mais os dados do aceite, e approved_version_no = n.
-- O app em produção continua chamando com p_snapshot (ignorado): mesma assinatura.
--
-- A-16: o orçamento não tinha guarda de situação; pela API, um admin mudava "aprovado" para
-- "rascunho", editava e o conteúdo "aprovado" mudava sem versão. Agora o gatilho quotes_status_guard
-- barra mudança direta de situação, versões e aceite (igual a guard_request_status da O.S.).
--
-- Também: as versões passam a guardar os ids de logo e assinatura usados (chave "branding"), lidos de
-- company_settings no momento de enviar/renovar. Aprovação copia o que a versão enviada guardou.
--
-- Dados existentes: nenhuma linha é alterada. approved_version_no fica nulo nas aprovações antigas
-- (o diagnóstico D1 do README mostra quais têm conteúdo diferente da versão enviada).

-- ---------------------------------------------------------------------------
-- 1. Versão que o cliente aprovou
-- ---------------------------------------------------------------------------
alter table public.quotes add column approved_version_no integer;

-- ---------------------------------------------------------------------------
-- 2. Guarda de situação (modelo: 20261025000300_requests_tasks_work.sql:64-74).
--    Também em INSERT: a política quotes_admin_insert (0700:105) deixa inserir pela API, e um
--    orçamento não pode nascer enviado ou aprovado. quote_duplicate e quote_save inserem rascunho.
-- ---------------------------------------------------------------------------
create or replace function private.guard_quote_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('app.in_transition', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'rascunho' or new.current_version_no <> 0 or new.approved_version_no is not null
       or new.accepted_at is not null or new.accepted_note is not null then
      raise exception 'O orçamento começa em rascunho; a situação só muda pelas ações do sistema.' using errcode = '42501';
    end if;
  elsif new.status is distinct from old.status
     or new.current_version_no is distinct from old.current_version_no
     or new.approved_version_no is distinct from old.approved_version_no
     or new.accepted_at is distinct from old.accepted_at
     or new.accepted_note is distinct from old.accepted_note
     or new.status_reason is distinct from old.status_reason then
    raise exception 'A situação do orçamento só muda pelas ações do sistema.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger quotes_status_guard before insert or update on public.quotes
  for each row execute function private.guard_quote_status();

-- ---------------------------------------------------------------------------
-- 3. Transições (corpo anterior: 20261025001300_quotes_rpc.sql:129-272). Mudanças marcadas "M-03".
-- ---------------------------------------------------------------------------
-- Situação: rascunho → enviado → aprovado | rejeitado | expirado; rascunho/enviado → cancelado;
-- expirado → enviado (renovar). Enviar, aprovar e renovar congelam uma versão (snapshot).
-- Aceite é manual/administrativo (sem assinatura eletrônica).
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
  v_snapshot jsonb;       -- M-03: conteúdo da versão a congelar
  v_sent_version integer; -- M-03: versão enviada que o cliente aprovou
  v_branding jsonb;       -- M-03: logo e assinatura usados na versão
begin
  perform private.require_admin();
  v := private.lock_quote(p_quote_id);
  v_expired := private.quote_is_expired(v);
  select count(*) into v_items from public.quote_items where quote_id = v.id;
  -- M-03: só esta função muda situação, aceite e versões (gatilho quotes_status_guard).
  perform set_config('app.in_transition', 'on', true);

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
    -- M-03 (A-03): o cliente aprova o que recebeu. Em "enviado", a última versão é sempre a do
    -- envio ou da renovação; o conteúdo vem dela, nunca dos dados atuais (p_snapshot é ignorado).
    v_sent_version := v.current_version_no;
    select qv.snapshot into v_snapshot
      from public.quote_versions qv
     where qv.quote_id = v.id and qv.version_no = v_sent_version;
    if v_snapshot is null then
      perform private.fail('A versão enviada deste orçamento não foi encontrada. Use "Revisar proposta" e envie de novo.');
    end if;
    v_version_reason := 'Aprovação do cliente registrada';
    update public.quotes
       set status = 'aprovado',
           status_reason = null,
           accepted_note = left(trim(p_reason), 1000),
           accepted_at = case when v_accepted = public.today_sp() then now()
                              else (v_accepted::timestamp + interval '12 hours') at time zone 'America/Sao_Paulo' end,
           approved_version_no = v_sent_version
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
    if p_action = 'aprovar' then
      -- M-03: cópia da versão enviada; os dados do aceite entram abaixo, junto com version_no e status.
      v_snapshot := v_snapshot || jsonb_build_object('approved_from_version_no', v_sent_version);
    else
      if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' or jsonb_typeof(p_snapshot -> 'items') <> 'array' then
        perform private.fail('Conteúdo da versão ausente.');
      end if;
      -- O snapshot é montado na aplicação (extenso, fotos, empresa); o banco confere que bate com os dados atuais.
      if (p_snapshot ->> 'quote_id') is distinct from v.id::text
         or (p_snapshot ->> 'total_cents')::bigint is distinct from v.total_cents
         or jsonb_array_length(p_snapshot -> 'items') <> v_items then
        perform private.fail('O orçamento mudou enquanto a versão era gerada. Recarregue a página e tente de novo.');
      end if;
      -- M-03: logo e assinatura vigentes no envio ficam congelados na versão.
      select jsonb_build_object('logo_attachment_id', s.logo_attachment_id, 'signature_attachment_id', s.signature_attachment_id)
        into v_branding
        from public.company_settings s where s.id = 1;
      v_snapshot := p_snapshot || jsonb_build_object('branding', coalesce(v_branding, '{}'::jsonb));
    end if;
    insert into public.quote_versions (quote_id, version_no, snapshot, reason, created_by)
    values (
      v.id,
      v.current_version_no + 1,
      v_snapshot || jsonb_build_object(
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
  perform set_config('app.in_transition', 'off', true);
  return v;
end $$;

revoke all on function private.guard_quote_status() from anon, authenticated, public;
revoke execute on function public.quote_transition(uuid, text, text, jsonb, date, date) from anon, public;
grant execute on function public.quote_transition(uuid, text, text, jsonb, date, date) to authenticated;
