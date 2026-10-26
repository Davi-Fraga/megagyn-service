-- Fotos de orçamento (local e serviços semelhantes): bucket próprio, acesso só da administração.
alter type public.attachment_bucket add value if not exists 'quotes';
