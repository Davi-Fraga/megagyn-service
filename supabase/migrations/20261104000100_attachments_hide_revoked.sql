-- M-01 (Fase 0, B-03; achado A-02): foto removida fica fora do alcance de quem não é administração.
-- Arquivo: supabase/migrations/20261104000100_attachments_hide_revoked.sql
--
-- Antes: attachments_select (20261025001400_review_fixes.sql:438-444) não olhava revoked_at.
-- Quem tinha acesso ao local continuava lendo a linha do anexo removido e baixava os bytes por
-- /api/files/<id> (a rota decide pelo que a RLS devolve). As telas do campo mostravam a foto esmaecida.
-- Agora: anexo removido só aparece para a administração (histórico, conferência, fechamentos já emitidos).
--
-- Só política: nenhuma linha é alterada. attachment_links_select (0200:88-90) depende desta política
-- (exists em attachments), então o vínculo da foto removida também some para a equipe.
-- Funções security definer (link_attachments, request_mark_executed, fechamento por service_role)
-- não passam pela RLS e não mudam.

drop policy if exists attachments_select on public.attachments;
create policy attachments_select on public.attachments for select to authenticated using (
  (revoked_at is null or public.is_admin())
  and (
    (bucket = 'evidence' and public.has_site_access(site_id))
    or (bucket = 'receipts' and (public.is_admin() or (public.current_app_role() = 'foreman' and uploaded_by = auth.uid())))
    or (bucket = 'branding' and public.is_staff())
    or (bucket in ('reports', 'quotes') and public.is_admin())
  )
);
