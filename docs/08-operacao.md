# 08 — Operação: implantação, configuração, backup e restauração

> Documento de operação da primeira versão. Itens que dependem de contas, domínio ou credenciais da Megagyn estão marcados como **pendente (externo)**.

## 1. Componentes

| Componente | Função | Onde roda |
|---|---|---|
| App Next.js | telas, ações de servidor, envio/leitura de arquivos, geração imediata de PDF | container (`npm start`) |
| Worker | retoma PDFs na fila, com falha (até 3 tentativas) ou interrompidos | mesmo container, comando `npm run worker` |
| Supabase | PostgreSQL + RLS, Auth (login e recuperação de senha), Storage privado | projeto Supabase (homologação e produção separados) |

O Chromium (para os PDFs) já vem na imagem base do `Dockerfile` (`mcr.microsoft.com/playwright`). Hospedagens serverless sem Chromium podem usar `PDF_RENDERER=gotenberg` com um serviço Gotenberg (**não verificado neste ambiente**).

## 2. Implantação (passo a passo)

1. **Supabase (pendente, externo):** criar dois projetos (homologação e produção). Em Auth, desligar o auto-cadastro, definir a URL do site (`https://<domínio>`) e as URLs de retorno `https://<domínio>/auth/callback` e `https://<domínio>/auth/confirm`, e configurar o SMTP. Nos modelos de e-mail **Reset Password** e **Invite user**, usar o conteúdo de `supabase/templates/recovery.html` e `supabase/templates/invite.html` (link com `token_hash` para `/auth/confirm`): assim o link funciona mesmo aberto em outro aparelho. Com SMTP próprio, ajustar em Auth → Rate Limits o limite de e-mails por hora: o padrão (2 por hora) não comporta o cadastro da equipe por convite.
2. **Migrações:** `supabase link --project-ref <ref>` e `supabase db push` (aplica `supabase/migrations`). Conferir que os buckets `evidence`, `receipts`, `branding`, `reports` e `quotes` foram criados como **privados**.
3. **Variáveis de ambiente** (ver `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (só servidor), `APP_URL` (com https), `APP_TIMEZONE=America/Sao_Paulo`, `PDF_RENDERER`.
4. **Imagem:** `docker build -t megagyn .` e executar dois containers: o app (`docker run --env-file .env.production -p 3000:3000 megagyn`) e o worker (`... megagyn npm run worker`). Colocar o app atrás de HTTPS (proxy reverso ou plataforma com TLS).
5. **Primeiro acesso:** criar o primeiro usuário administrador no painel do Supabase (Auth → Add user) e inserir o perfil (`insert into profiles (id, full_name, email, role) values (...,'admin')`). Depois disso, todos os demais usuários são criados pela tela **Usuários**: com a senha em branco, a pessoa recebe um convite por e-mail e cria a própria senha (o link vale 1 hora; "Enviar link para criar nova senha" reenvia). A senha provisória fica para quem não pode usar o e-mail no momento.
6. **Segurança no navegador (já no código):** cookies de sessão `HttpOnly` e `SameSite=Lax`, com `Secure` quando `APP_URL` começa com `https://` (por isso o `APP_URL` de produção precisa ser https). As páginas saem com CSP sem origens externas. Script ainda exige `'unsafe-inline'` (scripts de hidratação do Next sem nonce). Anexos de imagem saem com CSP `sandbox`. Foto original (com EXIF da câmera) só para administração; os demais recebem a versão sem metadados.
7. **Configurações da empresa:** preencher razão social, CNPJ, endereço, site, responsável técnico, CREA, logotipo e assinatura em **Configurações**. Os documentos de referência trazem dados divergentes; confirmar com a Megagyn antes de emitir relatórios (Q2).

## 3. Limites e dimensionamento (pressupostos, ajustáveis em Configurações)

| Item | Valor inicial | Observação |
|---|---|---|
| Foto | 15 MB | o celular reduz para até 2560 px antes do envio |
| PDF de comprovante | 20 MB | |
| Arquivos por envio | 20 | |
| Atividade retroativa (campo) | 7 dias | a administração pode lançar datas mais antigas |

Referência de volume: o relatório real de setembro/2026 tinha 24 dias e cerca de 100 fotos para um cliente. Com 10 clientes nesse ritmo, cerca de 1.000 fotos/mês (≈ 0,5–1 GB/mês após a redução no celular). O custo de armazenamento depende do plano contratado (**pendente, externo**).

## 4. Cópias de segurança

| O quê | Como | Frequência sugerida | Retenção sugerida |
|---|---|---|---|
| Banco (dados, contas, metadados dos arquivos) | `npm run backup` → `pg_dump` (formato custom) | diária | 30 diárias + 12 mensais |
| Arquivos (fotos, comprovantes, PDFs, logotipo) | `npm run backup` → download de todos os objetos dos buckets privados, com hash SHA-256 no `manifest.json` | diária (incremental pode ser adotado depois) | igual ao banco |
| Backups automáticos do Supabase | dependem do plano contratado | — | **pendente (externo):** confirmar no plano |

`npm run backup` grava em `backups/<data-hora>/`. Em produção, defina `DATABASE_URL` (conexão direta do Postgres) e tenha `pg_dump` instalado; agende o comando (cron/agendador) e copie a pasta para um armazenamento externo (outro provedor ou bucket S3 compatível). A pasta `backups/` está no `.gitignore`.

## 5. Teste de restauração

`npm run restore:test` (ou `npm run restore:test -- backups/<pasta>`):

1. confere o hash do arquivo do banco com o manifesto;
2. restaura o banco em uma base **descartável** (`restore_test`) e compara a contagem das tabelas principais;
3. envia cada arquivo para um bucket **descartável**, baixa de volta e confere o SHA-256;
4. confirma que todo anexo registrado no banco restaurado tem o arquivo correspondente;
5. remove a base e o bucket descartáveis (use `--keep` para inspecionar).

A evidência da última execução está em [10-checklist-aceite.md](10-checklist-aceite.md) (T-A16). Em produção, o mesmo procedimento deve rodar contra o projeto de **homologação**, nunca contra a produção.

## 6. Logs e falhas

- O app e o worker escrevem logs em JSON de uma linha (`event`, `level`, ids). Nunca registram senhas, tokens nem conteúdo de anexos.
- Falhas de PDF ficam no próprio pedido (`report_artifacts.status = falhou` com mensagem) e aparecem na tela com o botão "Tentar de novo". O worker refaz até 3 vezes.
- Falhas de envio de foto aparecem na fila de envio do celular com "Tentar de novo"; o reenvio usa a mesma chave e não duplica.

## 7. LGPD e retenção

- Dados pessoais mínimos: nome, e-mail e telefone da equipe e dos contatos dos clientes. Sem geolocalização; as fotos perdem o EXIF (incluindo localização) ao serem reduzidas no celular, e as versões usadas na tela e nos PDFs são geradas sem metadados.
- Usuários desligados são **desativados** (sem login, com autoria preservada). Contatos de clientes podem ser **anonimizados** na tela do cliente.
- Política de retenção é configurável em Configurações; os registros de auditoria, eventos de chamado, versões de fechamento e conferências de despesa são imutáveis por desenho.
