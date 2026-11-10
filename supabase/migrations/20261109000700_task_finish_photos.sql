-- B-38 (M-18, A-14): finalizar a tarefa num local grava a observação e as fotos do resultado.
-- As fotos ficam ligadas à ocorrência (entidade task_occurrence, papel resultado) e passam pela mesma
-- conferência dos outros registros (private.link_attachments: autor, bucket de evidência, mesmo local).
-- Observação e foto continuam opcionais; só ficam obrigatórias se a Megagyn decidir (DP-05).
-- A assinatura antiga (uuid, text) sai; o parâmetro novo tem DEFAULT, então a chamada antiga segue valendo.

drop function public.task_occurrence_finish(uuid, text);

create function public.task_occurrence_finish(
  p_occurrence_id uuid,
  p_notes text default null,
  p_photo_ids uuid[] default '{}'
) returns public.task_occurrences
language plpgsql security definer set search_path = '' as $$
declare
  v public.task_occurrences;
begin
  perform private.require_staff();
  v := private.lock_occurrence(p_occurrence_id);
  if v.status = 'concluida' then
    return v;
  end if;
  if v.status not in ('prevista', 'iniciada') then
    perform private.fail('Esta tarefa não pode ser finalizada na situação atual.');
  end if;
  update public.task_occurrences
     set status = 'concluida', finished_at = now(), started_at = coalesce(started_at, now()),
         notes = coalesce(nullif(trim(p_notes), ''), notes)
   where id = v.id returning * into v;
  perform private.link_attachments(p_photo_ids, 'task_occurrence', v.id, 'resultado', v.site_id);
  return v;
end $$;

revoke execute on function public.task_occurrence_finish(uuid, text, uuid[]) from public, anon;
grant execute on function public.task_occurrence_finish(uuid, text, uuid[]) to authenticated, service_role;
