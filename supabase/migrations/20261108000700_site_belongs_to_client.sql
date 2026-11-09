-- Fase 1, B-22 (M-09; achado A-18): orçamento, fechamento e regra de cobrança só aceitam local do mesmo
-- cliente. A O.S. já tinha essa garantia (FK composta em service_requests, 0300:52).
-- Nas três tabelas, a FK de uma coluna (site_id → sites) é trocada por uma FK composta
-- (site_id, client_id) → sites (id, client_id), COM O MESMO NOME. Assim:
--   * a composta cobre tudo o que a antiga garantia (local existente) e mais o cliente;
--   * continua havendo UMA relação entre cada tabela e sites: as consultas que trazem o local junto
--     (site:sites(...), sites!quotes_site_id_fkey) seguem funcionando, inclusive no app em produção.
--     Com as duas FKs, o PostgREST não saberia qual relação usar.
-- site_id nulo continua aceito (FK composta MATCH SIMPLE: com site_id nulo, nada é conferido).
-- Cada FK entra NOT VALID e é validada em seguida: se alguma linha antiga tiver local de outro cliente,
-- a migração para e nada muda. O diagnóstico em produção roda antes do push.
alter table public.quotes drop constraint quotes_site_id_fkey;
alter table public.quotes
  add constraint quotes_site_id_fkey foreign key (site_id, client_id) references public.sites (id, client_id) not valid;
alter table public.quotes validate constraint quotes_site_id_fkey;

alter table public.monthly_closings drop constraint monthly_closings_site_id_fkey;
alter table public.monthly_closings
  add constraint monthly_closings_site_id_fkey foreign key (site_id, client_id) references public.sites (id, client_id) not valid;
alter table public.monthly_closings validate constraint monthly_closings_site_id_fkey;

alter table public.billing_rules drop constraint billing_rules_site_id_fkey;
alter table public.billing_rules
  add constraint billing_rules_site_id_fkey foreign key (site_id, client_id) references public.sites (id, client_id) not valid;
alter table public.billing_rules validate constraint billing_rules_site_id_fkey;
