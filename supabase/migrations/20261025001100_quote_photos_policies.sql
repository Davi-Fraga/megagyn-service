-- (separado do ALTER TYPE: o novo valor do enum só pode ser usado após commit)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quotes', 'quotes', false, 104857600, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists attachments_select on public.attachments;
create policy attachments_select on public.attachments for select to authenticated using (
  (bucket = 'evidence' and public.has_site_access(site_id))
  or (bucket = 'receipts' and (public.is_admin() or uploaded_by = auth.uid()))
  or (bucket = 'branding' and public.is_staff())
  or (bucket in ('reports', 'quotes') and public.is_admin())
);

drop policy if exists attachments_insert on public.attachments;
create policy attachments_insert on public.attachments for insert to authenticated with check (
  uploaded_by = auth.uid() and (
    (bucket = 'evidence' and public.has_site_access(site_id))
    or (bucket = 'receipts' and public.current_app_role() in ('admin', 'foreman'))
    or (bucket in ('branding', 'quotes') and public.is_admin())
  )
);
