-- M-07 (Fase 0, B-12; achado A-13): uma obra por orçamento.
-- Arquivo: supabase/migrations/20261104000800_sites_quote_unique.sql
--
-- Antes: sites.quote_id tinha só a FK (20261025000700_quotes.sql:112). "Criar obra a partir do
-- orçamento" conferia a existência e depois inseria (src/server/actions/quotes.ts:274-289): duas
-- requisições simultâneas passavam pela conferência e criavam duas obras.
-- Agora: índice único parcial em sites(quote_id). A segunda inserção recebe unique_violation (23505,
-- constraint sites_quote_uidx) e a ação devolve a obra que já existe.
--
-- Índice único não aceita NOT VALID. Por isso a migração confere as duplicatas antes e PARA, com
-- mensagem, se houver alguma (mesma consulta do diagnóstico D1 do README). Nesse caso a Megagyn decide
-- qual obra fica ligada ao orçamento; nada é corrigido automaticamente.
-- Dados existentes: nenhuma linha é alterada.

do $$
declare
  v_dup integer;
begin
  select count(*) into v_dup
    from (select quote_id from public.sites where quote_id is not null group by quote_id having count(*) > 1) d;
  if v_dup > 0 then
    raise exception 'M-07: % orçamento(s) com mais de uma obra ligada. Rode o diagnóstico D1 do README e decida antes de aplicar.', v_dup;
  end if;
end $$;

create unique index sites_quote_uidx on public.sites (quote_id) where quote_id is not null;
