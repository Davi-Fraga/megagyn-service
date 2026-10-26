# 06 — Plano por fases

> **Situação em 26/10/2026:** F0 a F6 implementadas e verificadas (ver `docs/10-checklist-aceite.md`), com estas exceções: F5.b (portal do cliente) aguarda a decisão Q1; F0.1 sem commit, porque commits só são feitos a pedido do responsável pelo repositório; F6.4 testado em celular emulado, falta aparelho real; F6.6 (homologação e piloto) depende de hospedagem e Supabase de produção.
>
> Etapa 1 — 25/10/2026. Backlog ordenado por dependência. Cada tarefa é uma fatia vertical pequena (banco + regra + tela + permissão + teste). Esforço em **tamanho relativo** (P = pequeno ≤ ½ dia, M = 1–2 dias, G = 3–5 dias) — não são prazos contratuais.

## 0. Pré-condições para começar a implementar

| # | Item | Bloqueia |
|---|------|----------|
| PC-1 | Aceite deste planejamento pelo solicitante | tudo |
| PC-2 | **Decisão Q1 (login do cliente)** | apenas F5.b (portal) e as policies/testes do papel `client`; o restante segue |
| PC-3 | Projeto Supabase (homologação) ou uso local via CLI | F1 em diante (local basta no início) |
| PC-4 | Dados cadastrais confirmados da Megagyn (razão social, CNPJ, endereço, site, CREA, logo em boa resolução) | apenas o seed de configuração; campos são editáveis |
| PC-5 | Definição do hosting do app (container × serverless) | F5 (renderizador de PDF: Playwright embutido × Gotenberg) |

## F0 — Preparação (G)

| Tarefa | Critério de conclusão | Risco |
|--------|----------------------|-------|
| F0.1 `git init`, branch `main` protegida mentalmente (trabalhar em branches `feat/*`), `.gitignore`, `.editorconfig` | Repositório com primeiro commit contendo `docs/` | — |
| F0.2 Scaffold Next.js 15 + TS + Tailwind + shadcn/ui + ESLint/Prettier + Vitest + Playwright | `pnpm lint && pnpm typecheck && pnpm test && pnpm build` verdes em projeto vazio | — |
| F0.3 Supabase CLI: `supabase init`, `supabase start` (Docker), `.env.example` | Banco local sobe; `.env.example` sem segredos | Docker no Windows |
| F0.4 Tokens de design (cores Megagyn com contraste AA, tipografia, espaçamento), layout base admin (sidebar) e campo (barra inferior) | Página de amostra com os 3 layouts responsivos | — |
| F0.5 Pipeline mínimo (GitHub Actions: lint, typecheck, test unit) | CI verde | — |

## F1 — Fundação: dados, auth, permissões (G)

| Tarefa | Critério de conclusão | Teste | Risco |
|--------|----------------------|-------|-------|
| F1.1 Migração 0001: extensões, enums, `company_settings`, `clients`, `client_contacts`, `client_contact_sites`, `sites`, `site_areas`, `profiles`, `site_memberships`, catálogos, `audit_events`, `number_sequences` | `supabase db reset` aplica sem erro; tipos TS gerados | I-catalogs | — |
| F1.2 Funções `auth_role()`, `is_admin()`, `has_site_access()`, `accessible_site_ids()`; claim de papel no JWT; policies das tabelas de F1.1 | Teste com 3 sessões (admin, worker A, foreman B): worker A não lê site B | I-rls-base | Hook de JWT do Supabase |
| F1.3 Auth: login, recuperar acesso, acesso negado, middleware por perfil, inativação | T-A15 passa (inativo perde acesso, autorias ficam) | T-A15 | SMTP para reset |
| F1.4 ADM-17 Configurações da empresa (todos os campos de R-01, upload de logo/assinatura em bucket `branding`) | Campos salvos; cabeçalho de PDF mock lê daqui | U-settings-snapshot | — |
| F1.5 ADM-02 Clientes + contatos (sem conta) | CRUD; contato N:N unidades | I-contact-scope | — |
| F1.6 ADM-03 Locais + ambientes + equipe vinculada (memberships) | CRUD; tipo obra/unidade; status | I-sites-crud | — |
| F1.7 ADM-04 Usuários: criar/convidar, papel, vínculos, ativar/inativar | Admin cria worker/foreman; convite por e-mail | — | SMTP |
| F1.8 Storage: buckets privados, policies por `attachment_accessible()`, `MediaUploader` (init/upload/finalize, magic bytes, limites, retry, idempotência, derivadas via sharp, strip EXIF) | Foto do celular sobe, gera thumb, URL assinada só para quem tem acesso | I-upload-mime, T-A17 (parte anexos) | Processamento no worker |
| F1.9 Seed DEMO fictício | `pnpm seed` popula ambiente local | — | — |

**Pronto quando:** admin cadastra empresa, cliente, local, equipe; usuários entram com login individual; foto sobe com segurança; RLS comprovada por teste automatizado.

## F2 — Primeira fatia vertical: chamado de ponta a ponta (G)

Ordem obrigatória do Prompt: **admin abre chamado com foto → atribui → executor relata e envia foto → admin valida → exporta PDF/visualiza histórico**.

| Tarefa | Critério de conclusão | Teste |
|--------|----------------------|-------|
| F2.1 Migração: `service_requests`, `request_assignments`, `request_events`, `request_comments`, `attachment_links`; trigger de numeração; trigger anti-UPDATE direto de status; RPC `request_transition` com todas as transições e pré-condições de 04 §4; auditoria | Testes unitários da máquina de estados (TS) e de integração (RPC) cobrindo cada linha da tabela de transições, inclusive negativas | U-status-machine, I-rls-transitions |
| F2.2 ADM-07 Novo chamado em nome do cliente (origem, canal, solicitante, foto inicial, visível ao cliente, "abrir e já programar") | Chamado nasce `aberta` com número `2026-000001` | T-A1 (parte admin) |
| F2.3 ADM-05 Lista com filtros (status, cliente, local, responsável, período, atrasados) + CSV | CSV concilia com a tela | T-A13 (parte chamados) |
| F2.4 ADM-06 Detalhe: triagem, atribuição, timeline, comentário público/nota interna, validar/devolver/cancelar/reabrir | Cada ação gera evento com autor/hora/motivo; reabertura preserva conclusão | T-A2, T-A3 (parte admin), T-A9 (dados) |
| F2.5 Migração: `work_entries`, `work_entry_participants` (+ idempotência) | — | — |
| F2.6 CMP-01 Hoje, CMP-02 lista, CMP-03 detalhe com ações por status | Worker vê só OS da sua unidade | T-A10 (campo) |
| F2.7 CMP-04 Registrar o que foi feito (work_entry + fotos + evento `atividade`) | Duplo toque = 1 registro | T-A4 (parte), T-A17 |
| F2.8 CMP-06 Concluí (solução + foto resultado → `executada`); bloqueio sem foto/solução no cliente **e** no servidor | T-A2 completo | T-A2 |
| F2.9 CMP-05 Não consegui concluir → `pendente`; CMP-03 Retomar | T-A3 completo | T-A3 |
| F2.10 PDF da OS individual (motor de PDF mínimo: template HTML + worker Playwright + `report_artifacts` + download) | PDF A4 com cabeçalho da empresa, histórico, fotos | — |
| F2.11 E2E Playwright do fluxo completo em viewport mobile | Vídeo/trace do E2E | E-vertical-slice |

**Pronto quando:** o fluxo de ponta a ponta roda em celular e desktop com dados persistidos e permissões reais; PDF da OS baixável.

## F3 — Operação de campo completa (G)

| Tarefa | Critério de conclusão | Teste |
|--------|----------------------|-------|
| F3.1 Migração: `tasks`, `task_assignments`, `task_occurrences`, `task_kinds`; RPC de transição de ocorrência | — | — |
| F3.2 ADM-08 Agenda dia/semana por pessoa/obra; criar tarefa; desdobrar por local; justificar dia sem execução | Tarefa com 2 ocorrências em obras distintas no mesmo dia | T-A6 (admin) |
| F3.3 CMP-02 semana multiobra (foreman), CMP-03 ações em ocorrência (Iniciar/Registrar/Fotos/Impedimento/Finalizar) reutilizando CMP-04/05 | Encarregado registra em cada obra; fotos no local certo | T-A6 |
| F3.4 Atividade avulsa (sem OS/tarefa) a partir de CMP-01 | Entra no diário sem chamado fictício | T-A5 |
| F3.5 `v_daily_log` + ADM-09 Diário por local/período + PDF do diário | OS, tarefa e avulsa aparecem uma vez cada; participantes não multiplicam | T-A4, U-dedupe-count |
| F3.6 ADM-10 Atividades: revisão/ajuste com histórico (envio original preservado) | Diff em auditoria; timeline mostra original | I-audit-trail |
| F3.7 CMP-07 Minhas atividades | — | — |
| F3.8 Migração + CMP-10 Horas do dia (`time_entries`, só jornada por enquanto) (COMP) | — | — |
| F3.9 Notificações internas (tabela `notifications`: atribuição, devolução, pendência) | Badge e lista no app | — |

## F4 — Financeiro interno e orçamentos (G)

| Tarefa | Critério de conclusão | Teste |
|--------|----------------------|-------|
| F4.1 Migração: `expenses`, `expense_allocations` (+ trigger deferido de rateio), `expense_reviews`, `reimbursements` (+ trigger de invalidação), `payment_methods` | Testes SQL: 1.000 = 600 + 400 passa; 600 + 399,99 falha; negativo falha; sem obra falha | T-A7 |
| F4.2 CMP-08 Registrar compra com comprovante e rateio (diferença ao vivo; idempotência) | Duplo toque = 1 despesa | T-A7, T-A17 |
| F4.3 ADM-11 Despesas: filtros, detalhe, aprovar/devolver, comprovante com zoom, CSV; invalidação ao editar aprovada | T-A8 passa | T-A8, T-A13 |
| F4.4 ADM-12 Reembolsos + CMP-09 Minhas compras | Quitação só por admin; independente da conferência | T-A8 |
| F4.5 Migração `billing_rules` + ADM-13 regras de valor por contrato + diárias/ajustes (COMP) | Vigência sem sobreposição; 24 × 333,00 = 7.992,00 em teste | U-billing-rule-vigencia, U-demonstrativo |
| F4.6 Migração `quotes*` + ADM-14 editor (itens global/detalhado, subitens, fotos local/referência, duplicar, status, versões, aceite manual) (COMP) | Total correto; extenso correto | T-A14, U-extenso |
| F4.7 PDF do orçamento A4 (layout inspirado no ORC, dados da configuração) (COMP) | PDF legível com fotos | T-A14 |
| F4.8 "Criar obra a partir de orçamento aprovado" (COMP desejável) | Ação explícita; sem despesa gerada | E-quote-to-site, T-A18 |

## F5 — Relatórios, fechamento mensal e (condicional) portal (G)

### F5.a — Sempre

| Tarefa | Critério de conclusão | Teste |
|--------|----------------------|-------|
| F5.1 `request_status_at()`, classificação do snapshot (módulo `closing` puro em TS + verificação SQL), `monthly_closings`, `closing_versions`, `report_publications` | Chamado aberto em set e concluído em out: pendente no fechamento de set, concluído no de out; reabertura/cancelamento não são "novos" | T-A9, U-status-at |
| F5.2 ADM-15 Fechamento: apurar, pré-visualizar (resumo/detalhado), fechar v1, gerar vN com motivo, listar versões | v1 íntegra após v2 | T-A12 |
| F5.3 **Botão "Exportar PDF"**: template do fechamento (A4, cabeçalho "SETEMBRO / 2026", seções, diário com fotos em grade, demonstrativo opcional, numeração "Página X de Y"), nome `Relatorio_<Cliente>_<Mês>_<Ano>[_Resumo][_vN].pdf`, geração assíncrona com estado | PDF com ≥ 30 páginas e múltiplas fotos por dia sem cortes; nome correto | T-A11, U-file-name, E-pdf-long |
| F5.4 Serializador whitelist do relatório do cliente (sem despesas/comprovantes/fornecedores/reembolsos/notas internas) | Teste que injeta despesa e verifica ausência no payload | T-A10 (parte relatório) |
| F5.5 ADM-16 Relatórios: atividades por pessoa, despesas internas (rateios, comprovantes, reembolsos) + CSV | Totais conciliam | T-A13 |
| F5.6 ADM-01 Dashboard com cards (janela + critério explícitos, drill-down filtrado) | Cada card abre lista com os mesmos números | E-dashboard-drilldown |
| F5.7 Registro de entrega no cenário B (`report_publications.delivery_note`) | Histórico "enviado por WhatsApp em dd/MM" | — |

### F5.b — Somente se o cenário A for confirmado (Q1)

| Tarefa | Critério de conclusão | Teste |
|--------|----------------------|-------|
| F5.8 Papel `client`: convite de contato, `client_contacts.user_id`, `is_client()`, policies e views sanitizadas | Cliente A não lê nada de cliente B por UI, API, URL assinada ou path de storage | T-A10 (cliente) |
| F5.9 CLI-01 Resumo, CLI-02 Abrir chamado (origem `cliente_portal`), CLI-03 Lista/detalhe/comentários, CLI-04 Galeria, CLI-05 Relatórios publicados | T-A1 parte cliente | T-A1 |
| F5.10 Publicar/revogar versão no ADM-15; download pelo cliente | Revogada some do portal; admin continua baixando | T-A12 |

## F6 — Qualidade e entrega (M–G)

| Tarefa | Critério de conclusão |
|--------|----------------------|
| F6.1 Suíte E2E dos 18 testes de aceite (os do cenário A marcados `não executado` se B) com evidências (trace/vídeo) | Checklist com `passou/falhou/não executado` por teste |
| F6.2 Revisão de segurança: IDOR, upload malicioso, headers, rate limit, segredos | Relatório de revisão no repositório |
| F6.3 Backup: scripts `pg_dump` + espelho do storage; `restore-test.sh` executado em ambiente local com evidência; documentar o que depende de credenciais do cliente | T-A16 |
| F6.4 Revisão UX mobile em aparelho real (Android/iOS), rede 3G simulada | Ajustes registrados |
| F6.5 README, `.env.example`, instruções Supabase/deploy, manual rápido por perfil (admin, encarregado, funcionário, cliente se A) | Documentos no repositório |
| F6.6 Dados demo fictícios e ambiente de homologação para o piloto com os 2 funcionários e o encarregado (Word §10) | Acessos entregues |

## Dependências entre fases

```
F0 → F1 → F2 → F3 → F4 → F5.a → F6
                 └──────────────→ F5.b (só com Q1 = A; pode rodar em paralelo a F4 depois de F2)
```

## Estratégia de testes

| Nível | Ferramenta | Cobre |
|-------|-----------|-------|
| Unitário (regras puras) | Vitest | máquina de estados, centavos/rateio/arredondamento, classificação do snapshot, extenso, nome de arquivo, fronteiras de mês em SP, overdue |
| Integração (banco) | Supabase local + Vitest com 3+ clientes autenticados | RLS por papel/escopo, triggers (rateio deferido, invalidação, append-only, numeração), RPCs de transição, storage policies, MIME |
| E2E | Playwright (viewport 360×740 e desktop) | 18 testes de aceite, IDOR, duplo clique, upload com falha simulada, PDF longo |
| Manual assistido | aparelho real | câmera, galeria múltipla, rede instável |

Regras: nenhuma funcionalidade é "pronta" sem o teste do nível correspondente; CI roda unit + integração a cada push; E2E antes de cada entrega de fase.

## Riscos por fase

| Fase | Risco | Mitigação |
|------|-------|-----------|
| F1 | Claim de papel no JWT (hook do Supabase) mal configurada → RLS lenta ou furada | Fallback: `is_admin()` consulta `profiles`; teste de performance em listas |
| F1 | Processamento de imagem (sharp) no Windows/Docker | Rodar no worker Linux (Docker) |
| F2 | Regras de transição duplicadas entre TS e SQL divergirem | Tabela única de transições em TS gera os testes de integração que batem na RPC |
| F3 | Duplicidade OS × tarefa × diário | Invariantes de 04 §2.5 + teste U-dedupe-count |
| F4 | Centavos × UI com máscara | `MoneyInput` só emite inteiros; testes de borda (0,01) |
| F5 | PDF de 35+ páginas lento/instável | Geração assíncrona no worker; fotos em derivada 1600 px; teste E-pdf-long com 150 fotos |
| F5 | Snapshot com fuso errado | Função única `month_cutoff_utc(y, m)` testada com horário de verão inexistente/fronteiras |
| F5.b | Vazamento de dado interno ao cliente | Whitelist explícita + teste que falha se nova coluna sensível aparecer no payload |
| F6 | Backup declarado sem teste | T-A16 só "passou" com restauração executada |
