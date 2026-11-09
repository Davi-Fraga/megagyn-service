-- B-18 (M-12), parte 2 de 2: documentos e fotos cadastrais do cliente; inativação com motivo.
-- Antes: o cliente não tinha onde guardar contrato, alvará ou fotos do cadastro, e desativar não pedia motivo.
-- Agora:
--   * bucket privado "registry" (cadastros), lido só pela administração (política de attachments);
--   * attachment_links.category: categoria livre do documento (ex.: Contrato), opcional;
--   * client_attach_documents: liga arquivos do bucket de cadastros ao cliente como "documento" ou
--     "foto_cadastral"; só a administração; arquivo já ligado a outro registro é recusado;
--   * client_set_active: ativa ou desativa o cliente; desativar exige motivo, que vai para a trilha.
-- Compatibilidade: o app anterior desativa pelo update direto (política de admin), que continua valendo.
-- Dados existentes: nenhuma linha é alterada; a coluna nova nasce nula.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('registry', 'registry', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

alter table public.attachment_links
  add column category text check (category is null or length(category) between 1 and 80);

-- Corpo anterior: 20261104000100_attachments_hide_revoked.sql (só ganha a linha do bucket de cadastros).
drop policy attachments_select on public.attachments;
create policy attachments_select on public.attachments for select to authenticated using (
  (revoked_at is null or public.is_admin())
  and (
    (bucket = 'evidence' and public.has_site_access(site_id))
    or (bucket = 'receipts' and (public.is_admin() or (public.current_app_role() = 'foreman' and uploaded_by = auth.uid())))
    or (bucket = 'branding' and public.is_staff())
    or (bucket in ('reports', 'quotes', 'registry') and public.is_admin())
  )
);

create function public.client_attach_documents(
  p_client_id uuid,
  p_attachment_ids uuid[],
  p_role public.evidence_role,
  p_category text default null
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_att public.attachments;
  v_offset integer;
  v_count integer := 0;
begin
  perform private.require_admin();
  if not exists (select 1 from public.clients where id = p_client_id) then
    perform private.fail('Cliente não encontrado. Atualize a página.');
  end if;
  if p_role not in ('documento', 'foto_cadastral') then
    perform private.fail('Escolha documento ou foto do cadastro.', 'role');
  end if;
  if coalesce(array_length(p_attachment_ids, 1), 0) = 0 then
    perform private.fail('Envie ao menos 1 arquivo.', 'attachmentIds');
  end if;
  if p_category is not null and length(trim(p_category)) > 80 then
    perform private.fail('Use no máximo 80 caracteres na categoria.', 'category');
  end if;

  select coalesce(max(sort_order) + 1, 0) into v_offset
    from public.attachment_links where entity_type = 'client' and entity_id = p_client_id;
  foreach v_id in array p_attachment_ids loop
    select * into v_att from public.attachments where id = v_id for update;
    if not found or v_att.bucket <> 'registry' or v_att.revoked_at is not null then
      perform private.fail('Arquivo inválido para o cadastro do cliente. Envie de novo.', 'attachmentIds');
    end if;
    if exists (
      select 1 from public.attachment_links l
       where l.attachment_id = v_id and not (l.entity_type = 'client' and l.entity_id = p_client_id)
    ) then
      perform private.fail('Este arquivo já está ligado a outro registro.', 'attachmentIds');
    end if;
    insert into public.attachment_links (attachment_id, entity_type, entity_id, evidence_role, sort_order, linked_by, category)
    values (v_id, 'client', p_client_id, p_role, v_offset + v_count, auth.uid(), nullif(trim(p_category), ''))
    on conflict (attachment_id, entity_type, entity_id) do nothing;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

create function public.client_set_active(p_client_id uuid, p_active boolean, p_reason text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform private.require_admin();
  if not p_active and private.blank(p_reason) then
    perform private.fail('Informe o motivo da desativação.', 'reason');
  end if;
  perform set_config('app.audit_reason', coalesce(trim(p_reason), ''), true);
  update public.clients set is_active = p_active where id = p_client_id returning id into v_id;
  perform set_config('app.audit_reason', '', true);
  if v_id is null then
    perform private.fail('Cliente não encontrado. Atualize a página.');
  end if;
  return p_active;
end $$;

revoke execute on function public.client_attach_documents(uuid, uuid[], public.evidence_role, text) from anon, public;
revoke execute on function public.client_set_active(uuid, boolean, text) from anon, public;
grant execute on function public.client_attach_documents(uuid, uuid[], public.evidence_role, text) to authenticated, service_role;
grant execute on function public.client_set_active(uuid, boolean, text) to authenticated, service_role;
