# 08 — Operação: implantação, configuração, backup e restauração

> Documento de operação da primeira versão. Itens que dependem de contas, domínio ou credenciais da Megagyn estão marcados como **pendente (externo)**.

## 1. Componentes

| Componente | Função | Onde roda |
|---|---|---|
| App Next.js | telas, ações de servidor, envio/leitura de arquivos, geração imediata de PDF | container (`npm start`) |
| Worker | retoma PDFs na fila, com falha (até 3 tentativas) ou interrompidos | mesmo container, comando `npm run worker` |
| Supabase | PostgreSQL + RLS, Auth (login e recuperação de senha), Storage privado | projeto Supabase (homologação e produção separados) |

O Chromium (para os PDFs) já vem na imagem base do `Dockerfile` (`mcr.microsoft.com/playwright`). Hospedagens serverless sem Chromium (ex.: Vercel) usam `PDF_RENDERER=gotenberg` com um serviço Gotenberg (`gotenberg/gotenberg:8`) acessível pelo app via `GOTENBERG_URL`. Verificado em 29/10/2026: o teste do PDF longo (`tests/db/pdf-long.test.ts`) gerou as mesmas 37 páginas, com cabeçalho e numeração, pelos dois renderizadores. Nesse cenário o worker (`npm run worker`) não roda; a retomada de PDFs fica por conta do botão "Tentar de novo" ou de um agendamento externo que chame a geração.

## 2. Implantação (passo a passo)

1. **Supabase (pendente, externo):** criar dois projetos (homologação e produção). Em Auth, desligar o auto-cadastro, definir a URL do site (`https://<domínio>`) e as URLs de retorno `https://<domínio>/auth/callback` e `https://<domínio>/auth/confirm`, e configurar o SMTP. Nos modelos de e-mail **Reset Password** e **Invite user**, usar o conteúdo de `supabase/templates/recovery.html` e `supabase/templates/invite.html` (link com `token_hash` para `/auth/confirm`): assim o link funciona mesmo aberto em outro aparelho. Com SMTP próprio, ajustar em Auth → Rate Limits o limite de e-mails por hora: o padrão (2 por hora) não comporta o cadastro da equipe por convite.
2. **Migrações:** `supabase link --project-ref <ref>` e `supabase db push` (aplica `supabase/migrations`). Conferir que os buckets `evidence`, `receipts`, `branding`, `reports` e `quotes` foram criados como **privados**.
3. **Variáveis de ambiente** (ver `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (só servidor), `APP_URL` (com https), `APP_TIMEZONE=America/Sao_Paulo`, `PDF_RENDERER`.
4. **Imagem:** `docker build -t megagyn .` e executar dois containers: o app (`docker run --env-file .env.production -p 3000:3000 megagyn`) e o worker (`... megagyn npm run worker`). Colocar o app atrás de HTTPS (proxy reverso ou plataforma com TLS).
5. **Primeiro acesso:** criar o primeiro usuário administrador no painel do Supabase (Auth → Add user) e inserir o perfil (`insert into profiles (id, full_name, email, role) values (...,'admin')`). Depois disso, todos os demais usuários são criados pela tela **Usuários**: com a senha em branco, a pessoa recebe um convite por e-mail e cria a própria senha (o link vale 1 hora; "Enviar link para criar nova senha" reenvia). A senha provisória fica para quem não pode usar o e-mail no momento.
6. **Segurança no navegador (já no código):** cookies de sessão `HttpOnly` e `SameSite=Lax`, com `Secure` quando `APP_URL` começa com `https://` (por isso o `APP_URL` de produção precisa ser https). As páginas saem com CSP sem origens externas. Script ainda exige `'unsafe-inline'` (scripts de hidratação do Next sem nonce). Anexos de imagem saem com CSP `sandbox`. Foto original (com EXIF da câmera) só para administração; os demais recebem a versão sem metadados.
7. **Configurações da empresa:** preencher razão social, CNPJ, endereço, site, responsável técnico, CREA, logotipo e assinatura em **Configurações**. O seed de demonstração já carrega o logotipo oficial (`src/assets/brand/logo.png`); em produção, envie-o em Configurações. Os documentos de referência trazem dados divergentes; confirmar com a Megagyn antes de emitir relatórios (Q2).

## 2a. Piloto gratuito: Vercel + Gotenberg no Render + Supabase Free

Caminho escolhido em 29/10/2026 (`docs/13-plano-implantacao-piloto.md`). Sem cartão e sem custo; nada adormece enquanto o monitor externo estiver ativo.

1. **Supabase:** passos 1 a 3 da seção 2, com o projeto na região São Paulo. Depois do deploy, ajustar Site URL e URLs de retorno para o endereço da Vercel.
2. **Gotenberg no Render:** New → Web Service → "Existing image" → `gotenberg/gotenberg:8`, instância Free, região Ohio ou Virginia. Variável `PORT=3000` (porta em que a imagem escuta) e Health Check Path `/health`. Anotar a URL `https://<nome>.onrender.com`. Proteger o serviço: `API_ENABLE_BASIC_AUTH=true`, `GOTENBERG_API_BASIC_AUTH_USERNAME` e `GOTENBERG_API_BASIC_AUTH_PASSWORD`. Sem isso, qualquer pessoa com o endereço usa o serviço.
3. **Vercel:** importar o repositório do GitHub (branch `main`). Variáveis de ambiente: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL` (o endereço https da Vercel), `APP_TIMEZONE=America/Sao_Paulo`, `PDF_RENDERER=gotenberg`, `GOTENBERG_URL`, `GOTENBERG_USER`, `GOTENBERG_PASSWORD`, `CRON_SECRET` (gerar com `openssl rand -hex 32`). O `vercel.json` agenda `/api/jobs/reports` uma vez por dia, o máximo do plano Hobby; o cron da Vercel envia o `CRON_SECRET` sozinho.
4. **Despertador:** criar um monitor gratuito no UptimeRobot ou no cron-job.org em `https://<app>/api/health`, a cada 5 minutos. Essa rota toca o banco (o Supabase Free pausa após 7 dias sem atividade) e o Gotenberg (o Render Free dorme após 15 minutos). O workflow `despertador.yml` faz um ping diário como reserva; ele precisa da variável de repositório `APP_URL` no GitHub.
5. **Limites a configurar:** em Configurações, limite de PDF de comprovante em 4 MB (a Vercel recusa corpo acima de 4,5 MB); fotos já chegam menores. O worker contínuo não roda na Vercel: PDFs interrompidos voltam pelo botão "Tentar de novo" ou pelo cron diário.
6. **Como o Gotenberg frio se comporta:** o primeiro PDF do dia pode levar cerca de 1 minuto, porque o app espera o serviço acordar (`waitForService`, até 2 min) dentro dos 300 s da função. Com o monitor ativo isso não acontece.
7. **Conferir no ar:** `GET /api/health` responde `{"ok":true,"db":true,"renderer":"gotenberg","rendererUp":true}`; login, chamado com foto e PDF de fechamento pelo roteiro de `docs/13`, etapa E5.

## 2b. Servidor próprio: Oracle Always Free com Docker Compose

Substitui Vercel e Render quando o sistema passar a operar de verdade. O plano Hobby da Vercel não permite uso comercial, e o Render pede para não usar instância gratuita em produção. Aqui, app, worker e Chromium rodam na mesma máquina, sem limite de 4,5 MB e sem serviço dormindo.

1. **Máquina:** `VM.Standard.A1.Flex`, Ubuntu 24.04 Arm, 2 OCPU e 6 GB. A Oracle pode recolher máquina com CPU, rede e memória abaixo de 20% por 7 dias; com 6 GB, a memória tende a ficar acima disso. Acompanhe nas métricas da Oracle.
2. **Rede:** libere as portas 80 e 443 na Security List da VCN e no `iptables` da máquina. Acesso SSH só por chave.
3. **Instalação:** Docker com Compose e `unattended-upgrades`. Clone o repositório com deploy key somente leitura.
4. **Variáveis:** copie por `scp` um `.env.production` só com o que o app usa, sem a senha do banco e sem `DEMO_PASSWORD`. `APP_URL` recebe o endereço final com https.
5. **Subir:** `SITE_ADDRESS=<endereço> docker compose -f docker-compose.prod.yml up -d --build`. O Caddy emite o certificado sozinho.
6. **Atualizar:** `git pull` e o mesmo comando de subir.
7. **Depois de trocar o endereço:** ajuste Site URL e URLs de retorno no Supabase, o monitor do UptimeRobot, a variável `APP_URL` do GitHub e o limite de PDF em Configurações de volta para 20 MB.

## 3. Limites e dimensionamento (pressupostos, ajustáveis em Configurações)

| Item | Valor inicial | Observação |
|---|---|---|
| Foto | 15 MB | o celular reduz para até 1600 px antes do envio (comprovante, 2000 px); o servidor guarda só essa versão, sem metadados, e a miniatura |
| PDF de comprovante | 20 MB | |
| Arquivos por envio | 20 | |
| Atividade retroativa (campo) | 7 dias | a administração pode lançar datas mais antigas |

Referência de volume: o relatório real de setembro/2026 tinha 24 dias e cerca de 100 fotos para um cliente. Com 10 clientes nesse ritmo, cerca de 1.000 fotos/mês (≈ 0,5–1 GB/mês após a redução no celular). O custo de armazenamento depende do plano contratado (**pendente, externo**).

## 4. Cópias de segurança

| O quê | Como | Frequência sugerida | Retenção sugerida |
|---|---|---|---|
| Banco (dados, contas, metadados dos arquivos) | `npm run backup` → `pg_dump` (formato custom) | diária | 30 diárias |
| Arquivos (fotos, comprovantes, PDFs, logotipo) | `npm run backup` → download dos objetos dos buckets privados, com hash SHA-256 no `manifest.json`; com `BACKUP_SKIP_LIST`, só os que ainda não estão guardados | diária, incremental | cópia única: nada é apagado |
| Backups automáticos do Supabase | dependem do plano contratado | — | **pendente (externo):** confirmar no plano |

`npm run backup` grava em `backups/<data-hora>/`. Em produção, defina `DATABASE_URL` (conexão do Postgres; use a do Session pooler, que funciona em IPv4, como no workflow de backup). Sem `pg_dump` instalado, o script usa o do contêiner local do Supabase, que precisa estar no ar. Sem `DATABASE_URL`, o backup de um projeto remoto para com erro: o banco e os arquivos vêm sempre do mesmo projeto. Agende o comando (cron/agendador) e copie a pasta para um armazenamento externo (outro provedor ou bucket S3 compatível). A pasta `backups/` está no `.gitignore`.

### Backup automático gratuito (GitHub Actions + Google Drive)

O Supabase Free não tem backup automático. O workflow `.github/workflows/backup.yml` roda todo dia às 06:00 UTC e guarda duas coisas no Google Drive:

- **Banco e manifesto:** uma cópia por dia na pasta `megagyn-backups`, cifrada com `gpg`, apagando as que têm mais de 30 dias.
- **Arquivos:** uma cópia única na pasta `megagyn-arquivos`, cifrada pelo rclone com a mesma senha. Cada dia baixa do Supabase só o que ainda não está lá, porque baixar tudo diariamente esgotaria a cota de saída do plano gratuito. Arquivo gravado não muda, e nada é apagado dessa pasta.

Para ligar:

1. No seu computador, rode `rclone config`, crie um destino do tipo Google Drive com o nome `gdrive` e autorize no navegador.
2. Cadastre em GitHub → Settings → Secrets and variables → Actions os segredos `BACKUP_DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_PASSPHRASE` e `RCLONE_CONFIG`, este com o conteúdo do `rclone.conf`. Em `BACKUP_DATABASE_URL`, use a conexão **Session pooler** do Supabase, porque o runner do GitHub só tem IPv4.
3. Crie a variável de repositório `BACKUP_ENABLED=true` e dispare o workflow pela aba Actions.

Guarde `BACKUP_PASSPHRASE` fora do GitHub e não a troque depois de ligar: sem ela, nenhuma das duas pastas abre. Falha no workflow gera e-mail do GitHub para o dono do repositório.

Para restaurar:

1. Baixe uma cópia de `megagyn-backups` e abra com `gpg --decrypt <arquivo> | tar -xz`. Ela traz `db.dump` e `manifest.json`.
2. Traga os arquivos para a mesma pasta, com a senha em `BACKUP_PASSPHRASE`:

   ```bash
   export RCLONE_CRYPT_REMOTE=gdrive:megagyn-arquivos
   export RCLONE_CRYPT_PASSWORD="$(printf '%s' "$BACKUP_PASSPHRASE" | rclone obscure -)"
   rclone copy :crypt: <pasta>/storage
   ```

3. Confira com `npm run restore:test -- <pasta>`.

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
