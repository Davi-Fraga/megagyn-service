-- Legendas das fotos (definidas após o envio, junto com o registro).
create or replace function public.attachment_set_captions(p_captions jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_key text;
  v_value text;
  v_count integer := 0;
begin
  perform private.require_staff();
  if p_captions is null or jsonb_typeof(p_captions) <> 'object' then
    return 0;
  end if;
  for v_key, v_value in select key, value from jsonb_each_text(p_captions) loop
    update public.attachments
       set caption = nullif(left(trim(v_value), 200), '')
     where id = v_key::uuid
       and (uploaded_by = auth.uid() or public.is_admin());
    if found then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

revoke execute on function public.attachment_set_captions(jsonb) from anon, public;
grant execute on function public.attachment_set_captions(jsonb) to authenticated;
