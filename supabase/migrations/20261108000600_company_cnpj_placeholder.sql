-- Fase 1, B-27: o CNPJ da empresa passa a ser conferido pelo dígito verificador nas Configurações.
-- O seed de demonstração gravava "00.000.000/0000-00" como CNPJ provisório. Esse número não existe,
-- sairia nos PDFs e travaria o salvamento das Configurações. Fica em branco até a Megagyn confirmar
-- o oficial (DP-15); com o CNPJ em branco, o PDF omite a linha.
-- Altera no máximo 1 linha (company_settings tem uma só), e só se o CNPJ for todo de zeros.
select set_config('app.audit_reason', 'B-27: CNPJ provisório de zeros retirado (DP-15).', true);
update public.company_settings
   set cnpj = null
 where regexp_replace(coalesce(cnpj, ''), '\D', '', 'g') ~ '^0{14}$';
select set_config('app.audit_reason', '', true);
