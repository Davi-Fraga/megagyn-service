-- Etapa 4 da trilha visual (docs/megagyn/08): as contagens do painel passam a ser feitas no banco.
-- Antes, o painel baixava todos os chamados, em páginas de 1000, só para contá-los.
-- Só leitura: não cria tabela nem muda dado. security invoker: vale a RLS de quem chama, a mesma
-- das listas que cada cartão abre (B-11). Indicador novo (B-28) entra como chave nova no jsonb,
-- com a mesma assinatura.
create or replace function public.dashboard_summary(
  p_today date,
  p_from date,
  p_to date,
  p_client_id uuid default null,
  p_site_id uuid default null,
  p_person_id uuid default null,
  p_attention_size integer default 8
) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with req as (
    -- Mesmos filtros da lista de chamados (src/server/request-list.ts).
    select r.id, r.number, r.title, r.status, r.due_date, r.opened_at, r.site_id, r.current_pending,
           coalesce(r.due_date < p_today and r.status not in ('concluida', 'cancelada'), false) as overdue
      from public.service_requests r
     where (p_client_id is null or r.client_id = p_client_id)
       and (p_site_id is null or r.site_id = p_site_id)
       and (p_person_id is null or exists (
             select 1 from public.request_assignments a
              where a.service_request_id = r.id
                and a.profile_id = p_person_id
                and a.unassigned_at is null))
  ),
  attention as (
    -- "O que precisa de você": vencidos primeiro, pelo prazo; depois validar, destravar e triar.
    select q.*, case q.status when 'executada' then 1 when 'pendente' then 2 when 'aberta' then 3 else 0 end as rank
      from req q
     where q.overdue or q.status in ('executada', 'pendente', 'aberta')
  ),
  shown as (
    select * from attention
     order by overdue desc, case when overdue then due_date end, rank, opened_at, id
     limit p_attention_size
  ),
  entries as (
    -- Mesmo critério da lista de atividades: data do serviço dentro do período.
    select e.site_id, count(*) as n
      from public.work_entries e
     where e.activity_date between p_from and p_to
       and (p_site_id is null or e.site_id = p_site_id)
       and (p_person_id is null or e.author_id = p_person_id)
       and (p_client_id is null or exists (
             select 1 from public.sites s where s.id = e.site_id and s.client_id = p_client_id))
     group by e.site_id
  )
  select jsonb_build_object(
    'requests', jsonb_build_object(
      'by_status', coalesce((select jsonb_object_agg(status, n) from (select status::text, count(*) as n from req group by status) s), '{}'::jsonb),
      'not_closed', (select count(*) from req where status not in ('concluida', 'cancelada')),
      'overdue', (select count(*) from req where overdue),
      'new_today', (select count(*) from req where opened_at >= (p_today::timestamp at time zone 'America/Sao_Paulo')),
      'pending_by_reason', coalesce((
        select jsonb_agg(jsonb_build_object('label', label, 'count', n) order by n desc, label nulls last)
          from (select current_pending->>'pending_reason' as label, count(*) as n
                  from req where status = 'pendente' group by 1) x), '[]'::jsonb),
      'pending_by_owner', coalesce((
        select jsonb_agg(jsonb_build_object('label', label, 'count', n) order by n desc, label nulls last)
          from (select current_pending->>'next_action_owner_name' as label, count(*) as n
                  from req where status = 'pendente' group by 1) x), '[]'::jsonb)
    ),
    'attention', jsonb_build_object(
      'total', (select count(*) from attention),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', t.id, 'number', t.number, 'title', t.title, 'status', t.status,
                 'due_date', t.due_date, 'site_id', t.site_id, 'overdue', t.overdue,
                 'pending_reason', case when t.status = 'pendente' then t.current_pending->>'pending_reason' end,
                 'assignee_ids', coalesce((
                   select jsonb_agg(a.profile_id order by a.assigned_at)
                     from public.request_assignments a
                    where a.service_request_id = t.id and a.unassigned_at is null), '[]'::jsonb))
               order by t.overdue desc, case when t.overdue then t.due_date end, t.rank, t.opened_at, t.id)
          from shown t), '[]'::jsonb)
    ),
    'work_entries', jsonb_build_object(
      'total', (select coalesce(sum(n), 0) from entries),
      'by_site', coalesce((select jsonb_agg(jsonb_build_object('site_id', site_id, 'count', n) order by n desc, site_id) from entries), '[]'::jsonb)
    ),
    'active_sites', (
      -- Mesmo critério da lista de locais: situação Ativa.
      select count(*) from public.sites s
       where s.status = 'ativa' and (p_client_id is null or s.client_id = p_client_id)),
    'open_quotes', (
      -- Propostas enviadas e dentro da validade.
      select jsonb_build_object('count', count(*), 'total_cents', coalesce(sum(q.total_cents), 0))
        from public.quotes q
       where q.status = 'enviado'
         and (q.valid_until is null or q.valid_until >= p_today)
         and (p_client_id is null or q.client_id = p_client_id))
  )
$$;

comment on function public.dashboard_summary is
  'Contagens do painel da administração (etapa 4 da trilha visual). Só leitura, com a RLS de quem chama.';
