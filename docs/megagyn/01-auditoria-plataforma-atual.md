# 01 — Auditoria da plataforma atual

> Propósito: registrar, para o desenvolvedor, o que o sistema faz hoje, com evidência no código, e os bugs e riscos antes da evolução V4. Data: 03/11/2026.

Documentos relacionados: `02-matriz-requisitos-T01-T14.md` (requisito por tela), `03-arquitetura-e-modelo-de-dados.md` (migrações M-xx), `04-fluxos-e-permissoes.md` (estados e acesso), `05-backlog-priorizado.md` (itens B-xx), `06-decisoes-pendentes.md` (DP-xx), `07-roteiro-de-testes.md`.

## 1. Como esta auditoria foi feita

- Base: branch `docs/evolucao-v4`, igual à `main` no commit `b1d4f8d`.
- Três auditorias de leitura estática do código (banco e segurança; telas, relatórios e testes; requisitos dos documentos novos do cliente), consolidadas aqui.
- Nenhum teste, build, migração ou servidor foi executado nesta auditoria. Os números de verificação abaixo são da última execução completa conhecida.
- Cada bug tem a coluna "Quem conferiu":
  - **orquestrador**: conferido pessoalmente no código pelo coordenador da auditoria;
  - **redator**: conferido no código durante a redação deste documento (03/11/2026);
  - **auditor de dados** ou **auditor de telas**: apontado pela auditoria correspondente, com `arquivo:linha`, sem segunda conferência.
- Abreviações de migração (valem para os 7 documentos): `0100` = `supabase/migrations/20261025000100_foundation.sql`, `0200` = `…000200_attachments_notifications.sql`, `0300` = `…000300_requests_tasks_work.sql`, `0400` = `…000400_requests_rpc.sql`, `0500` = `…000500_tasks_time_billing.sql`, `0600` = `…000600_expenses.sql`, `0700` = `…000700_quotes.sql`, `0800` = `…000800_closings_reports_storage.sql`, `1000` = `…001000_quote_photos_bucket.sql`, `1100` = `…001100_quote_photos_policies.sql`, `1300` = `…001300_quotes_rpc.sql`, `1400` = `…001400_review_fixes.sql`.

### 1.1 Última verificação conhecida

Execução de 31/10/2026, árvore idêntica à `main` atual (`docs/10-checklist-aceite.md`):

| Verificação | Resultado |
|---|---|
| `npm run lint` e `npm run typecheck` | 0 erros |
| `npm test` (unitários) | 232/232 |
| `npm run test:db` (RLS, RPCs, gatilhos) | 85/85 |
| `npm run build` | OK |
| E2E contra `next start` | 19/19 |
| Backup e restauração em banco descartável | 9/9 contagens; 5.448/5.448 arquivos; com ressalva (T-A16) |

Ninguém rodou testes nesta auditoria. Antes de qualquer mudança, rodar de novo (item B-01 em `05-backlog-priorizado.md`).

## 2. Resumo executivo

**O que a Megagyn pediu.** Dois documentos novos:

- `Descrição do sistema.pdf` (2 páginas): árvore de menus com os campos que o cliente quer. É a base firme (marcada **E·cli**).
- `Descrição do sistema - GPT.pdf` (20 páginas, 02/11/2026): proposta funcional com telas T01–T14, matriz de acesso, fluxos e critérios de aceite CA-1 a CA-10. O próprio caderno diz que obrigatoriedades, situações e automações são **propostas para validação pela Megagyn** (GPT p. 1 e p. 20).

**Como isso se relaciona com o produto atual.** O sistema no ar já cobre o núcleo operacional que os documentos descrevem:

- O.S. com os 7 estados, pendência com motivo e providência, execução com solução e foto, validação e devolução pelo administrador, reabertura com motivo.
- Diário de obra como projeção única dos lançamentos, sem dupla contagem.
- Agenda multiobra, fechamento mensal versionado com snapshot no corte, PDF A4 e CSV.
- Orçamentos com revisões congeladas, despesas com rateio exato e reembolso.

O que falta ou diverge:

- **Ausente:** contratos (T11), ficha de colaborador com dados pessoais (T03), matriz de permissões por módulo e ação (T04), configuração de campos e modelos de texto (T14), resposta estruturada do orçamento e conversão em O.S. (T10), portal do cliente.
- **Divergente:** quem abre O.S., foto inicial obrigatória, pendência sem data, emissão do orçamento, validade vencida. Essas regras vão para decisão (`06-decisoes-pendentes.md`).
- **Defeitos:** 11 itens de gravidade alta ou média (seção 5): 1 risco da evolução (A-01), 9 bugs (A-02 a A-09 e A-11) e 1 lacuna (A-10). Os 9 bugs são corrigidos na Fase 0, antes de qualquer funcionalidade nova.

**O maior risco da evolução** é ligar o acesso do cliente estendendo a função atual de acesso por local (`has_site_access`). Isso exporia dados internos (A-01). O portal precisa de função e políticas próprias, testes de isolamento e revisão antes de ser ligado.

**Hospedagem.** O piloto roda na Vercel Hobby, cujos termos proíbem uso comercial. O plano de operação real sem custo (Oracle Always Free) está pronto no código e pendente de conta (seção 7).

## 3. Stack e estrutura real

### 3.1 Stack (de `package.json`)

| Camada | Tecnologia | Versão |
|---|---|---|
| App | Next.js (App Router, Server Actions), React | 16.4.3, 19.3.1 |
| Banco, Auth, Storage | Supabase (`@supabase/supabase-js`, `@supabase/ssr`) | 2.118.0, 0.12.7 |
| Validação | zod | 4.6.7 |
| Imagens | sharp | 0.35.5 |
| PDF | Playwright/Chromium ou Gotenberg 8 (`PDF_RENDERER`) | playwright 1.64.1 |
| Estilo | Tailwind CSS | 4.3.3 |
| Testes | Vitest (projetos `unit` e `db`), Playwright Test (E2E) | 4.1.12, 1.64.1 |
| Linguagem | TypeScript, Node ≥ 22 (CI usa 24) | 5.9.3 |

Não há biblioteca de `.docx` nem editor de texto rico. Qualquer biblioteca nova precisa de aprovação (ver `03-arquitetura-e-modelo-de-dados.md` §7).

O `AGENTS.md` do repositório avisa que esta versão do Next.js tem mudanças de API. Quem implementar deve ler `node_modules/next/dist/docs/` antes de escrever código.

### 3.2 Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/app/(auth)`, `src/app/auth` | Login, recuperação, redefinição de senha, callback do Supabase |
| `src/app/admin/*` | Telas da administração (painel, chamados, agenda, diário, atividades, despesas, reembolsos, horas, orçamentos, fechamentos, relatórios, clientes, locais, usuários, configurações, auditoria, notificações) |
| `src/app/campo/*` | Telas do celular para funcionário e encarregado (Hoje, chamados, tarefas, registrar, atividades, horas, compras, notificações) |
| `src/app/api/*` | Upload, entrega de arquivo, CSV, PDFs, fila de PDFs, saúde |
| `src/server/*` | Server Actions, consultas, geração de relatórios, cliente Supabase |
| `src/domain/*` | Regras puras com testes unitários (estados, datas, dinheiro, CSV, nomes de arquivo, orçamento, fechamento) |
| `src/ui/*` | Componentes (formulário, envio de fotos, grade de fotos, navegação) |
| `src/reports/*` | Templates HTML dos PDFs |
| `supabase/migrations/` | 13 migrações, de `0100` a `1400` |
| `tests/db/` | Testes de banco (RLS, RPCs, gatilhos) |
| `tests/e2e/` | Testes ponta a ponta com Playwright |
| `scripts/` | `backup.ts`, `backup-files.ts`, `restore-test.ts`, `seed-demo.ts` |
| `.github/workflows/` | `ci.yml` (lint, typecheck, unitários e build em todo push), `backup.yml` (desligado), `despertador.yml` |

Testes de banco e E2E não rodam no CI. Precisam do Supabase local (comentário em `.github/workflows/ci.yml:1-3`).

### 3.3 Princípios já aplicados no código

- RLS ligada em todas as tabelas públicas (teste "todas as tabelas públicas têm RLS ligada").
- O papel é lido de `profiles.is_active` a cada chamada (`0100:67-70`). Usuário desativado perde acesso aos dados mesmo com sessão aberta.
- Escritas sensíveis passam por RPC `security definer` com `search_path=''`.
- A situação da O.S. só muda por RPC: o gatilho `guard_request_status` barra update direto (`0300:64-74`; teste "a situação não muda por atualização direta na tabela").
- Eventos de O.S., versões de orçamento e de fechamento e trilha de despesas são imutáveis por gatilho.
- Buckets privados, sem política de Storage: os bytes só saem pelo servidor (`0800:191-200`).
- Upload valida a assinatura binária, reprocessa a imagem sem EXIF e é idempotente por `client_upload_id` (`src/app/api/uploads/route.ts:25-166`).
- Idempotência por `client_request_id` em O.S., lançamentos, tarefas, despesas e comentários.

## 4. Inventário por módulo

Status: **Pronto** (tela + persistência real + teste), **Parcial** (existe, falta parte do que o V4 pede), **Ausente**, **Quebrado** (existe e falha num cenário descrito), **Não verificável** (depende de execução ou ambiente).

| Módulo | O que funciona de verdade | Evidência de backend | Teste | Status |
|---|---|---|---|---|
| Login e recuperação | E-mail e senha; convite por e-mail; "Esqueci minha senha"; senha provisória; cadastro aberto desligado | `supabase/config.toml:178` (`enable_signup = false`); `src/server/actions/registry.ts:363-389`, `:439-451` | `tests/e2e/convite.spec.ts:29` | Pronto (envio real de e-mail depende do SMTP, pendente) |
| Bloqueio de usuário | Desativar marca `is_active=false` e bane no Auth; o proxy redireciona `user_banned` | `0100:67-70`; `registry.ts:415-424`; `src/proxy.ts:30-36` | `tests/db/requests.test.ts:320` "perde acesso sem apagar autorias"; `tests/db/review-fixes.test.ts:245`; `tests/e2e/cadastros.spec.ts:153` | Pronto nos dados; Parcial na sessão (A-28) |
| Clientes e contatos | PF/PJ, razão social, nome de exibição, CPF/CNPJ com dígito verificador (só na aplicação), endereço em texto, contatos sem login, anonimização | `0100:121-156`; `src/domain/registry.ts:46-62` | `tests/e2e/cadastros.spec.ts:52`, `:163`; `src/domain/registry.test.ts` | Parcial (A-17; sem documentos, fotos e usuários do cliente) |
| Locais e setores | Obra temporária ou unidade recorrente; ativa, pausada ou encerrada; endereço; setores; equipe com acesso por período | `0100:158-211`; FK composta `(site_id, client_id)` em O.S. (`0300:52`) | `tests/e2e/cadastros.spec.ts:52`; `tests/e2e/campo.spec.ts:125` | Parcial (sem orientações de acesso e responsável) |
| Usuários e papéis | 4 papéis fixos (`admin`, `worker`, `foreman`, `client`); vínculo pessoa × local | `0100:14`; `src/domain/registry.ts:25`, `:280-282` | `tests/e2e/cadastros.spec.ts:52` | Parcial (sem matriz configurável; `client` não entra) |
| Colaboradores | Colaborador é o próprio usuário (`profiles`: nome, e-mail, telefone, papel) | `0100:51-63` | `tests/db/requests.test.ts:320` | Parcial mínimo (sem CPF, RG, endereço, foto, documentos) |
| Abertura de O.S. | Só administração; número `AAAA-NNNNNN`; origem, canal e solicitante; foto inicial opcional; programação opcional | `0400:204-293` | `tests/db/requests.test.ts:66`, `:83` "clique duplo com o mesmo identificador não cria outro chamado (T-A17)", `:92`, `:102` "equipe de campo não abre chamado (somente atividade avulsa)" | Pronto para o escopo atual; diverge do V4 (A-29) |
| Execução da O.S. | Programar, iniciar, registrar, pendência com 5 campos, "Concluí" com solução e foto, validar, devolver, cancelar e reabrir com motivo | `0400:298-764`; `1400:363-423` | `tests/db/requests.test.ts:115`, `:182`, `:209`, `:254`, `:273`; `tests/e2e/vertical-slice.spec.ts:8`; `tests/e2e/campo.spec.ts:51` | Pronto (com A-06 e A-19) |
| Atividades e diário | `work_entries` como fonte única; data da atividade separada da data de envio; avulsa sem O.S.; diário por local e período; PDF interno e para o cliente | `0300:179-222`; `0400:458-552`; `src/server/daily-log.ts:43-160` | `tests/db/work-and-tasks.test.ts:24`, `:73`, `:96`, `:108`; `src/domain/daily-log.test.ts:38`, `:45` | Parcial (A-10; sem CSV) |
| Tarefas e agenda | Tarefa com ocorrências por local; agenda dia e semana; iniciar, finalizar, não realizada, remarcar, cancelar | `0300:123-174`; `0500:6-262` | `tests/db/work-and-tasks.test.ts:108`; `tests/e2e/campo.spec.ts:7`; `tests/e2e/agenda.spec.ts:7` | Quebrado em um cenário (A-05); Parcial (A-14) |
| Fotos e anexos | Câmera e galeria; reenvio sem duplicar; versão de 1600 px sem EXIF; remoção de foto com motivo pela administração | `src/app/api/uploads/route.ts`; `0400:827-851`; `1400:21-70` | `tests/db/attachment-revoke.test.ts` (5 casos, inclusive "funcionário não remove foto"); `tests/e2e/fotos.spec.ts:7`; `tests/e2e/alvos-toque.spec.ts:26` | Parcial (A-02, A-06, A-15) |
| Painel (admin) | 13 cartões com janela e regra; números paginados acima de 1.000 | `src/server/dashboard.ts:11-62` | `tests/e2e/painel.spec.ts:7` (6 cartões de chamados); `tests/db/dashboard.test.ts:34` | Parcial (A-11; sem painel por perfil) |
| Lista de O.S. e CSV | Filtros por situação, cliente, local, responsável, motivo, período de abertura, número e atraso; CSV com a mesma consulta, BOM, `;`, neutralização de fórmula | `src/server/request-list.ts:27-83`; `src/app/api/csv/chamados/route.ts`; `src/domain/csv.ts:11-19` | `src/domain/csv.test.ts`; `tests/e2e/campo.spec.ts:120` (403 para funcionário) | Parcial (só data de abertura; sem PDF da lista) |
| Fechamento mensal | Prévia, v1 imutável, v2 com motivo, snapshot pelos eventos até o corte, conjuntos que se sobrepõem, resumo e detalhado, nome com mês por extenso, registro de entrega | `0800:4-189`; `src/domain/closing.ts`; `src/server/closings.ts:133-352`; `src/domain/report-naming.ts:35-42` | `tests/db/closings.test.ts:119`, `:150`, `:161`; `tests/db/pdf-long.test.ts:96`; `tests/e2e/fechamento.spec.ts:6`; `src/domain/report-naming.test.ts:5` | Pronto |
| PDFs | 7 tipos (O.S., diário, atividades por pessoa, fechamento detalhado e resumo, despesas, orçamento); fila com tentativas e retomada | `src/server/reports/builders.ts:9-17`; `src/server/reports/queue.ts:20-50` | `tests/db/report-queue.test.ts`; `tests/db/pdf-long.test.ts:96` | Pronto (A-23; sem snapshot fora do fechamento) |
| Orçamentos | Número `ORC-AAAA-NNNN`; itens por ambiente, valor global ou detalhado; rascunho, enviado, aprovado, recusado, vencido, cancelado; revisões congeladas; duplicar; fotos em 2 seções; criar obra | `0700:3-110`; `1300:28-272` | `tests/db/quotes.test.ts:62`, `:97`, `:167`, `:202`, `:240`, `:272`, `:288`; `tests/e2e/orcamentos.spec.ts:9` | Parcial (A-03, A-07, A-13, A-16) |
| Contratos | Nada | Nenhuma tabela, rota ou template | — | Ausente |
| Configurações | Dados da empresa, logo, assinatura, textos padrão, limites, 7 catálogos com ativar e desativar | `0100:87-116`; `registry.ts:471-514` | `tests/e2e/cadastros.spec.ts:163` | Parcial (A-15; sem modelos, rótulos, obrigatoriedade) |
| Despesas, rateio e reembolso | Compra com rateio exato (soma = total), conferência, invalidação após edição, reembolso separado | `0600:9-161`; `1400:137-272` | `tests/db/expenses.test.ts:43`, `:63`, `:88`; `tests/e2e/despesas.spec.ts:21`; `tests/db/purchases.test.ts` | Pronto (A-08, A-22) |
| Horas e diárias | Jornada por pessoa e dia; diárias faturáveis; regras de valor com vigência; demonstrativo no fechamento | `0500:267-390`; `src/server/closings.ts:273-300` | `tests/db/closing-billing-volume.test.ts` | Pronto |
| Auditoria | `audit_events` imutável, com gatilhos nas tabelas principais; tela de consulta | `0100:344-408` | — (sem teste da trilha; `docs/14` lista como fora) | Parcial (A-09) |
| Notificações | Tabela interna, sem e-mail nem push | `0200:51-61` | — | Pronto para o escopo atual |
| Portal do cliente | Nada: o papel `client` cai em `/acesso-negado` | `src/server/auth.ts:47-51`; `0100:226` | — | Ausente (seguro por omissão) |
| Backup e restauração | `npm run backup` (pg_dump + arquivos com SHA-256) e `npm run restore:test` em base descartável; workflow diário cifrado no Google Drive | `scripts/backup.ts`, `scripts/restore-test.ts`, `.github/workflows/backup.yml` | `tests/db/backup-files.test.ts`; execução manual em 31/10/2026 | Parcial (workflow desligado; ver §7) |

## 5. Bugs e riscos consolidados

Lista deduplicada das três auditorias. As auditorias usavam ids próprios (B1–B18 e B1–B8, com números repetidos para coisas diferentes); a coluna "Origem" faz a ponte. Gravidade: **Alta**, **Média**, **Baixa**, **Informativo**. A correção de cada item está em `05-backlog-priorizado.md`.

| Id | Gravidade | Problema | Cenário concreto | Evidência | Quem conferiu | Origem | Correção |
|---|---|---|---|---|---|---|---|
| A-01 | Alta (risco da evolução) | Ligar o papel `client` só estendendo `has_site_access` expõe dados internos | O cliente da Unidade Centro passaria a ler comentários e eventos internos, horas de cada funcionário, quem tem vínculo com o local, anotações internas e de cobrança do cliente, fotos removidas e lançamentos "não visíveis ao cliente". PDFs são gerados com `service_role`, sem RLS | `0100:215-229` (função); `1400:438-444` (anexos sem filtro de `visibility` e `revoked_at`); `0100:441-444` (linha inteira de `clients`); `src/server/reports/jobs.ts:15`, `:34` | redator (função e política de anexos); auditor de dados (restante) | dados B7 | Fase 6: B-65 a B-71, M-26 |
| A-02 | Média (Alta se o cliente tiver acesso) | Foto removida continua acessível por link direto | A administração remove uma foto com dado pessoal de terceiro; quem tem acesso ao local ainda abre `/api/files/<id>`, e as telas do campo mostram a foto esmaecida | `src/app/api/files/[id]/route.ts:25-30` (sem `revoked_at`); `1400:438-444`; `src/server/data.ts:155-170` | orquestrador (rota); redator (política) | dados B5 | B-03, M-01 |
| A-03 | Média | A aprovação do orçamento recongela os dados atuais em vez de aprovar a revisão enviada | Enviar v1, corrigir o endereço do cliente ou os dados da empresa, registrar aprovação: nasce v2 com dados novos, e "Gerar PDF" mostra v2, não o que o cliente aprovou. Logo e assinatura saem sempre das configurações atuais | `src/server/actions/quotes.ts:182` (`FREEZES` inclui `"aprovar"`), `:199-203`; `src/app/admin/orcamentos/data.ts:25-65`; `src/server/reports/builders/quote.ts:33-41`, `:62` | orquestrador | telas B6 | B-04, M-03 |
| A-04 | Média | O campo busca 100 chamados antes de filtrar os atribuídos à pessoa | Unidade recorrente com mais de 100 chamados ativos visíveis: um chamado atribuído ao funcionário fora dos 100 primeiros some de "Hoje" e de "Chamados", sem aviso | `src/app/campo/page.tsx:25-44`; `src/app/campo/chamados/page.tsx:34`, `:38` | orquestrador (`page.tsx`); redator (`chamados/page.tsx`) | telas B2 | B-05 |
| A-05 | Média, Quebrado | A tarefa fica "cancelada" para sempre quando todas as ocorrências viram "não realizada" | Tarefa com 1 local, "Não foi realizada" → a tarefa vira cancelada. O admin remarca, a ocorrência volta a prevista, mas a tarefa continua cancelada, e acrescentar local responde "Tarefa não encontrada" | `0500:20-23` (o ramo `when status = 'cancelada'` prende o estado; todas terminais sem conclusão viram cancelada); `0500:134`, `:222-243`. O teste atual usa 2 ocorrências (`tests/db/work-and-tasks.test.ts:177-179`) | redator | dados B1 | B-06, M-02 |
| A-06 | Média | Foto com falha não bloqueia o envio; o registro sai sem ela | No 3G, 1 de 3 fotos fica com "Tentar de novo"; o funcionário toca "Salvar registro"; o lançamento é gravado com 2 fotos. A falha aparece na lista e o texto mostra "2 de 3 recebido(s)", mas nada impede o envio. Em "Concluí", se todas as fotos de resultado falharem, o servidor recusa | `src/ui/media-uploader.tsx:77` (ocupado só com "enviando"), `:221-223` (só fotos concluídas entram no formulário); `src/ui/form.tsx:99` | orquestrador | telas B3 | B-07 |
| A-07 | Média | Criação de orçamento sem idempotência; edição concorrente duplica itens | (a) Reenvio após timeout cria outro orçamento com outro número. (b) Dois salvamentos simultâneos do mesmo rascunho leem os mesmos itens antigos, inserem os seus e apagam só os antigos: itens duplicados e total dobrado | `src/server/actions/quotes.ts:103-117`, `:123-139` | redator | dados B3 | B-08, M-06 |
| A-08 | Média | Pagamento de reembolso pode ser registrado duas vezes | O admin registra R$ 250,00, a resposta se perde, ele toca de novo: dois pagamentos (limitados ao saldo), num texto acumulado sem linha própria para estornar | `0600:446-474`; `src/server/actions/expenses.ts:143-164` | auditor de dados | dados B2 | B-09, M-04 |
| A-09 | Média | Trilha incompleta das ações administrativas | Não dá para provar no banco quem criou um usuário (o perfil é inserido com `service_role` e `actor_id` fica nulo), quem trocou a senha de outro ou quem tirou o acesso de um responsável do cliente a uma unidade (vínculo apagado sem gatilho) | `src/server/actions/registry.ts:378`, `:424`, `:461-463`, `:152-155`; `0100:451-452` | auditor de dados | dados B6 | B-10, M-05 |
| A-10 | Média (lacuna) | Pendência registrada não aparece no diário | "Não consegui concluir" muda a situação e grava evento, mas não cria lançamento; o diário e o PDF do dia não mostram a pendência | `0400:554-613` (nenhuma inserção em `work_entries`) | redator | telas B8 | B-45 |
| A-11 | Média | Cartões do painel abrem listas com número diferente | "Pendências por responsável" mostra o número de responsáveis distintos (5 pendências, 2 responsáveis: cartão "2", lista "5"). "Tarefas de hoje" ignora o cliente e o link não leva a pessoa. "Atividades registradas" não leva o cliente. Despesas e orçamentos abrem sem filtro | `src/app/admin/page.tsx:209`, `:219`, `:234`; `src/server/dashboard.ts:23-31`, `:44-53` | redator (`page.tsx`); auditor de telas (`dashboard.ts`) | telas B1 | B-11 |
| A-12 | Baixa/Média | Desativar colaborador não trata pendências | Atribuições em O.S. e tarefas e vínculos de local ficam abertos; notificações continuam indo para a pessoa; "Reprogramar" com o mesmo grupo passa a falhar | `registry.ts:407-437`; `0400:328-332` | auditor de dados | dados B15 | B-20, M-13 |
| A-13 | Baixa/Média | "Criar obra a partir do orçamento" duplica em concorrência | Duas requisições simultâneas passam pela checagem de existência e criam duas obras para o mesmo orçamento | `src/server/actions/quotes.ts:274-289`; `0700:112` (FK sem UNIQUE) | auditor de dados; auditor de telas | dados B4 | B-12, M-07 |
| A-14 | Baixa | Finalizar tarefa não registra resultado | O formulário "Finalizar neste local" só envia `occurrence_id`; a ação lê `notes`, que nunca chega; a "Observação de encerramento" fica sempre vazia | `src/app/campo/tarefas/[id]/page.tsx:80-82`; `src/server/actions/tasks.ts:103-114` | redator | telas B4 | B-38, M-18 |
| A-15 | Baixa | "Arquivos por envio" nas Configurações não tem efeito | O admin muda para 5; o campo continua aceitando 20 | `src/ui/media-uploader.tsx:56` (`max = 20` fixo); `max_files_per_upload` só aparece na tela e no parser | redator | telas B5 | B-31 |
| A-16 | Baixa | O orçamento não tem guarda de situação | Um admin, pela API, muda `status` de aprovado para rascunho, edita o conteúdo e o orçamento "aprovado" muda sem nova versão | `1300:49-75` (protege conteúdo, não situação); `0700:106` | auditor de dados | dados B8 | B-04, M-03 |
| A-17 | Baixa | CPF/CNPJ sem unicidade nem CHECK no banco; gravado formatado | Dois clientes com o mesmo CNPJ são aceitos | `0100:126`; `src/domain/registry.ts:137-142` | auditor de dados | dados B9 | B-17, M-08 |
| A-18 | Baixa | Falta garantia de "local pertence ao cliente" em orçamento, fechamento e cobrança | Pela API, um orçamento ou regra de cobrança aponta para o local de outro cliente; emitir fechamento com local de outro cliente cria a linha antes do erro e deixa um registro órfão | `0700:6-8`; `0800:6-7`; `0500:362-363`; `src/server/actions/closings.ts:28-58`; `src/server/closings.ts:146`; `src/server/actions/time.ts:53-63` | auditor de dados | dados B10 | B-22, M-09 |
| A-19 | Baixa | "Reprogramar" muda prazo e prioridade sem motivo | "Editar" exige motivo para a mesma mudança | `0400:346-351` × `0400:421-423` | auditor de dados | dados B11 | B-34 |
| A-20 | Baixa | Campo `base` vai sem saneamento para `redirect()` | Valor como `//site-externo` redireciona para fora. Só a própria pessoa dispara, mas foge do padrão `safeRedirectPath` (`src/domain/safe-redirect.ts`) | `src/server/actions/requests.ts:286`, `:307`; `src/server/actions/tasks.ts:89-90` | redator (`requests.ts`) | dados B12 | B-13 |
| A-21 | Baixa | Falha ao salvar legenda é ignorada | A legenda não grava e a tela mostra "salvo" | `src/server/actions/requests.ts:22-25`; `src/server/actions/quotes.ts:159-160`; `src/server/actions/expenses.ts:51-54` | redator (`quotes.ts`); auditor de dados | dados B13 | B-32 |
| A-22 | Baixa | O encarregado pode ligar uma compra a O.S. ou ocorrência de local sem acesso | Só a FK é conferida | `1400:113-114`, `:188`, `:213` | auditor de dados | dados B14 | B-14 |
| A-23 | Baixa | Duplo clique gera PDFs ou versões de fechamento repetidos | Reenvio de "Emitir nova versão" com motivo após timeout cria vN e vN+1 iguais | `src/server/actions/reports.ts:59-71`; `0800:111-144`; `src/server/actions/closings.ts:17-72` | auditor de dados; auditor de telas | dados B16 | B-48, M-20 |
| A-24 | Baixa (privacidade) | Qualquer pessoa da equipe lê e-mail e telefone de toda a equipe e os campos internos dos clientes dos seus locais | Pela API, com o próprio login. A RLS é a fronteira real. Fica pior se CPF, RG e endereço entrarem em `profiles` | `0100:431-432`, `:441-444`; `src/server/data.ts:17-21` | redator | dados B18 | B-16 |
| A-25 | Baixa | Sem aviso de versão desatualizada | A coluna `version` da O.S. é incrementada e nunca comparada; clientes, locais e orçamentos não têm trava. O GPT p. 19 pede aviso | `0400:91`, `:368-438` | auditor de dados | dados §2.1 | B-26, M-15 |
| A-26 | Baixa | Reabrir zera `closed_at` | A conclusão anterior fica só no evento; lista e CSV mostram "Encerrado em" vazio | `0400:92` | auditor de telas | telas (riscos menores) | B-49 |
| A-27 | Baixa | O fechamento filtra `is_internal` pelo valor atual, não pelo valor no corte | O.S. marcada como interna depois do mês muda a reexportação | `src/server/closings.ts:158` | auditor de telas | telas (riscos menores) | B-49 |
| A-28 | Baixa | Bloqueio de usuário: anexo já aberto fica no cache do navegador até 1 h; sem teste de anexo após bloqueio | Os dados ficam protegidos (`is_active` a cada chamada), mas o arquivo visto antes continua no cache. O token de sessão vale até 1 h | `src/app/api/files/[id]/route.ts:51` (`private, max-age=3600`); `supabase/config.toml:166` | redator (rota) | dados §4; telas (riscos menores) | B-03 |
| A-29 | Informativo | Regras atuais divergem do caderno GPT | Abertura só pela administração; foto inicial opcional; pendência sempre com data; orçamento vencido não aprova; emissão exige item e não exige pagamento, garantia e período; equipe registra em qualquer O.S. do local | `0400:228`, `:593-598`; `1300:159-180`; `docs/11-revisao-seguranca.md:57` | auditor de dados; redator (`0400:593-598`) | dados B17; telas B7 | DP-02, DP-06, DP-07, DP-08, DP-09, DP-21 |
| A-30 | Informativo | `docs/04-modelo-dados.md` diverge do código | Diz que `version` é trava otimista (`:88`); cita CHECKs que não existem (`:112`), `hidden_at` em comentários (`:98`) e `client_request_id` em `time_entries` (`:129`) | `docs/04-modelo-dados.md` | auditor de dados | dados §5 | B-15 |
| A-31 | Informativo | Base local com 110 anexos sem arquivo, resíduo de testes antigos | Atrapalha a conferência "todo anexo tem arquivo" do teste de restauração | `docs/10-checklist-aceite.md` (T-A16) | auditor de telas | docs/10 | B-02 (o `db:reset` é do usuário) |

Totais: 1 Alta, 10 Média (A-02 a A-11), 2 Baixa/Média, 15 Baixa, 3 Informativo.

### 5.1 Pontos em que esta consolidação ajustou as auditorias

- **A-06:** a auditoria de telas dizia que a foto que falhou "é descartada sem aviso". O orquestrador conferiu que ela aparece como falha na lista; o problema é não bloquear o envio. A descrição foi corrigida.
- **A-10:** classificado como lacuna funcional de gravidade média, não como bug. Vai para a Fase 3 (diário), não para a Fase 0.
- **Ids repetidos:** "B6" era a trilha administrativa numa auditoria e a aprovação do orçamento na outra. Aqui são A-09 e A-03.

## 6. Segurança

### 6.1 O que é sólido

| Ponto | Evidência |
|---|---|
| Isolamento por local para a equipe | `has_site_access` (`0100:215-229`) em todas as políticas operacionais; teste "funcionário de outro local não vê o chamado, os eventos nem a foto"; E2E `tests/e2e/campo.spec.ts:92` (404 no chamado e na foto de outra torre) |
| Desativação efetiva nos dados | `current_app_role` filtra `is_active` a cada chamada (`0100:67-70`) |
| Escrita só por RPC nas tabelas críticas | O.S., lançamentos, tarefas e despesas sem política de escrita direta |
| Arquivos privados | Buckets `public=false`, sem política em `storage.objects`; a rota de arquivo lê a linha com a RLS do usuário e responde 404 sem distinguir de inexistente |
| Upload | Tamanho antes de ler o corpo; tipo pela assinatura binária; imagem reprocessada; remove o que gravou se falhar |
| CSV | Só administração; mesma consulta da tela com RLS; neutraliza fórmula (`src/domain/csv.ts:11-19`) |
| Fila de PDF | Rota protegida por `CRON_SECRET` com comparação em tempo constante (`src/app/api/jobs/reports/route.ts:13-28`) |
| Segredos | `service_role` só no servidor (`src/server/supabase/admin.ts`); `.env*` fora do git |
| Navegador | Cookies `HttpOnly`, `SameSite=Lax`, `Secure` com https; CSP sem origens externas; anexos com CSP `sandbox` (`docs/08-operacao.md` §2) |

### 6.2 O que falta

| Ponto | Situação | Item |
|---|---|---|
| Foto removida acessível | A-02 | B-03 |
| Anexo em cache após bloqueio | A-28 | B-03 |
| Dados pessoais de colaborador privados | Campos não existem; `profiles` é lido por toda a equipe | B-16, B-19 |
| Matriz de permissões por módulo e ação | Ausente; regras fixas em RPC e políticas | B-24 |
| Trilha de ações administrativas | A-09 | B-10 |
| Idempotência | Ausente em orçamento, pagamento de reembolso, obra a partir de orçamento, versão de fechamento, pedido de PDF e cadastros | B-08, B-09, B-12, B-48 |
| Aviso de versão desatualizada | A-25 | B-26 |
| Constraints | CPF/CNPJ (A-17); local × cliente fora das O.S. (A-18); CHECKs de anexo criados `NOT VALID` (linhas antigas não conferidas, `1400:5-17`) | B-17, B-22 |
| Limite de requisições no app | Só os limites do Supabase Auth; recomendação de limite por IP no proxy (`docs/11-revisao-seguranca.md:52`) | Fora do V4; avaliar no proxy da Oracle (B-78) |
| Dois fatores para administração | Ausente (`docs/11-revisao-seguranca.md:58`) | Fora do V4 |

### 6.3 Risco do papel `client`

O papel existe no enum (`0100:14`) e não tem nenhum acesso: `has_site_access` devolve `false` (`0100:226`), `is_staff` o exclui (`0100:78-81`), `require_staff` recusa (`0400:19-21`), o upload recusa (`src/app/api/uploads/route.ts:32`) e `homeFor('client')` leva a `/acesso-negado` (`src/server/auth.ts:47-51`). Hoje isso é seguro por omissão.

O caminho de dados já existe: `client_contacts.user_id` e `client_contact_sites` (`can_open_requests`, `can_view_reports`).

**Não estender `has_site_access`.** Essa função alimenta cerca de 12 políticas que não filtram `is_internal`, `client_visible`, `visibility` nem `revoked_at`, e que devolvem linhas inteiras com colunas internas (`clients.notes_internal`, `billing_info`, `sites.notes_internal`, `work_entries.hours_worked`, `submitted_payload`). Além disso, os PDFs são gerados com `service_role`; a autorização acontece só no pedido.

O desenho seguro (função separada, políticas só de leitura, views sem colunas internas, PDFs com autorização no pedido, testes de isolamento) está em `03-arquitetura-e-modelo-de-dados.md` §6.

## 7. Operação e hospedagem

Estado de 03/11/2026 (`docs/13-plano-implantacao-piloto.md`, `docs/14-plano-entrega-custo-zero.md`, `docs/08-operacao.md`):

| Componente | Hoje | Limite ou risco | Plano |
|---|---|---|---|
| App | Vercel Hobby, deploy automático a cada merge na `main` | Termos do plano proíbem uso comercial; corpo de requisição até 4,5 MB (PDF de comprovante limitado a 4 MB); cron só diário | Oracle Always Free com Docker Compose e Caddy (`docker-compose.prod.yml`, `deploy/Caddyfile` prontos); pendente de conta (plano 14, Fase C) |
| PDF | Gotenberg no Render Free | Dorme após 15 min sem uso (o monitor mantém acordado); 512 MB; a senha do serviço está desligada (pausada pelo usuário em 03/11/2026) | Na Oracle, Chromium dentro da imagem e o Gotenberg sai |
| Banco e arquivos | Supabase Free, região sa-east-1 | Sem backup automático; pausa após 7 dias sem atividade; 500 MB de banco e 1 GB de arquivos | Continua no Free; monitorar espaço |
| Backup | `npm run backup` e `restore:test` testados localmente em 31/10/2026; workflow diário cifrado no Google Drive pronto | Workflow desligado até cadastrar os segredos e `BACKUP_ENABLED` | B-76 |
| E-mail | SMTP próprio ausente | Convite e recuperação só chegam à equipe do Supabase | Brevo (pendente de conta); B-75 |
| Monitor | UptimeRobot em `/api/health` a cada 5 min; `despertador.yml` diário de reserva | Agendamentos do GitHub param após 60 dias sem commit | — |
| Homologação | Um único projeto Supabase na nuvem | Migração de risco testada só no banco local | B-79 |

Consequências para a evolução:

- Todo merge na `main` publica na Vercel. Migrações precisam ser compatíveis com o app anterior e aplicadas à mão, com OK do usuário (`03-arquitetura-e-modelo-de-dados.md` §9).
- Uso comercial real exige trocar de hospedagem antes. Isso entra como decisão em `06-decisoes-pendentes.md` (DP-16).

## 8. O que não foi verificável

| Item | Por quê |
|---|---|
| Resultado atual de lint, typecheck, testes, build e E2E | Nenhum comando foi executado nesta auditoria; vale a execução de 31/10/2026 |
| Configuração do Supabase de produção (Auth, sessões, limites, SMTP, buckets e políticas aplicadas, `max_rows`) | Fora do repositório; não se lê `.env*` |
| Variáveis da Vercel e do Render, inclusive se os deploys de pré-visualização da Vercel apontam para o banco de produção | Painéis externos |
| Backup e restauração reais na nuvem | Workflow desligado |
| Comportamento do Auth com usuário banido e token ainda válido em cada endpoint | Inferido da documentação; os dados ficam protegidos pela checagem de `is_active` |
| Aparência dos PDFs, impressão A4 das telas, tela de 360 px | Exige execução e inspeção visual |
| Câmera e envio em aparelho real e rede real | Medições anteriores foram em emulador (`docs/12-revisao-ux-mobile.md`) |
| Se o formulário de O.S. filtra locais pelo cliente escolhido (GPT p. 9) | Não conferido nas auditorias; fica para B-23 |
| Conteúdo dos documentos antigos (Word de 23/10, relatório de setembro, orçamento) | Não relidos nesta auditoria; valem os resumos de `docs/02` |
