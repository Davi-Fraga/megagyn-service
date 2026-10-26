# Megagyn Service

Plataforma web (celular e computador) para a Megagyn registrar chamados e ordens de serviço, montar a agenda multiobra, gerar o diário de obra a partir do que a equipe registra, controlar compras com rateio e reembolso, emitir orçamentos e fechar o mês com relatório PDF versionado.

Planejamento, requisitos e decisões: [docs/](docs/00-resumo-executivo.md). Operação (deploy, backup, restauração): [docs/08-operacao.md](docs/08-operacao.md). Manual por perfil: [docs/09-manual-por-perfil.md](docs/09-manual-por-perfil.md).

> **Decisão pendente (Q1):** o login do responsável do cliente ainda não foi decidido. O sistema funciona hoje no **cenário B** (só equipe Megagyn; a administração abre chamados em nome do cliente e entrega os relatórios por fora). O modelo de dados já suporta o cenário A sem migração destrutiva — ver [docs/07-questoes-de-negocio.md](docs/07-questoes-de-negocio.md).

## Stack

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 · Supabase (PostgreSQL com RLS, Auth, Storage privado) · PDFs em HTML/CSS renderizados pelo Chromium (Playwright) · Vitest e Playwright para testes.

## Rodar localmente

Pré-requisitos: Node 22+, Docker Desktop, Supabase CLI.

```bash
npm install
npx playwright install chromium     # usado pelos PDFs e pelos testes E2E
npm run db:start                    # Supabase local (portas 554xx; ver supabase/config.toml)
npm run db:reset                    # aplica as migrações em supabase/migrations
npm run env:local                   # gera .env.local com as chaves LOCAIS do Supabase
npm run seed                        # dados de demonstração FICTÍCIOS
npm run dev                         # http://localhost:3000
```

Acessos de demonstração (senha `Demo@Megagyn2026`, somente ambiente local):

| Perfil | E-mail |
|---|---|
| Administração | admin@demo.megagyn.local |
| Encarregado | encarregado@demo.megagyn.local |
| Funcionário | joao@demo.megagyn.local, pedro@demo.megagyn.local |

Para testar no celular pela rede local, acesse `http://<ip-do-computador>:3000`. A câmera do navegador exige HTTPS fora de `localhost`; em produção o app roda com HTTPS.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | desenvolvimento, build e produção |
| `npm run worker` | retoma PDFs na fila ou interrompidos (o app já gera cada PDF logo após o pedido) |
| `npm run lint` · `npm run typecheck` | ESLint e TypeScript |
| `npm test` | testes de regras puras (Vitest) |
| `npm run test:db` | testes de integração com o banco (RLS, funções, gatilhos) — exige Supabase local |
| `npm run test:e2e` | testes de ponta a ponta no navegador (Playwright). Para resultados estáveis, rode contra o build de produção: `npm run build`, `npx next start -p 3100` e `E2E_BASE_URL=http://localhost:3100 npx playwright test` |
| `npm run db:types` | regenera `src/server/db/database.types.ts` |
| `npm run backup` · `npm run restore:test` | cópia de segurança do banco e dos arquivos; restauração verificada em ambiente descartável |

A CI do GitHub (`.github/workflows/ci.yml`) roda lint, typecheck, testes de regras e build a cada push. Testes de banco e E2E precisam do Supabase local e rodam na máquina de desenvolvimento.

## Estrutura

```
src/domain/        regras puras testáveis (status do chamado, dinheiro e rateio, snapshot do fechamento, diárias, CSV, extenso, nomes de arquivo)
src/server/        sessão, consultas, ações de servidor, PDFs (reports/), apuração do fechamento (closings.ts), diário (daily-log.ts)
src/app/admin/     telas da administração (desktop primeiro, responsivas)
src/app/campo/     telas da equipe de campo (celular primeiro)
src/app/api/       envio e leitura de arquivos, download de PDFs, CSV
src/reports/       templates HTML/CSS dos PDFs (escape automático)
supabase/          migrações SQL com RLS, funções de negócio e gatilhos
tests/db, tests/e2e
worker/            processador da fila de PDFs
```

## Segurança, em resumo

- Toda leitura de dados usa a sessão do usuário com RLS; mudanças de situação, rateios e fechamentos passam por funções do banco que conferem papel e local.
- Arquivos ficam em buckets privados; o servidor só entrega os bytes depois de confirmar pela RLS que o usuário pode ver aquele anexo.
- A chave `service_role` fica só no servidor (uploads, criação de contas, geração de PDFs). Nunca vai para o navegador.
- Valores sempre em centavos inteiros. Custo interno, valor de orçamento e valor de diárias nunca se somam.
- Os documentos de referência com dados reais (`*.docx`, `*.pdf`, `Prompt.md` na raiz) estão no `.gitignore`.
- Relatório completo da revisão de segurança: `docs/11-revisao-seguranca.md`. Revisão de uso no celular: `docs/12-revisao-ux-mobile.md`.
