# 02 — Matriz de requisitos T01–T14

> Propósito: ligar cada requisito dos documentos novos da Megagyn ao que existe hoje, à lacuna, à prioridade e ao teste de aceite. Data: 03/11/2026.

Base de evidências: `01-auditoria-plataforma-atual.md`. Itens de backlog: `05-backlog-priorizado.md`. Decisões: `06-decisoes-pendentes.md`. Testes: `07-roteiro-de-testes.md`.

## 1. Convenções

**Fontes**

| Abreviação | Documento |
|---|---|
| `Descrição p. N` | `Descrição do sistema.pdf` (2 páginas). Base firme do cliente |
| `GPT p. N` | `Descrição do sistema - GPT.pdf` (20 páginas, 02/11/2026) |
| `docs/02 R-xx` | Requisitos anteriores, rastreados a partir do Word de 23/10/2026 (`docs/02-requisitos-rastreabilidade.md`) |
| `V4 (seção)` | Pedido do desenvolvedor para esta evolução (Prompt Mestre V4, 03/11/2026). Seções citadas pelo nome: Divergências, Telas, Entidades mínimas, Fluxos, Segurança; os cenários de aceite são `V4 §9` |

**Marcas**

| Marca | Significado |
|---|---|
| E·cli | Exigência expressa do cliente (`Descrição`) |
| E·gpt | Afirmação imperativa do caderno GPT ("deve", "terá", "não pode"), fora das colunas de regra proposta |
| P | Proposta do caderno GPT (coluna "Regra proposta", "melhoria proposta", modelos visuais) |
| Téc. | Melhoria técnica sugerida pelo desenvolvedor |

Ressalva do próprio caderno (GPT p. 1 e p. 20): obrigatoriedades, situações e automações são propostas para validação pela Megagyn. Mesmo E·gpt não é decisão aprovada. A base firme é a `Descrição`.

**Situação atual:** Pronto, Parcial, Ausente, Quebrado, Diverge (existe com regra diferente), Não verificado.

**Prioridade**

| Prioridade | Critério |
|---|---|
| Alta | Campo E·cli ausente, regra de segurança ou de integridade, ou bloqueia outra tela |
| Média | E·gpt de funcionamento, ou P que muda o fluxo principal |
| Baixa | P de conveniência, modelo visual ou melhoria técnica |

Colunas das tabelas: Fonte · Requisito · Marca · Situação atual (tela ou rota) · Backend ou entidade · Lacuna · Prioridade · Aceite ou teste.

## 2. Regras comuns (GPT p. 4 e p. 19)

| Fonte | Requisito | Marca | Situação atual | Backend | Lacuna | Prior. | Aceite / teste |
|---|---|---|---|---|---|---|---|
| GPT p. 4 | Login individual com e-mail e senha, "Esqueci minha senha", aviso claro de falha | E·gpt | Pronto: `/login`, `/recuperar-acesso`, `/redefinir-senha` | Supabase Auth; `registry.ts:439-451` | SMTP próprio pendente (B-75) | Alta | `tests/e2e/convite.spec.ts:29` |
| GPT p. 4 | Usuário bloqueado não continua por sessão antiga | E·gpt | Pronto nos dados; anexo fica no cache até 1 h | `0100:67-70`; `src/proxy.ts:30-36` | A-28 | Alta | Cenário 22; teste novo de `/api/files` após bloqueio |
| GPT p. 4 | Histórico de criação, situação, responsáveis, prazos e emissão com autor e data/hora | E·gpt | Parcial: eventos da O.S. e `audit_events` | `request_events`; `audit_events` | Ações do Auth, vínculos do cliente e atribuições sem trilha (A-09) | Alta | `tests/db/audit-trail.test.ts` (novo) |
| GPT p. 4 | Asterisco nos obrigatórios; datas dd/mm/aaaa; valores em R$ | E·gpt | Pronto na exibição; campos de data dependem do idioma do navegador | `src/domain/dates.ts`; `src/domain/money.ts` | Conferir asterisco em todos os formulários | Média | `src/domain/dates.test.ts:43`; `money.test.ts:31`; inspeção manual |
| GPT p. 4 | Mostrar limites de tipo, quantidade e tamanho antes do envio; confirmar cada envio; preservar o formulário; tentar de novo sem duplicar | E·gpt | Parcial: estado por foto e reenvio sem duplicar | `src/app/api/uploads/route.ts:56-62`; `src/ui/form.tsx:78-91` | Limites não exibidos; foto com falha não bloqueia (A-06); "arquivos por envio" sem efeito (A-15) | Alta | Cenário 23 |
| GPT p. 4 | Baixar anexo e exportar exigem a mesma autorização do registro | E·gpt | Pronto para a equipe; foto removida ainda acessível | `src/app/api/files/[id]/route.ts`; CSV e PDF só admin | A-02 | Alta | Cenário 2; CA-1 |
| GPT p. 4 | Permissões separam ver, incluir, alterar, validar/encerrar, cancelar, exportar; usuário não amplia as próprias; mudanças registradas | E·gpt | Ausente: 4 papéis fixos; só admin edita perfis | RPCs e políticas; `0100:433-434` | Matriz configurável (M-14) | Alta | `tests/db/permissions.test.ts` (novo) |
| GPT p. 4 | Dados de outros clientes nunca aparecem em buscas, anexos, painéis ou relatórios | E·gpt | Pronto entre locais para a equipe; cliente sem acesso | `has_site_access` (`0100:215-229`) | Portal exige função própria (A-01) | Alta | Cenários 1, 2, 17 |
| GPT p. 19 | Identificadores próprios; nome e documento não substituem vínculos | E·gpt | Pronto: UUID em todas as tabelas | — | — | Alta | — |
| GPT p. 19 | Documento emitido não muda quando muda o cadastro ou o modelo; revisões anteriores disponíveis | E·gpt | Parcial: orçamento congela na emissão, mas a aprovação recongela; logo e assinatura vivos; contrato não existe | `quote_versions` | A-03; M-24 | Alta | Cenário 15 |
| GPT p. 19 | Só operação confirmada cria registro; clique repetido e reenvio tratados | E·gpt | Parcial: O.S., lançamentos, tarefas, despesas, upload | `client_request_id`; `client_upload_id` | Orçamento (A-07), reembolso (A-08), obra (A-13), PDF e fechamento (A-23) | Alta | Cenário 3; `tests/db/requests.test.ts:83` |
| GPT p. 19 | Avisar sobre versão desatualizada em edição simultânea | E·gpt | Ausente | `version` nunca comparada (`0400:91`) | A-25 | Média | Teste novo em B-26 |
| GPT p. 19 | Datas e horários no fuso configurado para a empresa | E·gpt | Fixo por variável `APP_TIMEZONE=America/Sao_Paulo` | `src/domain/dates.ts`; `public.today_sp()` | Tornar editável na tela é opcional | Baixa | `src/domain/dates.test.ts:25` |
| GPT p. 19 | Não permitir encerrar sem evidência, contrato com O.S. de outro cliente nem reabrir sem motivo | E·gpt | Pronto para encerramento e reabertura; contrato ausente | `1400:363-423`; `0400:748-764` | M-24 | Alta | Cenários 5, 8, 16 |
| GPT p. 19 | Comentários internos separados do que o cliente vê | E·gpt | Parcial: campos `is_internal`, `client_visible`, `visibility` existem; hoje só filtram o PDF do cliente | `request_comments`, `work_entries`, `attachments` | Sem efeito de leitura até o portal | Alta | Cenário 17 |
| GPT p. 19 | A proposta deve informar hospedagem, espaço, backup de dados e anexos, restauração, suporte, entrega do código e exportação dos dados | E·gpt | Parcial: backup testado localmente; workflow desligado | `scripts/backup.ts`; `restore-test.ts` | B-76, B-78; entrega e exportação a combinar (DP-16) | Alta | Cenário 24; CA-10 |
| V4 (Segurança) | Upload privado e URLs temporárias | Téc. | Link estável `/api/files/<id>`, com sessão e RLS a cada pedido | `src/domain/file-serving.ts` | Sem URL assinada; aceitável com `no-store` (B-03) | Baixa | — |

## 3. Fluxogramas

### 3.1 Fluxo geral (GPT p. 2, marca P)

| Etapa do diagrama | Situação atual | Lacuna | Item |
|---|---|---|---|
| Clientes, colaboradores e locais; administrador define acessos | Parcial (T02–T05) | Documentos, ficha do colaborador, matriz | Fase 1 |
| Demanda de atendimento: cliente ou equipe abre O.S. | Diverge: só administração | DP-02, DP-01 | B-29, B-69 |
| Programar e atribuir | Pronto | — | — |
| Executar e registrar (atendimentos, fotos, pendências) | Pronto | A-06 | B-07 |
| Validar e concluir; correções voltam à execução | Pronto | — | — |
| Proposta comercial: administrador cria orçamento | Pronto | A-07 | B-08 |
| Registrar resposta: aprovar, recusar, revisar | Parcial: texto livre | Resposta estruturada | B-54 |
| Se aprovado: gerar ou vincular O.S., preservando o orçamento de origem | Ausente (só "criar obra") | — | B-55 |
| Contrato quando necessário (cliente + O.S. + modelo + datas) | Ausente | — | B-56 a B-59 |
| Histórico e relatórios por cliente, local e período | Parcial | Tipo de data, PDF da lista | B-42 a B-44 |
| Tarefas avulsas alimentam o diário sem O.S. fictícia | Pronto | — | — |

### 3.2 Atendimento e fechamento da O.S. (GPT p. 3, marca P)

| Transição do diagrama | Hoje | Situação | Item |
|---|---|---|---|
| Início → Aberta, por cliente ou equipe | Só administração (`0400:228`) | Diverge | DP-02 |
| Aberta → Programada (responsável, data, prazo) | `request_schedule`, admin | Pronto | — |
| Programada → Em execução | `request_start` ou automático no 1º lançamento | Pronto | — |
| Em execução → Pendente (motivo, ação, responsável, previsão) | `request_report_pending`, também a partir de Programada | Pronto; previsão sempre obrigatória | DP-07 |
| Pendente → Em execução (retomar) | `request_resume` | Pronto | — |
| Pendente → Programada (reprogramar) | `request_schedule` aceita Pendente | Pronto | — |
| Em execução → Executada (solução e fotos) | `request_mark_executed` | Pronto | — |
| Executada → Concluída (administrador aprova) | `request_validate`, admin | Pronto | DP-03 |
| Executada → Em execução (devolver com motivo) | `request_return`, admin | Pronto | — |
| Qualquer → Cancelada com motivo | De Aberta, Programada, Em execução e Pendente; não de Executada | Parcial | DP-04 |
| Reabertura retorna à programação com motivo | Volta para Aberta (`0400:748-764`) | Diverge no nome; ver DP-04 | DP-04 |
| Prazo vencido é alerta | Derivado (`src/domain/request-status.ts:131-136`) | Pronto | — |
| Agrupamento Abertas, Em andamento, Fechadas, Canceladas | Não existe no relatório | Ausente | B-43 |

## 4. Telas

### T01 — Painel inicial (GPT p. 5)

Não existe na `Descrição`; é acréscimo do caderno GPT.

| Fonte | Requisito | Marca | Situação atual | Backend | Lacuna | Prior. | Aceite / teste |
|---|---|---|---|---|---|---|---|
| GPT p. 5 | Mostrar ao administrador o que precisa de atenção | E·gpt | Parcial: `/admin` com 13 cartões, cada um com janela e regra | `src/server/dashboard.ts:11-62` | Lista "Prioridade do dia" | Média | `tests/e2e/painel.spec.ts:7` |
| GPT p. 5 | Painel do cliente só com seus chamados e locais | E·gpt | Ausente | — | Depende de DP-01 | Média | `tests/e2e/portal-cliente.spec.ts` (novo, Fase 6) |
| GPT p. 5 | Painel do colaborador com suas atividades | E·gpt | Parcial: `/campo` "Hoje" | `src/app/campo/page.tsx` | A-04 | Alta | `tests/e2e/campo.spec.ts` |
| GPT p. 5 | Filtros cliente, local e período limitados aos vínculos | P | Parcial: filtros GET cliente, local, profissional e período (só admin) | `src/app/admin/page.tsx:134-181` | Período só afeta parte dos cartões | Baixa | — |
| GPT p. 5 | "O.S. em aberto": não encerradas, inclusive pendentes e executadas | P | Pronto: cartão "Por situação" | `status=abertos` | Nome igual ao grupo "Abertas" do relatório, com conteúdo diferente (L-06) | Média | `painel.spec.ts:7` |
| GPT p. 5 | Prazo vencido é alerta, não situação | P | Pronto | `request-status.ts:131-136` | — | Alta | Cenário 9 |
| GPT p. 5 | Aguardam validação; tarefas do dia pela data programada | P | Pronto (validação); Parcial (tarefas: A-11) | `dashboard.ts:23-31` | A-11 | Média | B-11 |
| GPT p. 5 | Lista de atenção abre o registro e respeita filtros e permissões | P | Parcial: 6 cartões batem com a lista; outros não | `admin/page.tsx:209`, `:219`, `:234` | A-11 | Média | `painel.spec.ts` ampliado |
| GPT p. 5 | Ações: nova O.S., ver pendência, abrir tarefa, validar serviço | E·gpt | Parcial: ações existem nas telas próprias | — | Atalhos no painel | Baixa | B-28 |
| GPT p. 5 | Estado vazio com a ação permitida | E·gpt | Pronto nas listas (`EmptyState`) | `src/ui` | Conferir no painel | Baixa | Manual |

### T02 — Clientes (Descrição p. 1, item 1.a; GPT p. 6)

| Fonte | Requisito | Marca | Situação atual | Backend | Lacuna | Prior. | Aceite / teste |
|---|---|---|---|---|---|---|---|
| Descrição p. 1 | Nome principal | E·cli | Pronto: razão social e nome de exibição | `clients.legal_name`, `display_name` | — | Alta | `tests/e2e/cadastros.spec.ts:52` |
| Descrição p. 1 | Nome de usuários do sistema | E·cli | Parcial: responsáveis do cliente sem login | `client_contacts.user_id` sem uso | Usuários vinculados (depende de DP-01) | Alta | B-68 |
| Descrição p. 1 | CPF / CNPJ | E·cli | Parcial: dígito verificador na aplicação; sem unicidade | `0100:126`; `src/domain/registry.ts:46-62` | A-17 | Alta | `tests/db/clients.test.ts` (novo) |
| GPT p. 6 | Tipo de pessoa, validação de dígitos e unicidade pelo número normalizado | P | Parcial | idem | M-08 | Alta | idem |
| Descrição p. 1 | Endereço | E·cli | Parcial: texto livre | `clients.address_text` | Campos separados (P) | Média | — |
| Descrição p. 1 | Telefone | E·cli | Pronto (opcional) | `clients.phone` | Obrigatoriedade (P) | Média | — |
| GPT p. 6 | E-mail de contato opcional, separado do e-mail de login | P | Pronto | `clients.email` | — | Baixa | — |
| Descrição p. 1 | Arquivo de documentos (categoria, nome, visibilidade) | E·cli | Ausente | `attachment_entity` não tem cliente | M-12 | Alta | `tests/db/client-documents.test.ts` (novo) |
| Descrição p. 1 | Fotos (legenda, data de envio), separadas da evidência da O.S. | E·cli | Ausente | idem | M-12 | Alta | idem |
| Descrição p. 1 | Escolha de autorização dos menus | E·cli | Ausente: papéis fixos | — | "Gerenciar acessos" leva a T04 (M-14) | Alta | `tests/db/permissions.test.ts` |
| GPT p. 6 | Cadastro com histórico é inativado, não apagado; inativo não recebe novos vínculos | E·gpt / P | Pronto, sem motivo | `registry.ts:119-129`; `audit_clients` | Motivo e histórico na tela | Média | `cadastros.spec.ts:52` |
| GPT p. 6 | Busca por nome ou documento e filtro de situação | E·gpt | Não verificado em detalhe; busca saneada existe | `sanitizeSearch` (`src/domain/registry.ts:77-81`) | Conferir | Baixa | B-18 |
| GPT p. 6 | Ações: salvar, alterar, anexar, fotos, gerenciar acessos | E·gpt | Parcial | — | Anexar, fotos, acessos | Alta | B-18, B-24 |

### T03 — Colaboradores (Descrição p. 1, item 1.b; GPT p. 7)

| Fonte | Requisito | Marca | Situação atual | Backend | Lacuna | Prior. | Aceite / teste |
|---|---|---|---|---|---|---|---|
| Descrição p. 1 | Nome | E·cli | Pronto | `profiles.full_name` | — | Alta | — |
| Descrição p. 1 | CPF (obrigatório e único na proposta) | E·cli | Ausente | — | M-10 | Alta | `tests/db/collaborators.test.ts` (novo) |
| Descrição p. 1 | RG (opcional, com órgão emissor) | E·cli | Ausente | — | M-10 | Alta | idem |
| Descrição p. 1 | Endereço | E·cli | Ausente | — | M-10 | Alta | idem |
| Descrição p. 1 | Telefone | E·cli | Pronto | `profiles.phone` | Normalizar | Média | — |
| Descrição p. 1 | Arquivo de documentos, privados por padrão | E·cli | Ausente | — | M-10 com bucket privado | Alta | idem |
| Descrição p. 1 | Fotografia | E·cli | Ausente | — | M-10 | Alta | idem |
| Descrição p. 1 | Escolha de autorização dos menus | E·cli | Parcial: papel fixo | `profiles.role` | M-14 | Alta | `permissions.test.ts` |
| GPT p. 7 | Função e obras autorizadas | P | Parcial: papel e vínculos por período | `site_memberships` | Cargo | Média | — |
| GPT p. 7 | Documentos pessoais separados do que o cliente vê | E·gpt | Ausente; hoje a equipe lê todos os perfis | `0100:431-432` | A-24 antes de M-10 | Alta | `collaborators.test.ts` |
| GPT p. 7 | Desligamento exige transferir tarefas e O.S. abertas ou deixar a pendência visível | E·gpt | Ausente | `registry.ts:407-437` | A-12; M-13 | Média | Cenário 22 |
| GPT p. 7 | Inativar mantém registros e autoria | E·gpt | Pronto | `registry.ts:407-437` | — | Alta | `tests/db/requests.test.ts:320` |
| — | Colaborador sem login (ajudante sem e-mail) | — | Não existe: colaborador é usuário | — | DP-20 | Baixa | — |

### T04 — Usuários e permissões (GPT p. 8; Descrição p. 2, item 2.a)

| Fonte | Requisito | Marca | Situação atual | Backend | Lacuna | Prior. | Aceite / teste |
|---|---|---|---|---|---|---|---|
| Descrição p. 2 | Configurar as permissões de colaboradores e clientes | E·cli | Ausente: papéis fixos | RPCs, políticas | M-14 | Alta | `permissions.test.ts` |
| GPT p. 8 | Autorização por menu, ação e local; backend confere ao consultar, salvar, exportar e abrir anexo | E·gpt | Parcial: backend confere papel e local, não ação configurável | RLS; RPC | M-14 | Alta | Cenários 4, 21 |
| GPT p. 8 | E-mail de acesso único; login individual; recuperação | P | Pronto | `auth.users`; `profiles.email` | — | Alta | `convite.spec.ts:29` |
| GPT p. 8 | Perfis: administrador, encarregado, funcionário, responsável do cliente | P | Parcial: `client` sem acesso | `user_role` (`0100:14`) | DP-01 | Alta | — |
| GPT p. 8 | Clientes e locais obrigatórios para perfis restritos; sem vínculo fora da alçada | P | Parcial: pessoa × local para a equipe | `site_memberships`; `client_contact_sites` | Vínculo do cliente sem trilha (A-09) | Alta | B-10 |
| GPT p. 8 | Matriz ver, criar, alterar, validar, cancelar, exportar | P | Ausente | — | M-14 | Alta | `permissions.test.ts` |
| GPT p. 8 | Bloquear também sessões e anexos; registrar autor e data | P | Parcial | `registry.ts:415-424` | A-28; A-09 | Alta | Cenário 22 |
| GPT p. 8 | Cada usuário cria sua senha; admin não consulta senhas | E·gpt | Pronto: convite com link; a senha provisória é definida pelo admin, nunca lida | `registry.ts:439-465` | Senha provisória sem trilha (A-09) | Média | `convite.spec.ts:29` |
| GPT p. 8 | Cliente não acessa cadastros de pessoal nem configurações | E·gpt | Pronto por omissão | — | Manter no portal | Alta | Cenário 17 |
| GPT p. 4 | Usuário não amplia as próprias permissões | E·gpt | Pronto: só admin altera perfis | `0100:433-434` | Manter na matriz | Alta | `permissions.test.ts` |

### T05 — Obras e unidades (GPT p. 9)

Não existe na `Descrição`; é melhoria proposta.

| Fonte | Requisito | Marca | Situação atual | Backend | Lacuna | Prior. | Aceite / teste |
|---|---|---|---|---|---|---|---|
| GPT p. 9 | Cada local pertence a um cliente | P | Pronto; garantido no banco só para O.S. | `sites.client_id`; FK composta (`0300:52`) | A-18 em orçamento, fechamento e cobrança | Alta | Cenário 1 |
| GPT p. 9 | Tipo: obra temporária ou unidade fixa | P | Pronto | `site_type` | — | Média | `cadastros.spec.ts:52` |
| GPT p. 9 | Endereço, copiável do cliente | P | Pronto como texto | `sites.address_text` | Cópia do cliente | Baixa | — |
| GPT p. 9 | Responsável do local (não cria acesso) | P | Ausente | — | M-11 | Média | B-21 |
| GPT p. 9 | Equipe vinculada | P | Parcial: por pessoa | `site_memberships` | "Equipe" como entidade não existe (L-23) | Média | — |
| GPT p. 9 | Setores e orientações de acesso (horários, entrada) | P | Setores: Pronto. Acesso: Ausente | `site_areas` | M-11 | Média | B-21 |
| GPT p. 9 | Situação ativa ou encerrada; encerrado fica nos relatórios e não recebe tarefa sem reativar | P | Pronto (ativa, pausada, encerrada) | `site_status` | Bloqueio de tarefa em local encerrado não verificado | Baixa | B-21 |
| GPT p. 9 | Ações: salvar, alterar setores, vincular equipe, encerrar | E·gpt | Pronto | `registry.ts` | — | Média | `cadastros.spec.ts:52` |
| GPT p. 9 | Ao escolher o cliente em O.S., orçamento ou tarefa, mostrar só seus locais | E·gpt | Não verificado | — | B-23 | Média | E2E novo em B-23 |

### T06 — Abrir O.S. (Descrição p. 1, item 1.c.i; GPT p. 10)

| Fonte | Requisito | Marca | Situação atual | Backend | Lacuna | Prior. | Aceite / teste |
|---|---|---|---|---|---|---|---|
| Descrição p. 1 | Selecionar o cliente | E·cli | Pronto: cliente derivado do local | `request_open` (`0400:204-293`) | — | Alta | `requests.test.ts:66` |
| Descrição p. 1 | Descrever o chamado | E·cli | Pronto: título e descrição | `service_requests.title`, `description` | Obrigatoriedade do título não conferida nesta auditoria | Alta | `vertical-slice.spec.ts:8` |
| Descrição p. 1 | Registro fotográfico | E·cli | Pronto, opcional | `attachment_links` papel inicial | Obrigatoriedade (DP-06) | Alta | Cenário 3 |
| GPT p. 10 | Foto obrigatória ao abrir, várias fotos, legenda, câmera ou galeria | P | Diverge: opcional | `new-request-form.tsx:120`; `0400:218` | DP-06; M-16 | Alta | `requests.test.ts` novo caso |
| GPT p. 10 | Número único, solicitante e data/hora automáticos e não editáveis | P | Pronto (`AAAA-NNNNNN`) | `number UNIQUE`; `created_by`; `opened_at` | Formato (DP-19) | Alta | `requests.test.ts:66` |
| GPT p. 10 | Cliente e local filtrados pelas permissões de quem abre | P | Pronto para admin | — | Equipe e cliente (DP-02, DP-01) | Alta | B-29 |
| GPT p. 4, p. 10 | Cliente ou equipe abre O.S. em locais autorizados | E·gpt / P | Diverge: só administração | `0400:228`; teste "equipe de campo não abre chamado" | DP-02; DP-01 | Alta | B-29, B-69 |
| V4 (Divergências) | Registrar autor real, canal e solicitante externo | V4 | Pronto | `origin`, `channel`, `requester_contact_id`, `requester_name` | — | Alta | `requests.test.ts:92` |
| GPT p. 10 | Setor e categoria em listas configuráveis | P | Pronto | `site_areas`; `service_categories` | — | Baixa | — |
| GPT p. 10 | Prioridade definida pelo admin na triagem | P | Pronto, por catálogo | `priority_definitions` | Valores fixos × catálogo (DP-10) | Baixa | — |
| GPT p. 10 | Executor e datas obrigatórios para programar, não para abrir | P | Pronto | `request_schedule` | — | Média | — |
| GPT p. 10 | Falha de anexo mantém o formulário e bloqueia a confirmação | E·gpt | Parcial | `media-uploader.tsx:77` | A-06 | Alta | Cenário 23 |
| GPT p. 10 | Repetir o clique não cria outra O.S. | E·gpt | Pronto | `UNIQUE (created_by, client_request_id)` | — | Alta | `requests.test.ts:83` |

### T07 — Alimentar e fechar O.S. (Descrição p. 1, item 1.c.ii; GPT p. 11)

| Fonte | Requisito | Marca | Situação atual | Backend | Lacuna | Prior. | Aceite / teste |
|---|---|---|---|---|---|---|---|
| Descrição p. 1 | Descrever o serviço prestado | E·cli | Pronto | `work_entries.description`, `solution` | — | Alta | `vertical-slice.spec.ts:8` |
| Descrição p. 1 | Registro fotográfico | E·cli | Pronto | `attachment_links` | A-06 | Alta | Cenário 23 |
| GPT p. 11 | Data da atividade obrigatória; data/hora real do envio e autor | P | Pronto | `activity_date`, `created_at`, `author_id` | — | Alta | `work-and-tasks.test.ts:96` |
| GPT p. 11 | Executada exige serviço prestado e fotos do resultado | P | Pronto | `1400:363-423` | — | Alta | `requests.test.ts:115`; cenário 5 |
| GPT p. 11 | Materiais quando houver | P | Pronto | `work_entries.materials` | — | Baixa | — |
| GPT p. 11 | Resultado: andamento, pendência ou executada, conforme a situação atual | P | Pronto | `REQUEST_ACTIONS` (`src/domain/request-status.ts:44-66`) | — | Média | `request-status.test.ts` |
| GPT p. 11 | Pendência exige motivo, justificativa, próxima ação e responsável | P | Pronto | `0400:554-613` | — | Alta | `requests.test.ts:209`; cenário 6 |
| GPT p. 11 | Previsão de retorno ou justificativa da ausência, com alerta | P | Diverge: data sempre obrigatória | `0400:593-598` | DP-07; M-17 | Média | B-33 |
| GPT p. 11 | Aprovar encerra; devolver exige motivo e volta à execução; reabrir preserva a conclusão | P | Pronto | `0400:690-764` | "Encerrado em" some após reabrir (A-26) | Alta | `requests.test.ts:182`, `:254`; cenário 7 |
| GPT p. 11 | Abas Solicitação, Atendimentos, Fotos e Histórico | E·gpt | Parcial: detalhe em duas colunas com linha do tempo | `src/ui/request-timeline.tsx` | B-37 | Média | E2E novo |
| GPT p. 11 | O cliente vê informações de atendimento autorizadas | E·gpt | Ausente (sem portal) | `client_visible`, `is_internal` | DP-01 | Média | Cenário 17 |
| GPT p. 11 | Cancelar e reabrir exigem motivo | E·gpt | Pronto | `0400:727-764` | Cancelar sem motivo não testado no banco | Alta | Cenário 8 |
| GPT p. 11 | Observações internas identificadas e restritas | E·gpt | Parcial: marcadas como internas; a equipe do local lê | `request_comments.is_internal` | Restrição ao cliente (Fase 6) | Média | Cenário 17 |
| GPT p. 4 | Registrar atendimento: encarregado e funcionário só nos atribuídos | P | Diverge: qualquer O.S. do local | `docs/11-revisao-seguranca.md:57` | DP-21 | Média | — |
| GPT p. 4 | Validar e encerrar: administrador; encarregado "se autorizado" | P | Só administração | `0400:696` | DP-03 | Média | Cenário 4 |

### T08 — Consultar O.S. e relatórios (Descrição p. 1, item 1.c.iii; GPT p. 12)

| Fonte | Requisito | Marca | Situação atual | Backend | Lacuna | Prior. | Aceite / teste |
|---|---|---|---|---|---|---|---|
| Descrição p. 1 | Imprimir O.S. abertas, em andamento e fechadas por período e cliente, conforme o filtro | E·cli | Parcial: lista filtrada e CSV; PDF só da O.S. individual e do fechamento | `src/server/request-list.ts`; `src/app/api/csv/chamados/route.ts` | PDF da lista (B-44) | Alta | Cenário 20 |
| Descrição p. 1; GPT p. 3 | Grupos Abertas (Aberta + Programada), Em andamento (Em execução + Pendente + Executada), Fechadas (Concluída), Canceladas à parte | E·cli (3 grupos); E·gpt (mapeamento) | Parcial: filtro "Em aberto" e as 7 situações | `request-list.ts:27-40` | B-43 | Alta | Teste novo em `src/domain/request-status.test.ts` |
| GPT p. 12 | Os filtros aparecem no PDF gerado | E·gpt | Pronto no fechamento (critérios congelados); lista sem PDF | `closing_versions.criteria` | B-44 | Alta | Cenário 20 |
| GPT p. 12 | Cliente e local restritos ao acesso do usuário | P | Pronto (admin) | RLS | Cliente na Fase 6 | Alta | Cenário 17 |
| GPT p. 12 | Tipo de data: abertura, atividade, conclusão ou situação na data de corte | P | Parcial: só abertura | `request-list.ts:82-83` | B-42 | Média | CA-9 |
| GPT p. 12 | Filtros por situação, responsável, categoria, prioridade e atraso | P | Parcial: sem categoria e prioridade | `request-list.ts:27-40` | B-43 | Média | — |
| GPT p. 12 | PDF resumo ou detalhado, com fotos, legendas e pendências | P | Pronto no fechamento | `src/server/reports/builders.ts:9-17` | Lista | Média | `pdf-long.test.ts:96` |
| GPT p. 12; docs/02 R-91 a R-97 | Fechamento mensal com versão até o último dia do mês | P (GPT) / Word de outubro | Pronto | `monthly_closings`; `closing_versions` | Continuar obrigatório (DP-17) | Alta | Cenário 18 |
| GPT p. 12 | Recebidos, concluídos e não concluídos no corte podem se sobrepor; não somar; cancelados e reabertos identificados | E·gpt | Pronto | `src/domain/closing.ts:189-197` | — | Alta | `closings.test.ts:119` |
| GPT p. 12 | Mesmos filtros e permissões na tela, no PDF e no CSV | P | CSV usa a mesma consulta da tela | `listRequests` | Teste de conciliação do CSV de chamados | Média | Cenário 20 |
| GPT p. 19 | Relatório emitido guarda filtros, corte e versão; correção gera nova versão | E·gpt | Pronto no fechamento; demais PDFs sem snapshot | `report_artifacts` | M-20 | Média | B-48 |
| docs/02 R-97; V4 (Divergências) | Mês por extenso e ano no título e no nome do arquivo | Word de outubro (confirmado em 25/10/2026) | Pronto: "SETEMBRO / 2026"; `Relatorio_<Cliente>_Setembro_2026.pdf` | `src/domain/report-naming.ts:35-42` | — | Alta | `report-naming.test.ts:5`; `fechamento.spec.ts:6` |

### T09 — Orçamentos (Descrição p. 2, item 1.d; GPT p. 13)

| Fonte | Requisito | Marca | Situação atual | Backend | Lacuna | Prior. | Aceite / teste |
|---|---|---|---|---|---|---|---|
| Descrição p. 2 | Cliente cadastrado | E·cli | Pronto | `quotes.client_id` | Local sem garantia no banco (A-18) | Alta | `quotes.test.ts:62` |
| Descrição p. 2 | Descrição do serviço | E·cli | Pronto: título, inclusões, itens | `quotes`, `quote_items` | Obrigatória na emissão (M-23) | Alta | Cenário 13 |
| Descrição p. 2 | Valor | E·cli | Pronto: soma dos itens, com item de valor global | `total_cents` por gatilho | Valor zero bloqueado (`0700:47`); emissão só com valor total (DP-08) | Alta | Cenário 13 |
| Descrição p. 2 | Período de execução | E·cli | Pronto como texto | `execution_deadline_text` | Início e fim (P); obrigatório na emissão | Alta | Cenário 13 |
| Descrição p. 2 | Forma de pagamento | E·cli | Pronto, opcional | `payment_terms` | Obrigatória na emissão | Alta | Cenário 13 |
| Descrição p. 2 | Garantia | E·cli | Pronto, opcional | `warranty_text` | Obrigatória na emissão | Alta | Cenário 13 |
| Descrição p. 2 | Texto livre | E·cli | Pronto: abertura, observações, notas técnicas, declaração | `intro_text`, `observations`, `technical_notes`, `declaration_text` | Títulos e listas (P) | Média | — |
| Descrição p. 2 | Imagens da obra | E·cli | Pronto (ver T10) | `attachment_links` | — | Alta | `quotes.test.ts:97` |
| Descrição p. 2 | Arquivo em PDF | E·cli | Ausente: bucket aceita só imagem | `1100:2-4`; `src/domain/upload.ts:21` | M-22 | Alta | CA-5 |
| Descrição p. 2 | Assinatura | E·cli | Pronto como imagem global | `company_settings.signature_attachment_id` | Congelar na revisão (A-03); assinante por orçamento | Alta | CA-5 |
| Descrição p. 2 | Data | E·cli | Pronto (emissão) | `issued_at` | Data de emissão ou de assinatura (DP-14) | Alta | CA-5 |
| GPT p. 13 | Número, validade e revisão | P | Pronto | `number`; `valid_until`; `quote_versions` | — | Média | `quotes.test.ts:62` |
| GPT p. 13 | Rascunho salva incompleto; emissão valida os obrigatórios | E·gpt | Parcial: emissão exige item e validade; não exige pagamento, garantia e período | `1300:155-172` | M-23 | Alta | Cenário 13 |
| GPT p. 13 | Ações: salvar rascunho, pré-visualizar, emitir PDF, criar revisão | E·gpt | Pronto | `quote_transition` | A-07 | Alta | `orcamentos.spec.ts:9` |
| GPT p. 13 | Validade vencida é alerta quando não aprovado | P | Diverge: bloqueia a aprovação até renovar | `1300:174-198` | DP-09 | Média | `quotes.test.ts:240` |
| GPT p. 13 | Itens detalhados podem ser evolução futura | P | Itens já existem | `quote_items` | Não travar a emissão simples (DP-08) | Média | — |

### T10 — Imagens, assinatura e resposta do orçamento (GPT p. 14; Descrição p. 2)

| Fonte | Requisito | Marca | Situação atual | Backend | Lacuna | Prior. | Aceite / teste |
|---|---|---|---|---|---|---|---|
| Descrição p. 2; GPT p. 14 | Várias fotos com legenda e ordem; escolher as que entram no PDF | E·cli / P | Parcial: legenda no envio; ordem de envio; duas seções | `1300:79-109` | Reordenar, editar legenda, escolher (M-22) | Média | B-51 |
| Descrição p. 2; GPT p. 14 | Anexos PDF, separados ou incorporados ao fim | E·cli / P | Ausente | — | M-22; incorporar exige biblioteca aprovada | Alta | CA-5 |
| Descrição p. 2; GPT p. 14 | Assinante e função; imagem autorizada de assinatura | E·cli / P | Parcial: imagem global, sem assinante por orçamento | `company_settings` | B-53 | Média | CA-5 |
| GPT p. 14 | Situações e revisões; PDFs e revisões anteriores guardados | P | Pronto nas versões; o PDF sai sempre da última versão | `quote_versions`; `builders/quote.ts:33-41` | A-03 | Alta | Cenário 15 |
| GPT p. 14 | Resposta do cliente com decisão, pessoa, canal e evidência, registrada pelo admin | P | Parcial: texto livre "quem aprovou e como" e data | `accepted_note`, `status_reason` | M-21 | Alta | Cenário 14 |
| GPT p. 14 | Toda aprovação pertence a uma revisão específica | E·gpt | Quebrado: a aprovação recongela | `quotes.ts:182` | A-03 | Alta | Cenários 14, 15 |
| GPT p. 14 | Gerar ou vincular O.S. após aprovação, copiando cliente, local e escopo, sem duplicar | P | Ausente: só "criar obra" | `sites.quote_id` | M-21 | Alta | CA-6 |
| GPT p. 14 | Imagem de assinatura é elemento visual e não aprova | E·gpt | Pronto | — | — | Alta | — |

### T11 — Contratos (Descrição p. 2, item 1.e; GPT p. 15)

| Fonte | Requisito | Marca | Situação atual | Backend | Lacuna | Prior. | Aceite / teste |
|---|---|---|---|---|---|---|---|
| Descrição p. 2 | Escolha do cliente | E·cli | Ausente | — | M-24 | Alta | CA-7 |
| Descrição p. 2; GPT p. 15, p. 19 | Escolha da O.S., só do cliente escolhido; bloquear vínculo incompatível | E·cli / E·gpt | Ausente | — | FK composta em M-24 | Alta | Cenário 16 |
| Descrição p. 2 | Data de início e finalização; fim ≥ início | E·cli / P | Ausente | — | M-24 | Alta | CA-7 |
| Descrição p. 2; GPT p. 15 | Textos já prontos: modelos mantidos pelo admin, com versão | E·cli / P | Ausente | — | M-24 | Alta | CA-7 |
| Descrição p. 2 | Impressão em PDF e DOC para alterar | E·cli | Ausente; não há biblioteca de `.docx` | — | DP-12; aprovação de biblioteca (`03` §7) | Alta | CA-7 |
| GPT p. 15 | Texto editável no contrato sem alterar o modelo; variáveis sem valor destacadas | P | Ausente | — | M-24 | Média | `src/domain/contract-render.test.ts` (novo) |
| GPT p. 15 | Número e revisão; mudança após emissão gera revisão | P | Ausente | — | M-24 | Média | Cenário 15 |
| GPT p. 15 | Assinatura ou aceite como anexo com data e responsável; exportar não marca como assinado | P | Ausente | — | DP-14 | Média | B-59 |
| GPT p. 15 | Alterações feitas no Word não voltam; o arquivo revisado pode ser anexado | E·gpt | Ausente | — | B-59 | Média | — |
| GPT p. 15 | Textos contratuais fornecidos ou aprovados pela Megagyn | E·gpt | — | — | DP-13 | Alta | — |
| GPT p. 2 | Contrato só quando necessário; não é pré-requisito | P | — | — | — | — | — |

### T12 — Tarefas de obras (Descrição p. 2, item 1.f; GPT p. 16)

| Fonte | Requisito | Marca | Situação atual | Backend | Lacuna | Prior. | Aceite / teste |
|---|---|---|---|---|---|---|---|
| Descrição p. 2 | Lançar as atividades diárias | E·cli | Pronto: `/admin/agenda`, `/admin/agenda/nova` multilocal | `task_create` (`0500:38-147`) | — | Alta | `campo.spec.ts:7` |
| Descrição p. 2 | Alimentação e fechamento das atividades | E·cli | Parcial: registrar, finalizar, não realizada; finalizar sem resultado | `0500:149-262` | A-14 (M-18); A-05 (M-02) | Alta | B-38, B-06 |
| GPT p. 16 | Cada tarefa pertence a um local; locais distintos geram registros separados | P | Pronto: uma ocorrência por local | `task_occurrences` | Modelo diferente (tarefa-pai), resultado igual | Média | Cenário 10 |
| GPT p. 16 | Título e descrição obrigatórios | P | Pronto | `tasks.title` | — | Média | — |
| GPT p. 16 | Um responsável principal e participantes | P | Parcial: responsáveis sem principal | `task_assignments` | Principal | Baixa | — |
| GPT p. 16 | Dia e prazo obrigatórios; horário opcional; mudanças com histórico | P | Parcial: histórico só em `audit_events`, sem tela | `audit_tasks` | B-39 | Média | — |
| GPT p. 16 | Prioridade pelo admin; vínculo opcional com O.S. | P | Pronto | `tasks.priority_id`, `service_request_id` | — | Média | — |
| GPT p. 16 | Resultado com descrição e fotos; não realizado exige motivo e providência | P | Parcial: motivo sim; providência e resultado não | `task_occurrence_not_done` | M-18 | Média | B-38 |
| GPT p. 16 | Situações Programada, Em execução, Pendente, Concluída, Cancelada | P | Parcial: nomes diferentes; tarefa presa em cancelada | `task_status`, `occurrence_status` | A-05; rótulos | Média | B-06 |
| GPT p. 16, p. 19 | Encerrar tarefa ligada a O.S. não encerra a O.S. | E·gpt | Pronto | `task_occurrence_finish` só altera a ocorrência | Sem teste específico | Alta | `work-and-tasks.test.ts` novo caso |
| GPT p. 16, p. 20 | Validação administrativa de tarefas ativável depois | P | Ausente | — | DP-05 | Baixa | B-40 |
| GPT p. 16 | Agenda por responsável e local | P | Pronto; sem filtro por cliente | `src/app/admin/agenda/page.tsx` | B-39 | Baixa | `agenda.spec.ts:7` |

### T13 — Diário e relatório de atividades (Descrição p. 2, item 1.f.iii; GPT p. 17)

| Fonte | Requisito | Marca | Situação atual | Backend | Lacuna | Prior. | Aceite / teste |
|---|---|---|---|---|---|---|---|
| Descrição p. 2 | Relatórios das atividades | E·cli | Pronto: diário por local e período, PDF interno e para o cliente, atividades por pessoa | `src/server/daily-log.ts:43-160` | CSV | Alta | `closings.test.ts:138` |
| GPT p. 17 | Reaproveita atendimentos das O.S. e resultados das tarefas | E·gpt | Pronto, menos pendências | `work_entries` | A-10 | Alta | `work-and-tasks.test.ts:24` |
| GPT p. 17 | Atividade avulsa sem O.S. | E·gpt | Pronto | `work_entries` sem vínculo | Exigir responsável e resultado (P) | Alta | `work-and-tasks.test.ts:73` |
| GPT p. 17 | Um atendimento aparece uma vez; vínculo com tarefa e O.S. não duplica contagem | E·gpt | Pronto no diário | `0400:507-513`; `src/domain/daily-log.ts:83-85` | Contadores do painel sem teste | Alta | `daily-log.test.ts:38`, `:45`; cenário 12 |
| GPT p. 17 | Data da atividade diferente da data de envio | E·gpt | Pronto | `activity_date` × `created_at` | — | Alta | `work-and-tasks.test.ts:96` |
| GPT p. 17 | Local e período; vários dias e colaboradores | P | Pronto | `loadDiary` | — | Média | — |
| GPT p. 17 | Equipe; filtrar por colaborador | P | Pronto | PDF "Atividades por pessoa" | — | Média | — |
| GPT p. 17 | Atividades previstas e resultado | P | Pronto | `task_occurrences` | — | Média | — |
| GPT p. 17 | Executado e pendências com motivo, providência, responsável e previsão | P | Parcial | `request_events` | A-10 (B-45) | Média | Cenário 6 |
| GPT p. 17 | Fotos vinculadas e ocorrências do dia | P | Fotos: Pronto. Ocorrências do dia: Ausente | — | B-46 | Baixa | — |
| GPT p. 17 | Origem visível (O.S., tarefa, avulsa) | P | Parcial: vínculo com tarefa não aparece (`taskTitle: null`) | `src/server/daily-log.ts` | B-46 | Baixa | — |
| GPT p. 17 | PDF e CSV, A4, páginas numeradas, filtros, fotos legíveis; cliente vê só o autorizado | E·cli / P | PDF: Pronto. CSV: Ausente | `report_artifacts` | B-47 | Média | `pdf-long.test.ts:96` |

### T14 — Configurações (Descrição p. 2, item 2; GPT p. 18)

| Fonte | Requisito | Marca | Situação atual | Backend | Lacuna | Prior. | Aceite / teste |
|---|---|---|---|---|---|---|---|
| Descrição p. 2 | Configurar as permissões | E·cli | Ver T04 | — | M-14 | Alta | — |
| Descrição p. 2 | Configurar todo o sistema: textos e campos que devem aparecer | E·cli | Parcial: textos padrão e catálogos | `company_settings`; 7 catálogos | DP-10 | Alta | CA-10 |
| GPT p. 18 | Dados da empresa e logotipo usados nos documentos | P | Pronto | `company_settings` | Dados oficiais a conferir (DP-15) | Alta | `cadastros.spec.ts:163` |
| GPT p. 18; Descrição p. 2 | Modelos de orçamento e contrato com variáveis, revisões e prévia | P / E·cli | Ausente: só textos padrão do orçamento | — | M-24 | Alta | CA-7 |
| GPT p. 18 | Rótulo e texto de ajuda do campo | P | Ausente | — | M-25 | Média | B-60 |
| GPT p. 18 | Tipo do campo (texto, número, moeda, data, lista, sim/não, arquivo) | P | Ausente | — | Fora da primeira versão (DP-10) | Baixa | — |
| GPT p. 18 | Obrigatoriedade por etapa; campos essenciais não removíveis | P | Ausente | — | M-25 | Média | B-61 |
| GPT p. 18 | Visibilidade e edição por perfil, aplicadas também a relatórios e anexos | P | Ausente | — | M-25 com M-14 | Média | Cenário 21 |
| GPT p. 18 | Opções de lista com ativo e inativo; opções antigas preservadas | P | Pronto: 7 catálogos | `0100:250-303` | Sem trilha (A-09) | Média | `cadastros.spec.ts:163` |
| GPT p. 18 | Pré-visualizar e salvar versão | E·gpt | Ausente | — | B-62 | Média | — |
| GPT p. 18 | Mudanças não reescrevem orçamentos e contratos emitidos | E·gpt | Parcial | — | A-03 | Alta | Cenário 15 |
| GPT p. 18 | Troca de tipo que perde informação exige migração | E·gpt | Não se aplica enquanto não houver tipo configurável | — | — | Baixa | — |
| GPT p. 18 | Acesso exclusivo de quem tem autorização administrativa | E·gpt | Pronto: só admin altera; a equipe lê `company_settings` | `0100:436-439` | — | Média | — |
| docs/02 R-44 | Limites de arquivo configuráveis | Word de outubro | Parcial | `company_settings` | A-15 | Média | B-31 |

## 5. Critérios de aceite do caderno (GPT p. 20)

O caderno pede demonstrar cada caso com um administrador, um cliente e um colaborador. Detalhe dos testes em `07-roteiro-de-testes.md` §4.

| Id | Caso | Resultado esperado | Telas | Situação atual | Itens |
|---|---|---|---|---|---|
| CA-1 | Cliente com duas unidades | Usuário autorizado na Unidade Centro não abre dados nem anexos da Unidade Norte por link direto | T04, T05 | Mecanismo pronto para a equipe (`campo.spec.ts:92`); sem perfil de cliente | B-65, B-66 |
| CA-2 | Cadastros completos | Nome, documentos, endereço, telefone, arquivos e fotos salvos e alterados sem perder histórico | T02, T03 | Parcial: sem documentos, fotos e dados pessoais | B-17 a B-19 |
| CA-3 | O.S. e pendência | Número único; pendência exige motivo e providência; execução exige solução e foto | T06, T07 | Pronto | B-30 (foto inicial) |
| CA-4 | Validação e retorno | Devolve com motivo ou conclui; reabrir preserva conclusão e justificativa | T07 | Pronto | B-49 (A-26) |
| CA-5 | Orçamento completo | PDF com descrição, valor, prazo, pagamento, garantia, texto livre, imagens, anexos escolhidos, assinatura e data | T09, T10 | Parcial: sem anexos PDF; emissão não exige todos os campos | B-50 a B-53 |
| CA-6 | Orçamento aprovado | Conversão cria O.S. ligada à revisão aprovada; repetir mostra a mesma | T10 | Ausente | B-04, B-55 |
| CA-7 | Contrato editável | Cliente filtra O.S.; variáveis preenchidas; PDF e Word com o mesmo texto e revisão | T11 | Ausente | B-56 a B-58 |
| CA-8 | Tarefas e diário | Atividade registrada uma vez aparece no local e no dia certos, mesmo ligada à O.S. | T12, T13 | Pronto | — |
| CA-9 | Relatórios por período | Filtros e critérios identificados; serviço resolvido no mês seguinte não altera fechamento emitido | T08 | Pronto no fechamento; lista sem tipo de data nem PDF | B-42, B-44 |
| CA-10 | Configuração e recuperação | Inativar campo preserva valores; bloqueado perde acesso; backup restaura dados e anexos | T14, T04 | Parcial: campo configurável ausente; backup testado localmente | B-02, B-60, B-76 |

## 6. Resumo por tela

| Tela | Situação | Fase principal | Lacunas de prioridade Alta | Outras lacunas |
|---|---|---|---|---|
| T01 Painel | Parcial | 2 | Painel do campo com corte em 100 (A-04) | Lista de atenção, painel por perfil, cartões divergentes (A-11) |
| T02 Clientes | Parcial | 1 | Documentos, fotos, unicidade de CPF/CNPJ, usuários vinculados, acessos | Endereço estruturado, motivo ao inativar |
| T03 Colaboradores | Parcial (mínimo) | 1 | CPF, RG, endereço, foto, documentos privados, acessos, privacidade dos perfis (A-24) | Cargo, desligamento com pendências (A-12) |
| T04 Usuários e permissões | Parcial | 1 | Matriz por módulo e ação, perfil do cliente, vínculos do cliente com trilha, bloqueio de anexos (A-28) | Trilha da senha provisória |
| T05 Obras e unidades | Parcial | 1 | Local × cliente garantido no banco fora das O.S. (A-18) | Responsável, orientações de acesso, filtro em cascata |
| T06 Abrir O.S. | Parcial | 2 | Quem abre (DP-02), foto inicial (DP-06), foto com falha (A-06) | Formato do número (DP-19) |
| T07 Alimentar e fechar O.S. | Pronto com ressalvas | 0 e 2 | Foto com falha (A-06); "Encerrado em" após reabrir (A-26) | Pendência sem data (DP-07), abas, quem registra e valida (DP-21, DP-03) |
| T08 Consultar O.S. e relatórios | Parcial (fechamento Pronto) | 3 | PDF da lista com filtros impressos, agrupamento dos 3 grupos | Tipo de data, categoria, prioridade, snapshot |
| T09 Orçamentos | Parcial | 0 e 4 | Regras de emissão, anexo PDF, assinatura congelada, idempotência (A-07) | Validade vencida (DP-09) |
| T10 Resposta do orçamento | Parcial, com defeito (A-03) | 0 e 4 | Aprovação da revisão exata, resposta estruturada, gerar ou vincular O.S., anexos PDF | Ordem e escolha das fotos, assinante |
| T11 Contratos | Ausente | 4 | Módulo inteiro, PDF e `.docx`, textos aprovados (DP-13) | Aceite separado |
| T12 Tarefas | Parcial, com defeito (A-05) | 0 e 2 | Tarefa presa em cancelada (A-05), resultado ao finalizar (A-14) | Histórico visível, filtro por cliente, validação (DP-05) |
| T13 Diário | Parcial | 3 | Pendência no diário (A-10), CSV | Origem da tarefa, ocorrências do dia |
| T14 Configurações | Parcial | 4 e 5 | Modelos versionados, textos e campos configuráveis (DP-10), emitidos imutáveis (A-03) | Prévia, versões, tipos de campo |
