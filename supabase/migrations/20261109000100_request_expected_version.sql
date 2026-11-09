-- B-26 (M-15, A-25): aviso de versão desatualizada na edição do chamado.
-- Antes: a coluna version subia só nas mudanças de situação e nunca era comparada; duas abas editando o
-- mesmo chamado gravavam uma por cima da outra.
-- Agora: request_update aceita p_expected_version (opcional, padrão nulo) e recusa salvar quando o
-- chamado mudou depois que a tela foi aberta; a própria edição também sobe a versão.
-- Compatibilidade: o app anterior chama sem p_expected_version e segue gravando como antes. A assinatura
-- antiga sai neste arquivo para não haver duas funções com o mesmo nome.
-- Dados existentes: nenhuma linha é alterada.

drop function public.request_update(uuid, text, text, uuid, uuid, date, uuid, boolean, text, uuid);

create function public.request_update(
  p_request_id uuid,
  p_title text,
  p_description text,
  p_priority_id uuid,
  p_service_category_id uuid,
  p_due_date date,
  p_site_area_id uuid,
  p_is_internal boolean,
  p_reason text default null,
  p_client_request_id uuid default null,
  p_expected_version integer default null
) returns public.service_requests
language plpgsql security definer set search_path = '' as $$
declare
  v public.service_requests;
  v_before jsonb;
  v_after jsonb;
  v_changed jsonb := '{}'::jsonb;
  v_key text;
begin
  perform private.require_admin();
  v := private.lock_request(p_request_id);
  -- O reenvio da mesma edição (mesma chave) devolve o chamado, mesmo que a versão já tenha subido.
  if private.event_applied(v.id, p_client_request_id) then
    return v;
  end if;
  if p_expected_version is not null and v.version <> p_expected_version then
    perform private.fail('Este chamado foi alterado depois que você abriu a página. Nada foi salvo: recarregue para ver a versão atual.', 'expectedVersion');
  end if;
  if v.status in ('concluida', 'cancelada') then
    perform private.fail('Reabra o chamado antes de editar.');
  end if;
  if private.blank(p_title) then
    perform private.fail('Informe o título.', 'title');
  end if;
  if private.blank(p_description) then
    perform private.fail('Descreva o problema ou serviço.', 'description');
  end if;
  if p_site_area_id is not null and not exists (
    select 1 from public.site_areas a where a.id = p_site_area_id and a.site_id = v.site_id
  ) then
    perform private.fail('Ambiente não pertence ao local.', 'siteAreaId');
  end if;

  v_before := jsonb_build_object('title', v.title, 'description', v.description, 'priority_id', v.priority_id,
    'service_category_id', v.service_category_id, 'due_date', v.due_date, 'site_area_id', v.site_area_id, 'is_internal', v.is_internal);
  v_after := jsonb_build_object('title', trim(p_title), 'description', trim(p_description), 'priority_id', p_priority_id,
    'service_category_id', p_service_category_id, 'due_date', p_due_date, 'site_area_id', p_site_area_id, 'is_internal', coalesce(p_is_internal, false));

  for v_key in select jsonb_object_keys(v_after) loop
    if (v_before -> v_key) is distinct from (v_after -> v_key) then
      v_changed := v_changed || jsonb_build_object(v_key, jsonb_build_object('de', v_before -> v_key, 'para', v_after -> v_key));
    end if;
  end loop;
  if v_changed = '{}'::jsonb then
    return v;
  end if;
  if (v_changed ? 'due_date' or v_changed ? 'priority_id') and private.blank(p_reason) then
    perform private.fail('Informe o motivo da alteração de prazo ou prioridade.', 'reason');
  end if;

  perform set_config('app.audit_reason', coalesce(p_reason, ''), true);
  update public.service_requests
     set title = trim(p_title), description = trim(p_description), priority_id = p_priority_id,
         service_category_id = p_service_category_id, due_date = p_due_date, site_area_id = p_site_area_id,
         is_internal = coalesce(p_is_internal, false), version = version + 1
   where id = v.id
   returning * into v;
  perform set_config('app.audit_reason', '', true);

  insert into public.request_events (service_request_id, event_type, actor_id, reason, payload)
  values (v.id, case when v_changed ? 'due_date' then 'prorrogacao'::public.request_event_type else 'edicao'::public.request_event_type end,
          auth.uid(), nullif(trim(p_reason), ''), jsonb_build_object('changes', v_changed, 'client_request_id', p_client_request_id));
  return v;
end $$;

revoke execute on function public.request_update(uuid, text, text, uuid, uuid, date, uuid, boolean, text, uuid, integer) from anon, public;
grant execute on function public.request_update(uuid, text, text, uuid, uuid, date, uuid, boolean, text, uuid, integer) to authenticated, service_role;
