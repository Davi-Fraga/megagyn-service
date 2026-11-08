-- Etapa 4 da trilha visual: leitura de chamados e de atividades com o atalho de admin.
-- has_site_access(site_id) já devolve verdadeiro para admin, mas roda linha a linha, a cerca
-- de 100 µs por chamada: contar 30 mil chamados como admin levava 2,5 s. Com
-- (select public.is_admin()), o "é admin?" é decidido uma vez por consulta. A regra é a
-- mesma para todos os papéis; só muda o custo. Rollback: voltar o using para has_site_access(site_id).
alter policy service_requests_select on public.service_requests
  using ((select public.is_admin()) or public.has_site_access(site_id));

alter policy work_entries_select on public.work_entries
  using ((select public.is_admin()) or public.has_site_access(site_id));
