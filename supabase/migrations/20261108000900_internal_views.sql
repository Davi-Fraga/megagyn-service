-- Fase 1, B-16 (M-10, etapa 1), parte 1 de 2: views para ler as colunas sensíveis.
-- A parte 2 (20261108001000_private_columns.sql) tira da equipe a leitura dessas colunas nas tabelas.
-- Esta parte vem antes e sozinha: o app novo passa a ler as colunas sensíveis por aqui, e só depois que
-- ele estiver no ar a parte 2 é aplicada. Assim nenhuma versão do app fica sem funcionar.
-- As views rodam com o dono (ignoram RLS e permissões por coluna) e filtram explicitamente;
-- security_barrier impede que um filtro da consulta passe à frente do da view.
--   * profile_contacts: e-mail e telefone; a administração vê todos, cada pessoa vê o próprio;
--   * client_internal: notas internas e dados de cobrança do cliente; só a administração;
--   * site_internal: notas internas do local; só a administração.
create view public.profile_contacts with (security_barrier = true) as
  select p.id, p.email, p.phone from public.profiles p
   where public.is_admin() or p.id = auth.uid();

create view public.client_internal with (security_barrier = true) as
  select c.id, c.notes_internal, c.billing_info from public.clients c
   where public.is_admin();

create view public.site_internal with (security_barrier = true) as
  select s.id, s.notes_internal from public.sites s
   where public.is_admin();

revoke all on public.profile_contacts, public.client_internal, public.site_internal from anon, authenticated;
grant select on public.profile_contacts, public.client_internal, public.site_internal to authenticated;
