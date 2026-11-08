-- M-06 (Fase 0, B-08; achado A-07): orçamento salvo uma vez, sem itens duplicados.
--
-- Antes (src/server/actions/quotes.ts:103-141): a ação gravava cabeçalho e itens em várias chamadas
-- pela API, sem chave de idempotência. (a) Reenvio da criação após timeout criava outro orçamento com
-- outro número. (b) Dois salvamentos do mesmo rascunho liam os mesmos itens antigos, inseriam os seus e
-- apagavam só os antigos: itens duplicados e total dobrado.
-- Agora: public.quote_save grava cabeçalho e itens numa transação, com a linha do orçamento travada.
--   * criação: chave p_client_request_id única por autor (índice parcial); reenvio devolve o mesmo orçamento;
--   * edição: troca todos os itens de uma vez; p_expected_updated_at (opcional) recusa salvar por cima de
--     uma alteração feita depois que a tela foi aberta; o reenvio da mesma edição (mesma chave) devolve o
--     orçamento sem erro, graças a last_save_request_id.
-- Função nova: nenhuma assinatura existente muda. O app em produção segue gravando direto (políticas
-- quotes_admin_* e quote_items_admin_all ficam); a ação troca para a RPC no PR do B-08.
-- Dados existentes: nenhuma linha é alterada (colunas novas nulas; índice sobre coluna toda nula).

-- ---------------------------------------------------------------------------
-- 1. Chaves de idempotência
-- ---------------------------------------------------------------------------
alter table public.quotes
  add column client_request_id uuid,
  add column last_save_request_id uuid;
create unique index quotes_client_request_uidx on public.quotes (created_by, client_request_id)
  where client_request_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Salvar cabeçalho + itens (somente administração, só em rascunho)
--    Parâmetros com DEFAULT vão no fim (regra do Postgres); a ação chama por nome.
-- ---------------------------------------------------------------------------
create or replace function public.quote_save(
  p_client_request_id uuid,
  p_header jsonb,
  p_items jsonb,
  p_quote_id uuid default null,
  p_expected_updated_at timestamptz default null
) returns public.quotes
language plpgsql security definer set search_path = '' as $$
declare
  v public.quotes;
  v_client uuid;
  v_contact uuid;
  v_site uuid;
  v_issued date;
  v_valid date;
  v_item jsonb;
  v_i integer := 0;
begin
  perform private.require_admin();
  if p_client_request_id is null then
    perform private.fail('Envio sem identificador. Recarregue a página e tente de novo.');
  end if;
  if p_header is null or jsonb_typeof(p_header) <> 'object' then
    perform private.fail('Dados do orçamento ausentes.');
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    perform private.fail('Itens do orçamento ausentes.', 'items');
  end if;

  -- Reenvio da criação (mesma chave): devolve o orçamento já criado, sem alterar nada.
  if p_quote_id is null then
    select * into v from public.quotes where created_by = auth.uid() and client_request_id = p_client_request_id;
    if found then
      return v;
    end if;
  end if;

  v_client := nullif(p_header ->> 'client_id', '')::uuid;
  v_contact := nullif(p_header ->> 'client_contact_id', '')::uuid;
  v_site := nullif(p_header ->> 'site_id', '')::uuid;
  v_issued := nullif(p_header ->> 'issued_at', '')::date;
  v_valid := nullif(p_header ->> 'valid_until', '')::date;
  if v_client is null or not exists (select 1 from public.clients c where c.id = v_client) then
    perform private.fail('Escolha o cliente.', 'clientId');
  end if;
  if v_issued is null then
    perform private.fail('Informe a data de emissão.', 'issuedAt');
  end if;
  if v_valid is not null and v_valid < v_issued then
    perform private.fail('A validade não pode ser anterior à emissão.', 'validUntil');
  end if;
  if v_contact is not null and not exists (
    select 1 from public.client_contacts c where c.id = v_contact and c.client_id = v_client
  ) then
    perform private.fail('Escolha um contato deste cliente.', 'clientContactId');
  end if;
  if v_site is not null and not exists (
    select 1 from public.sites s where s.id = v_site and s.client_id = v_client
  ) then
    perform private.fail('Escolha uma obra ou unidade deste cliente.', 'siteId');
  end if;

  if p_quote_id is null then
    begin
      -- number vazio: o gatilho quotes_number atribui ORC-AAAA-NNNN.
      insert into public.quotes (
        number, client_id, client_contact_id, site_id, issued_at, valid_until, title, service_location_text,
        execution_deadline_text, payment_terms, warranty_text, inclusions_text, intro_text, observations,
        technical_notes, declaration_text, client_request_id, last_save_request_id, created_by
      ) values (
        '', v_client, v_contact, v_site, v_issued, v_valid,
        nullif(trim(p_header ->> 'title'), ''),
        nullif(trim(p_header ->> 'service_location_text'), ''),
        nullif(trim(p_header ->> 'execution_deadline_text'), ''),
        nullif(trim(p_header ->> 'payment_terms'), ''),
        nullif(trim(p_header ->> 'warranty_text'), ''),
        nullif(trim(p_header ->> 'inclusions_text'), ''),
        nullif(trim(p_header ->> 'intro_text'), ''),
        nullif(trim(p_header ->> 'observations'), ''),
        nullif(trim(p_header ->> 'technical_notes'), ''),
        nullif(trim(p_header ->> 'declaration_text'), ''),
        p_client_request_id, p_client_request_id, auth.uid()
      ) returning * into v;
    exception when unique_violation then
      -- Envio simultâneo com a mesma chave (clique duplo): devolve o orçamento já criado.
      select * into v from public.quotes where created_by = auth.uid() and client_request_id = p_client_request_id;
      if found then
        return v;
      end if;
      raise;
    end;
  else
    v := private.lock_quote(p_quote_id);
    -- Reenvio da mesma edição (resposta perdida): já aplicada, devolve como está.
    if v.last_save_request_id = p_client_request_id then
      return v;
    end if;
    if v.status <> 'rascunho' then
      perform private.fail('Só rascunhos podem ser editados. Use "Revisar proposta".');
    end if;
    if p_expected_updated_at is not null and v.updated_at <> p_expected_updated_at then
      perform private.fail('Este orçamento foi alterado depois que você abriu a página. Nada foi salvo: recarregue para ver a versão atual.', 'expectedUpdatedAt');
    end if;
    update public.quotes
       set client_id = v_client,
           client_contact_id = v_contact,
           site_id = v_site,
           issued_at = v_issued,
           valid_until = v_valid,
           title = nullif(trim(p_header ->> 'title'), ''),
           service_location_text = nullif(trim(p_header ->> 'service_location_text'), ''),
           execution_deadline_text = nullif(trim(p_header ->> 'execution_deadline_text'), ''),
           payment_terms = nullif(trim(p_header ->> 'payment_terms'), ''),
           warranty_text = nullif(trim(p_header ->> 'warranty_text'), ''),
           inclusions_text = nullif(trim(p_header ->> 'inclusions_text'), ''),
           intro_text = nullif(trim(p_header ->> 'intro_text'), ''),
           observations = nullif(trim(p_header ->> 'observations'), ''),
           technical_notes = nullif(trim(p_header ->> 'technical_notes'), ''),
           declaration_text = nullif(trim(p_header ->> 'declaration_text'), ''),
           last_save_request_id = p_client_request_id
     where id = v.id;
    -- Troca completa dos itens na mesma transação: falha no meio desfaz tudo.
    delete from public.quote_items where quote_id = v.id;
  end if;

  -- Itens: as CHECKs de quote_items (0700:38-54) conferem subtotal, modo e detalhado.
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.quote_items (
      quote_id, location_label, title, pricing_mode, quantity, unit, unit_price_cents, subtotal_cents, lines, notes, sort_order
    ) values (
      v.id,
      trim(v_item ->> 'location_label'),
      nullif(trim(v_item ->> 'title'), ''),
      v_item ->> 'pricing_mode',
      nullif(v_item ->> 'quantity', '')::numeric,
      nullif(trim(v_item ->> 'unit'), ''),
      nullif(v_item ->> 'unit_price_cents', '')::bigint,
      (v_item ->> 'subtotal_cents')::bigint,
      coalesce(array(
        select x from jsonb_array_elements_text(
          case when jsonb_typeof(v_item -> 'lines') = 'array' then v_item -> 'lines' else '[]'::jsonb end
        ) as x
      ), '{}'),
      nullif(trim(v_item ->> 'notes'), ''),
      v_i
    );
    v_i := v_i + 1;
  end loop;

  -- Total recalculado pelo gatilho quote_items_total.
  select * into v from public.quotes where id = v.id;
  return v;
end $$;

revoke execute on function public.quote_save(uuid, jsonb, jsonb, uuid, timestamptz) from anon, public;
grant execute on function public.quote_save(uuid, jsonb, jsonb, uuid, timestamptz) to authenticated;
