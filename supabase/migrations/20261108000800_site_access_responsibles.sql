-- Fase 1, B-21 (M-11): o local ganha horário e orientações de acesso e os responsáveis.
--   * access_hours, access_instructions: aparecem para a equipe no chamado do campo;
--   * responsible_profile_id: responsável na Megagyn;
--   * client_responsible_contact_id: responsável do cliente, que precisa ser contato DO MESMO cliente
--     (FK composta para client_contacts (id, client_id); com o campo vazio, nada é conferido).
-- Aditiva: colunas novas, todas opcionais; nenhuma linha existente muda.
alter table public.client_contacts add constraint client_contacts_id_client_key unique (id, client_id);

alter table public.sites
  add column access_hours text check (access_hours is null or length(access_hours) <= 200),
  add column access_instructions text check (access_instructions is null or length(access_instructions) <= 2000),
  add column responsible_profile_id uuid references public.profiles (id),
  add column client_responsible_contact_id uuid;

alter table public.sites
  add constraint sites_client_responsible_contact_fkey
  foreign key (client_responsible_contact_id, client_id) references public.client_contacts (id, client_id);
