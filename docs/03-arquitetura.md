# 03 — Arquitetura

> Etapa 1 — 25/10/2026. Proposta técnica; nada foi instalado ou implementado.

## 1. Estado do repositório

| Item | Encontrado |
|------|-----------|
| Código-fonte, `package.json`, migrações, testes, `.env.example` | **Nenhum.** A pasta contém apenas os 3 documentos de referência e `Prompt.md`. |
| Git | Não inicializado. |
| Ferramentas locais disponíveis | Node 24.13, pnpm, Python 3.13, Supabase CLI (`supabase-cli` no PATH), Docker Desktop, `pdftotext`. |

Conclusão: não há arquitetura a preservar. Vale a proposta preferencial do Prompt §4, que também coincide com a stack que o desenvolvedor já usa (Next.js/React/TS, PostgreSQL/Supabase).

## 2. Stack proposta

| Camada | Escolha | Por quê | Alternativa descartada |
|--------|---------|---------|------------------------|
| Front + BFF | **Next.js 15 (App Router) + TypeScript** | Um deploy só; rotas por perfil com layouts separados; Server Actions/Route Handlers para regras no servidor; SSR bom em celular com rede fraca | SPA React + API separada: dois deploys e CORS sem ganho para o porte |
| UI | **Tailwind CSS + shadcn/ui** (Radix) | Componentes acessíveis (foco, teclado, labels) e temáveis na paleta Megagyn (laranja/cinza/branco) | MUI/Ant: mais pesado, visual genérico |
| Formulários/validação | **react-hook-form + Zod** (mesmo schema no cliente e no servidor) | Formulários resilientes em celular, mensagens associadas aos campos | — |
| Banco | **PostgreSQL via Supabase** | Relacional, RLS nativa, triggers para regras invariantes (rateio, append-only), extensões (`pgcrypto`) | Neon + auth própria: perde RLS integrada ao Auth e o Storage com policies |
| Autenticação | **Supabase Auth** (e-mail + senha, sem auto-cadastro; admin convida) | Login individual, recuperação de senha pronta, JWT com claims usadas na RLS | NextAuth: reimplementaria reset/sessão |
| Arquivos | **Supabase Storage**, buckets privados, URLs assinadas | Policies por caminho + função SQL de autorização; mesmo projeto do banco | S3 direto: mais configuração, sem policy integrada ao usuário |
| Acesso a dados | `@supabase/ssr` no servidor com a sessão do usuário (RLS ativa). **`service_role` só no worker de PDF e em rotinas administrativas**, sempre após checagem explícita de permissão | Defesa em profundidade: regra no servidor **e** no banco | ORM (Prisma/Drizzle) com conexão única: bypass de RLS por padrão |
| Migrações | **SQL versionado com Supabase CLI** (`supabase/migrations/*.sql`) | Rastreável, roda local (Docker) e em produção | — |
| PDF | **HTML + CSS de impressão renderizado por Chromium headless (Playwright)** em processo Node de trabalho | Paginação longa, tabelas, imagens, cabeçalho/rodapé com "Página X de Y", controle fino de quebras; o relatório real tem 35 páginas e ~100 fotos | Ver §7 |
| Imagens | **sharp** (thumb + derivada para PDF, remoção de EXIF/GPS) | Preservar original como evidência e servir versões leves | — |
| Testes | **Vitest** (regras puras), **Supabase local + Vitest** (RLS/triggers com dois clientes autenticados), **Playwright** (E2E, viewport mobile) | Cobre os 18 testes de aceite | — |
| Lint/format | ESLint + Prettier + `tsc --noEmit` | — | — |

Nenhuma dependência além dessas será adicionada sem registro em 06. Sem microserviços: um app Next.js + um worker Node (mesmo repositório, mesma imagem Docker, processos distintos).

## 3. Módulos e organização do código

```
megagyn-service/
├─ app/
│  ├─ (auth)/login, recuperar-acesso, acesso-negado
│  ├─ admin/            # ADM-xx (desktop-first, responsivo)
│  ├─ campo/            # CMP-xx (mobile-first; funcionário e encarregado)
│  ├─ cliente/          # CLI-xx — SÓ SE cenário A for confirmado (pasta não criada antes)
│  └─ api/              # route handlers: uploads/finalize, reports/jobs, csv
├─ src/
│  ├─ domain/           # regras puras, sem I/O: status-machine, money, closing, extenso, file-name
│  ├─ server/           # server actions e serviços (usam supabase com sessão do usuário)
│  ├─ db/               # tipos gerados do schema, queries
│  ├─ ui/               # componentes compartilhados (MediaUploader, StatusBadge, Timeline…)
│  └─ reports/          # templates HTML/CSS dos PDFs + serializadores (whitelist cliente)
├─ worker/              # processo Node: fila de PDF/CSV, derivadas de imagem
├─ supabase/
│  ├─ migrations/       # SQL versionado
│  ├─ seed/             # dados DEMO fictícios (claramente sinalizados)
│  └─ tests/            # testes de RLS/trigger
├─ tests/e2e/           # Playwright
├─ docs/                # este planejamento
└─ .env.example
```

Módulos de domínio (puros, testáveis sem banco): `status-machine` (transições + pré-condições), `money` (centavos, rateio, arredondamento), `closing` (classificação do snapshot), `amount-in-words` (extenso pt-BR), `report-naming` (nome do arquivo), `date-tz` (fronteiras de mês em America/Sao_Paulo).

## 4. Autenticação

- Supabase Auth, provedor e-mail/senha. **Auto-cadastro desligado**; administrador cria o usuário (convite por e-mail de redefinição de senha). O e-mail transacional de convite/recuperação é o único e-mail do MVP e depende de SMTP configurado no projeto Supabase (dependência externa a registrar).
- `profiles` (1:1 com `auth.users`) guarda `role`, `is_active`, nome, telefone. Papel vai como claim customizada no JWT (hook de acesso) para a RLS não precisar de subconsulta em toda policy.
- Middleware do Next.js: sem sessão → `/login`; `is_active=false` → `/acesso-negado` e sessão revogada; rota de perfil errado → `/acesso-negado`.
- Recuperação de acesso: fluxo nativo do Supabase (`/recuperar-acesso`).
- Inativação: `is_active=false` + `auth.admin.updateUserById({ban_duration})`; nenhum DELETE em `auth.users` (preserva autorias — T-A15).

## 5. Autorização: RBAC + escopo

### 5.1 Papéis

| `role` | Escopo | Observação |
|--------|--------|------------|
| `admin` | Tudo | Único papel que cria usuários, valida OS, aprova despesas, fecha mês |
| `worker` (funcionário fixo) | `site_memberships` ativas | Vê OS/tarefas atribuídas e da(s) unidade(s) onde é membro |
| `foreman` (encarregado) | `site_memberships` ativas (várias obras) | Igual a `worker` + registrar compra/rateio + agenda multiobra |
| `client` (responsável do cliente) | `client_contact_sites` do contato vinculado | **Só existe se o cenário A for confirmado.** O enum já prevê o valor para não exigir migração destrutiva depois; nenhuma policy é criada antes da decisão |

### 5.2 Funções SQL de apoio (SECURITY DEFINER, `STABLE`)

```sql
auth_role()                      -- claim do JWT
is_admin()                       -- auth_role() = 'admin'
has_site_access(site_id uuid)    -- admin OR membership ativa OR (client) contato autorizado
accessible_site_ids()            -- conjunto para filtros em listas
is_client()                      -- cenário A
```

### 5.3 Matriz de políticas (resumo; policies completas nas migrações)

| Tabela | admin | worker/foreman | client (A) |
|--------|-------|----------------|------------|
| `clients`, `sites`, `site_areas` | CRUD | SELECT onde `has_site_access` | SELECT onde `has_site_access` (colunas internas via view) |
| `service_requests` | CRUD | SELECT onde `has_site_access`; UPDATE **somente via RPC** de transição | SELECT onde `has_site_access` AND não interna; INSERT via RPC (origem portal) |
| `request_events` | SELECT; INSERT via RPC | SELECT (exceto `is_internal`); INSERT via RPC | SELECT onde `is_internal=false` |
| `request_comments` | CRUD | SELECT/INSERT | SELECT/INSERT onde `is_internal=false` |
| `tasks`, `task_occurrences` | CRUD | SELECT onde atribuído; UPDATE status via RPC | — |
| `work_entries`, `work_entry_participants` | CRUD | INSERT/SELECT próprias e do site; UPDATE próprias enquanto `review_status='enviado'` | SELECT onde `client_visible=true` |
| `time_entries` | CRUD | INSERT/SELECT próprias | — (só via demonstrativo do relatório, se habilitado) |
| `attachments` | CRUD | INSERT; SELECT via vínculo com site acessível | SELECT onde `visibility='client'` e vínculo acessível |
| `expenses`, `expense_allocations`, `expense_reviews`, `reimbursements`, `suppliers` | CRUD | foreman: INSERT/SELECT próprias; UPDATE enquanto não aprovada | **nenhuma policy** (deny by default) |
| `billing_rules` | CRUD | — | — |
| `quotes*` | CRUD | — | — |
| `monthly_closings`, `closing_versions`, `report_artifacts` | CRUD | — | SELECT via `report_publications` ativas |
| `audit_events` | SELECT | — | — |
| `company_settings` | CRUD | SELECT de colunas públicas (view) | SELECT view pública |

Regras adicionais:
- Toda transição de estado, rateio e fechamento passa por **função RPC** (`SECURITY DEFINER` com checagem interna de papel) — nunca UPDATE direto na coluna `status`. Isso garante regras do Word mesmo se alguém chamar a API do Supabase diretamente.
- Tabelas de eventos/auditoria: **sem policy de UPDATE/DELETE** para ninguém (append-only).
- Colunas sensíveis de tabelas lidas pelo cliente (ex.: `sites.internal_notes`) ficam fora via **views** específicas do portal; o cliente nunca lê a tabela base.
- Storage: policy de SELECT em cada bucket chama `attachment_accessible(storage_key)`, que resolve o `attachment` pelo caminho e aplica `has_site_access` + `visibility`.

## 6. Anexos e mídia

```
Celular ──1. POST /api/uploads/init (metadados, client_upload_id)──▶ servidor
        ◀─ signed upload URL + attachment_id (status=enviando) ──────
        ──2. PUT direto no Storage (bucket privado) ────────────────▶ Supabase Storage
        ──3. POST /api/uploads/finalize ───────────────────────────▶ servidor:
             lê primeiros bytes → valida magic bytes × MIME declarado × extensão
             valida tamanho ≤ limite configurado
             enfileira derivadas (thumb 320px, medium 1600px, strip EXIF/GPS)
             status=concluido; se falhar → status=falhou (botão "Tentar novamente")
```

- Buckets: `evidence` (fotos de OS/atividade/tarefa), `receipts` (comprovantes), `reports` (PDFs/CSVs gerados), `branding` (logo/assinatura). Todos privados.
- Chave: `{client_id}/{site_id}/{yyyy}/{mm}/{attachment_id}.{ext}` — permite policy por prefixo e exportação por cliente.
- Idempotência: `UNIQUE (uploader_id, client_upload_id)`; reenvio retorna o mesmo `attachment_id`. `content_hash` (SHA-256) sinaliza duplicata para o usuário sem bloquear.
- URLs assinadas com TTL curto (padrão 10 min), geradas no servidor após `has_site_access`. Nunca URL pública.
- Limites iniciais (configuráveis em `company_settings`, não hardcoded): 15 MB por imagem, 20 MB por PDF, 20 arquivos por envio. Valores padrão são **pressupostos**, a ajustar com o custo real de armazenamento do plano contratado.

## 7. Estratégia de PDF

Requisitos que pesam: A4 paginado, 30+ páginas, grade de fotos com legenda, tabela de diárias, cabeçalho/rodapé repetidos com numeração, título "SETEMBRO / 2026", nome de arquivo determinístico, geração sem travar a UI.

| Opção | Prós | Contras | Veredito |
|-------|------|---------|----------|
| **HTML/CSS + Chromium headless (Playwright)** | Mesmo CSS da pré-visualização na tela; `@page`, `break-inside: avoid`, header/footer templates com `pageNumber/totalPages`; fotos e tabelas sem esforço | Precisa de Chromium no servidor (~300 MB); não roda em serverless padrão | **Escolhido**. Roda no worker (Docker) |
| `@react-pdf/renderer` | Sem navegador, leve | Layout próprio (sem CSS real), quebras de página e tabelas longas trabalhosas | Alternativa se Chromium for inviável no hosting |
| Gotenberg (container) | Chromium isolado via HTTP | Mais um container para operar | Alternativa aceitável se o hosting for serverless (ex.: Vercel) |
| Screenshot de tela | — | Não é PDF paginado real | Rejeitado (Prompt §4) |

Fluxo: botão **"Exportar PDF"** → `report_artifacts(status='na_fila')` → worker renderiza template com o **payload congelado da versão** (não consulta estado atual) → envia ao bucket `reports` → `status='pronto'` → UI (polling/Realtime) habilita "Baixar". Falha → `status='falhou'` com mensagem e botão de repetir. Pré-visualização usa o mesmo HTML na tela (modo `print` via CSS).

Nome do arquivo: `Relatorio_<Cliente>_<Mês>_<Ano>[_Resumo][_vN].pdf`, com cliente "slugificado" sem acentos (ex.: `Relatorio_Park_dos_Alpes_Setembro_2026.pdf`). Título/cabeçalho: "RELATÓRIO DE SERVIÇOS PRESTADOS — SETEMBRO / 2026".

CSV: UTF-8 **com BOM**, separador `;`, decimal com vírgula, datas `dd/MM/yyyy` — abre direto no Excel pt-BR. Gerado pela **mesma query** da listagem (mesmos filtros), por isso os totais conciliam (T-A13).

## 8. Fuso horário, datas e dinheiro

- Banco em `timestamptz` (UTC). Datas de negócio (`activity_date`, `scheduled_date`, `work_date`, `expense_date`) em `date`, interpretadas em America/Sao_Paulo.
- Corte do mês: `cutoff_utc = ((make_date(y, m, 1) + interval '1 month') AT TIME ZONE 'America/Sao_Paulo')` — primeiro instante do mês seguinte em SP, comparado com `<`. Equivale a "até 23:59:59.999 do último dia".
- Dinheiro: `BIGINT` em centavos em todas as tabelas; `NUMERIC(12,3)` só para quantidades. Subtotal de item detalhado = `round_half_up(qty × unit_price_cents)`; total = soma inteira. Nunca `float`/`double`. No TypeScript, `bigint` ou inteiro `number` com guarda `Number.isSafeInteger`.
- Formatação `R$ 1.234,56` e `dd/MM/yyyy` via `Intl` com `pt-BR`.

## 9. Infraestrutura, deploy, backup

**Ambientes**: local (Supabase CLI + Docker), homologação e produção (projetos Supabase distintos; app em container).

**Hospedagem do app**: imagem Docker única (Next.js + worker). Qualquer host de container serve (VPS, Railway, Fly.io, Render). Se o cliente preferir Vercel, o worker de PDF vai para Gotenberg/Browserless — decisão de hosting registrada como dependência externa, não como pressuposto.

**Variáveis de ambiente** (`.env.example`, sem valores reais): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (só servidor/worker), `APP_URL`, `APP_TIMEZONE=America/Sao_Paulo`, `PDF_RENDERER=playwright|gotenberg`, `GOTENBERG_URL` (opcional).

**Backup (não declarar pronto até verificar)**:
1. Banco: backups automáticos do Supabase **dependem do plano contratado** — verificar no projeto real. Independentemente disso, rotina própria `pg_dump` diária (cron no worker ou GitHub Actions) para bucket externo, retenção 30 dias.
2. Storage: espelhamento diário dos buckets (API de listagem + download → bucket externo/S3 compatível), incremental por `updated_at`.
3. Restauração: script `scripts/restore-test.sh` que sobe Supabase local, restaura dump + anexos e roda smoke test (abre uma OS com foto). Evidência exigida no T-A16; o que depender de credenciais do cliente será documentado como pendente.

**Logs e falhas**: logs estruturados (pino) com `request_id`; erros de PDF/upload persistidos no próprio registro (`error_message`) e visíveis ao admin; retry com backoff no worker (3 tentativas).

## 10. Segurança (resumo operacional)

- HTTPS obrigatório; cookies `HttpOnly/Secure/SameSite=Lax`.
- Zod em toda entrada; queries parametrizadas (supabase-js); sem SQL dinâmico.
- Rate limit básico em login e upload init (middleware).
- Headers: CSP sem `unsafe-inline` onde possível, `X-Content-Type-Options`, `Referrer-Policy`.
- Teste automatizado de IDOR: usuário de campo da obra A tenta ler OS/anexo/PDF da obra B por id, por URL assinada vencida e por path do Storage → 403/404 (T-A10). No cenário A, o mesmo para cliente A × cliente B.
- LGPD: dados pessoais mínimos (nome, e-mail, telefone); contatos de cliente podem ser **anonimizados** em vez de apagados (mantém rastreabilidade); política de retenção configurável e documentada.

## 11. Impacto arquitetural da decisão Q1 (login do cliente)

| Aspecto | Cenário A (com login) | Cenário B (sem login) |
|---------|----------------------|-----------------------|
| Auth | +1 papel `client`; convite de contatos | Nada |
| RLS | +~12 policies e 3 views sanitizadas; função `is_client()` | Nenhuma policy para `client` (deny) |
| Rotas | `app/cliente/*` (5 telas) | Não existe |
| Storage | Policy adicional por `visibility='client'` | Só interno |
| Relatórios | `report_publications` com UI de publicar/revogar + download no portal | Admin baixa e envia por fora; tabela registra "liberado" para histórico |
| Testes | T-A10 completo (IDOR cliente), T-A1 parte cliente | T-A10 só campo |

A modelagem de dados é a **mesma** nos dois cenários (ver [04-modelo-dados.md](04-modelo-dados.md) §2.2): contatos do cliente são pessoas cadastradas sem conta; o cenário A apenas preenche `client_contacts.user_id`.

## 12. Trade-offs assumidos

1. **Supabase como plataforma** concentra banco, auth e storage; o custo é dependência de fornecedor. Mitigação: SQL puro nas migrações, Storage S3-compatível, exportação de dados/anexos prevista (Word §9).
2. **Regras em RPC/trigger + servidor** duplicam parte da lógica. Aceito: é o único jeito de garantir que a API do Supabase não burle regras do Word.
3. **Chromium no worker** pesa na imagem Docker. Aceito pela fidelidade do PDF; alternativa Gotenberg documentada.
4. **Sem fila externa** (Redis etc.): fila é a própria tabela `report_artifacts`/`jobs` com `SELECT … FOR UPDATE SKIP LOCKED`. Suficiente para o porte.
5. **Realtime opcional**: estado de processamento do PDF por polling simples (3 s) é suficiente; Realtime do Supabase fica como melhoria.
