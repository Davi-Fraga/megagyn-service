-- Fase 1, B-16 (M-10, etapa 1), parte 2 de 2: a equipe deixa de ler as colunas sensíveis nas tabelas.
-- A RLS filtra linhas, não colunas. Por isso a leitura de profiles, clients e sites passa a ser concedida
-- POR COLUNA ao papel authenticated (o mesmo da administração e da equipe):
--   * profiles: fora email e phone;
--   * clients: fora notes_internal e billing_info;
--   * sites: fora notes_internal.
-- A administração (e cada pessoa, para o próprio contato) lê essas colunas pelas views da parte 1
-- (20261108000900): profile_contacts, client_internal e site_internal. O app já lê só por elas.
-- O papel anon perde a leitura dessas tabelas (antes lia, mas a RLS não devolvia linha nenhuma).
-- Escritas não mudam: só a leitura é por coluna.
-- ATENÇÃO para migrações futuras: coluna nova nessas três tabelas precisa de
-- `grant select (coluna) on public.<tabela> to authenticated` (ou entrar na lista de privadas).
-- O teste tests/db/collaborators.test.ts falha se alguma coluna ficar sem classificação.

revoke select on public.profiles from anon, authenticated;
grant select (id, full_name, role, is_active, deactivated_at, created_at, updated_at) on public.profiles to authenticated;

revoke select on public.clients from anon, authenticated;
grant select (id, kind, legal_name, display_name, document, email, phone, address_text, is_active, created_by, created_at, updated_at, document_digits)
  on public.clients to authenticated;

revoke select on public.sites from anon, authenticated;
grant select (id, client_id, name, code, site_type, status, address_text, planned_start, planned_end, quote_id, created_by, created_at, updated_at,
              access_hours, access_instructions, responsible_profile_id, client_responsible_contact_id)
  on public.sites to authenticated;
