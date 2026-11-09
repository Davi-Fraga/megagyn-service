-- Fase 1, B-17 (M-08; achado A-17): o banco recusa CPF/CNPJ repetido, com ou sem pontuação.
-- O app já confere o dígito verificador e grava o número formatado. Aqui fica a garantia no banco:
--   * document_digits: só os números do documento (coluna gerada);
--   * tamanho certo para o tipo: 11 (CPF, pessoa física) ou 14 (CNPJ, pessoa jurídica);
--   * índice único parcial: cliente sem documento continua aceito.
-- A CHECK entra NOT VALID e é validada em seguida, no mesmo arquivo: se algum cliente antigo tiver
-- tamanho errado, a migração para e nada muda. O índice único também para a migração se houver número
-- repetido. O diagnóstico em produção roda antes do push.
alter table public.clients
  add column document_digits text generated always as (regexp_replace(coalesce(document, ''), '\D', '', 'g')) stored;

alter table public.clients
  add constraint clients_document_digits_length check (
    document_digits = ''
    or (kind = 'pf' and length(document_digits) = 11)
    or (kind = 'pj' and length(document_digits) = 14)
  ) not valid;
alter table public.clients validate constraint clients_document_digits_length;

create unique index clients_document_digits_uidx on public.clients (document_digits) where document_digits <> '';
