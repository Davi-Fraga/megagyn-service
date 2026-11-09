-- B-18 (M-12), parte 1 de 2: valores novos de enum para documentos e fotos do cliente.
-- Ficam num arquivo próprio porque um valor novo de enum não pode ser usado na mesma transação em que é
-- criado (doc 03 §5). O uso vem em 20261109000500_client_documents.sql.
-- Dados existentes: nenhuma linha é alterada.

alter type public.attachment_entity add value if not exists 'client';
alter type public.attachment_bucket add value if not exists 'registry';
alter type public.evidence_role add value if not exists 'foto_cadastral';
