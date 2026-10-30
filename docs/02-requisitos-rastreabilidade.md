# 02 — Requisitos e matriz de rastreabilidade

> Etapa 1 — 25/10/2026. Cada requisito aponta para a origem documental, a entidade que o sustenta ([04-modelo-dados.md](04-modelo-dados.md)), a tela ([05-fluxos-e-telas.md](05-fluxos-e-telas.md)), a regra de negócio e o teste que o comprova.

## 1. Convenções

**Origem**
- `W§n` — seção n do `Escopo Sistema Megagyn Service.docx`; `W-T10.n` — teste n da tabela "Critérios para aprovação" (Word §10).
- `REL p.n` — página n do `Relatório de Serviços setembro 2026`; `ORC p.n` — página n do `Orçamento`.
- `P-Mn` — módulo n do `Prompt.md`; `P-An` — critério de aceite n do Prompt §9; `P-V3` — orientações de 25/10/2026.

**Classificação**
- **DOC** — requisito documental (Word). Base contratada.
- **COMP** — complemento solicitado no Prompt (orçamentos, horas/diárias, UX mobile reforçada).
- **COND** — condicional à decisão Q1 (login do cliente).

**Telas** (IDs definidos em 05): `AUTH-nn`, `ADM-nn` (administrador, desktop-first), `CMP-nn` (campo: funcionário e encarregado, mobile-first), `CLI-nn` (cliente, cenário A).

**Testes**: `T-An` = teste de aceite n do Prompt §9 (18 testes, que englobam os 10 do Word); `U-xxx` = teste unitário de regra pura; `I-xxx` = integração (banco/RLS); `E-xxx` = E2E.

## 2. Matriz de rastreabilidade

### 2.1 Cadastros e estrutura (M1)

| ID | Requisito | Origem | Classe | Entidade | Tela | Regra | Teste |
|----|-----------|--------|--------|----------|------|-------|-------|
| R-01 | Dados da empresa (razão, CNPJ, endereço, telefone, e-mail, site, logo, resp. técnico, CREA, assinatura/rodapé, preferências de relatório) configuráveis | P-M1; divergências REL p.1/p.35 × ORC p.1/p.5 | DOC | `company_settings`, `attachments` (logo) | ADM-17 | Nenhum dado cadastral no código; PDFs leem da configuração vigente; versão do cabeçalho congelada no snapshot | U-settings-snapshot; T-A11 |
| R-02 | Clientes PF/PJ com razão social, nome de exibição, contatos, faturamento opcional | W§3; P-M1 | DOC | `clients`, `client_contacts` | ADM-02 | Contatos são pessoas **sem conta** por padrão (ver Q1) | I-clients-crud |
| R-03 | Obras e unidades vinculadas ao cliente, diferenciando obra temporária × unidade de manutenção recorrente; nome, código, endereço, status, período previsto | W§3; P-M1 | DOC | `sites` (`site_type`) | ADM-03 | `site_type ∈ {obra_temporaria, unidade_recorrente}`; status `ativa/pausada/encerrada` | I-sites-crud |
| R-04 | Setores/ambientes internos por local (salão de festas, escritório, subsolo, piscina, elevadores, torre 3…) | W§3; REL p.1–33 | DOC | `site_areas` | ADM-03 | Lista editável; chamado/atividade referencia área opcionalmente | I-sites-crud |
| R-05 | Usuários com login individual, vínculo por local e papel; inativação sem apagar histórico | W§2, W§9; P-M1 | DOC | `profiles`, `site_memberships` | ADM-04, AUTH-01 | `profiles.is_active=false` bloqueia login e RLS; autorias preservadas por FK | T-A15 |
| R-06 | Múltiplos responsáveis por cliente/unidade; um responsável em várias unidades | W§3; P-M2 | DOC/COND | `client_contacts`, `client_contact_sites` | ADM-02 | Pessoa de contato N:N com unidades, independente de ter login | I-contact-scope |
| R-07 | Catálogos editáveis: categorias de serviço, prioridades, motivos de pendência (falta de material, autorização, acesso, terceiro, outro), fornecedores, categorias de despesa | W§3, W§4; P-M1 | DOC | `service_categories`, `priority_definitions`, `pending_reasons`, `suppliers`, `expense_categories` | ADM-17 | Soft delete (`is_active`), nunca apagar item referenciado | I-catalogs |
| R-08 | Nunca presumir quantidade fixa de funcionários, obras, fotos ou clientes | W§2, W§10; P-M1 | DOC | — | — | Sem limites hardcoded; limites operacionais (tamanho de arquivo, nº de fotos por envio) em `company_settings` | U-limits-config |

### 2.2 Chamados e OS (M2)

| ID | Requisito | Origem | Classe | Entidade | Tela | Regra | Teste |
|----|-----------|--------|--------|----------|------|-------|-------|
| R-10 | Chamado e OS são o **mesmo registro** com número único preservado após triagem | W§4; P-M2 | DOC | `service_requests` | ADM-05/06, CMP-02/03 | Número `AAAA-NNNNNN` por sequência; `id` UUID estável | T-A1 |
| R-11 | Campos: cliente, unidade, setor, solicitante, timestamps, título, descrição, categoria, prioridade, fotos iniciais, responsável(is), prazo, data programada | W§4; P-M2 | DOC | `service_requests`, `request_assignments`, `attachment_links` | ADM-06/07 | Fotos iniciais com `evidence_role=inicial` | T-A1, T-A2 |
| R-12 | Origem: cliente (portal), cliente externo (via admin), demanda interna, atividade programada; canal; vínculo opcional com tarefa | W§4; P-M2; P-V3 | DOC | `service_requests.origin`, `.channel`, `.requester_contact_id`, `.task_id` | ADM-07, CLI-02 | Admin **sempre** pode abrir em nome do cliente informando `requester_contact_id` e `channel` | T-A1 |
| R-13 | Estados: Aberta, Programada, Em execução, Pendente, Executada, Concluída, Cancelada — semântica exata do Word | W§4 (tabela); P-M2 | DOC | `service_requests.status`, `request_events` | ADM-06, CMP-03 | Máquina de estados em 04 §5; transições só por função servidor | U-status-machine |
| R-14 | Não permitir `Executada` sem descrição da solução + ao menos 1 foto de resultado | W§4 "Controle obrigatório"; W-T10.2; P-M2 | DOC | `request_events`, `work_entries`, `attachment_links` | CMP-06 | Validação no servidor (não só no form); foto deve estar `upload_status=concluido` e `evidence_role=resultado` | T-A2 |
| R-15 | Não permitir `Pendente` sem motivo + providência (+ responsável pela próxima ação + previsão) | W§4; W-T10.3; P-M2 | DOC | `request_events.payload`, `pending_reasons` | CMP-05 | Campos obrigatórios: `pending_reason_id`, `next_action`, `next_action_owner`, `expected_return_date` | T-A3 |
| R-16 | Só admin valida (`Concluída`) ou devolve para correção | W§4; P-M2 | DOC | `request_events` | ADM-06 | Transição `executada→concluida` e `executada→em_execucao` exigem `role=admin` | U-status-machine, I-rls-transitions |
| R-17 | Reabertura preserva conclusão anterior (evento, data, usuário, motivo) | W§4; W-T10.10; P-M2 | DOC | `request_events` (append-only) | ADM-06 | Evento `reaberta` com `reason`; evento `concluida` anterior nunca alterado | T-A9, T-A12 |
| R-18 | Prazo vencido é alerta, não status | W§4; P-M2 | DOC | view `v_service_requests` (coluna derivada `is_overdue`) | ADM-01/05, CMP-02 | `due_date < now() AND status NOT IN (concluida, cancelada)` | U-overdue |
| R-19 | Trilha auditável para prioridade, prazo, responsável, status (autor, timestamp, motivo) | W§4; P-M2 | DOC | `request_events`, `audit_events` | ADM-06 (timeline), ADM-18 | Trigger de auditoria em colunas sensíveis; eventos append-only (sem UPDATE/DELETE via RLS) | I-audit-trail |
| R-20 | Anexos removidos e cancelamentos ficam no histórico (soft delete/revogação) | W§4, W§6; P-M2 | DOC | `attachments.revoked_at`, `request_events` | ADM-06 | Revogação gera evento; arquivo permanece no storage até política de retenção | I-attachment-revoke |
| R-21 | Nota interna distinta de informação destinada ao cliente; comentários do cliente só na visibilidade autorizada | W§4; P-M2 | DOC/COND | `request_comments.is_internal`, `work_entries.client_visible`, `attachments.visibility` | ADM-06, CLI-03 | RLS do cliente filtra `is_internal=false`; relatório do cliente usa whitelist | T-A10 |
| R-22 | Registros atravessam meses sem perda de histórico temporal | W§8; P-M2 | DOC | `request_events.created_at` | ADM-15 | Snapshot calcula estado em qualquer corte | T-A9 |
| R-23 | Em cada atualização: autor, data/hora da ação, data real do trabalho, descrição, solução, materiais, fotos de atividade e de resultado | W§4; P-M2 | DOC | `work_entries` (`activity_date` ≠ `created_at`) | CMP-04 | Ver R-30 | T-A4 |

### 2.3 Agenda e tarefas (M3)

| ID | Requisito | Origem | Classe | Entidade | Tela | Regra | Teste |
|----|-----------|--------|--------|----------|------|-------|-------|
| R-25 | Admin distribui tarefas por dia com obra, descrição, prioridade, prazo, setor e responsável | W§5 "Agenda do encarregado"; P-M3 | DOC | `tasks`, `task_assignments` | ADM-08 | Tarefa tem `scheduled_date`, `due_date`, `priority_id`, `site_id` | T-A6 |
| R-26 | Lista diária/semanal, filtro por funcionário/obra; agenda multiobra para encarregado | W§5; P-M3 | DOC | `tasks`, `task_occurrences` | ADM-08, CMP-01/02 | Query por `scheduled_date` e memberships do usuário | T-A6 |
| R-27 | Tarefa ligada a chamado ou independente (vistoria, visita técnica, recebimento de material, apoio, compra, atividade programada) | W§5; P-M3 | DOC | `tasks.kind`, `tasks.service_request_id` | ADM-08 | `kind` enum editável por catálogo leve | T-A5, T-A6 |
| R-28 | Ações mobile: Iniciar, Registrar atividade, Adicionar fotos, Informar impedimento, Finalizar | P-M3 | DOC | `task_occurrences.status`, `work_entries` | CMP-03 | Mesmo componente de ação da OS | T-A6 |
| R-29 | Tarefa com locais diferentes desdobra ocorrências por local sem perder a tarefa-pai; alteração/atraso rastreáveis; dia sem execução aceita justificativa | W§5; P-M3 | DOC | `task_occurrences` (`task_id`, `site_id`), `audit_events`, `task_occurrences.no_show_reason` | ADM-08, CMP-03 | Cada ocorrência vincula uma obra; `work_entry.task_occurrence_id` | T-A6 |

### 2.4 Diário de obra / work entries (M4)

| ID | Requisito | Origem | Classe | Entidade | Tela | Regra | Teste |
|----|-----------|--------|--------|----------|------|-------|-------|
| R-30 | Lançamento de atividade é fonte única: ID, obra, data real, autor, participantes, texto, horas, materiais, fotos, ocorrência/pendência, refs opcionais a OS e tarefa | W§5; P-M4 | DOC | `work_entries`, `work_entry_participants`, `attachment_links` | CMP-04 | Uma linha por fato; `service_request_id` e `task_occurrence_id` ambos opcionais e não exclusivos | T-A4, T-A5 |
| R-31 | Atualização de OS/tarefa gera/usa a mesma entrada; diário é projeção por data+local | W§5 ("não pode ser contabilizada duas vezes"); P-M4 | DOC | view `v_daily_log` | ADM-09 | Diário = `work_entries` agrupadas por (`site_id`, `activity_date`) + tarefas previstas do dia + `time_entries`; nenhuma tabela "diário" materializada | T-A4 |
| R-32 | Atividade avulsa sem OS entra no diário; sem chamado fictício | W§5; W-T10.4; P-M4 | DOC | `work_entries` (`service_request_id NULL`) | CMP-04 | Obrigatório apenas `site_id` + `activity_date` + descrição | T-A5 |
| R-33 | Por dia: equipe, previstas, executadas, parciais/não executadas com motivos, fotos, materiais, observações, próximos passos | W§5; P-M4 | DOC | `work_entries.outcome`, `.blocker_reason_id`, `.next_step` | ADM-09 | `outcome ∈ {executado, parcial, nao_executado}` | T-A11 |
| R-34 | Horas por profissional/dia separadas de diárias cobradas | W§5; REL p.1–33 ("09 horas"); P-M4, P-M8 | DOC/COMP | `time_entries` | CMP-10, ADM-13 | `time_entries.hours` (jornada) ≠ `time_entries.billing_units` (diárias) | T-A18 |
| R-35 | Evitar dupla contagem (vários profissionais no mesmo trabalho; registro ligado à OS e à agenda) | W§5; P-M4 | DOC | `work_entry_participants` | ADM-09 | Contagem de atividades = `COUNT(work_entries)`; participantes não multiplicam; OS e tarefa apontam para a mesma linha | U-dedupe-count |
| R-36 | Admin revisa/ajusta com histórico sem alterar silenciosamente o envio do trabalhador | P-M4 | DOC | `work_entries.review_status`, `audit_events` (before/after) | ADM-10 | Ajuste grava `reviewed_by/at` + diff em auditoria; texto original visível na timeline | I-audit-trail |
| R-37 | `activity_date` separado de `created_at/uploaded_at` | W§6; P-M4 | DOC | `work_entries.activity_date`, `attachments.uploaded_at` | CMP-04 | Padrão = hoje; editável para datas passadas (limite configurável, ex.: 7 dias, só admin além disso) | U-activity-date |

### 2.5 Fotografias e documentos (M5)

| ID | Requisito | Origem | Classe | Entidade | Tela | Regra | Teste |
|----|-----------|--------|--------|----------|------|-------|-------|
| R-40 | Câmera e galeria, múltiplas fotos, preview, legenda, autor, instante do upload, visualização ampliada | W§6; P-M5 | DOC | `attachments` | CMP-04, componente `MediaUploader` | `<input capture="environment" multiple>`; legenda opcional | T-A2, T-A11 |
| R-41 | Fotos iniciais / intermediárias / finais identificadas; reaproveitadas nas telas e PDFs referenciando o mesmo arquivo | W§6 (relatório diário reutiliza evidências da OS); P-M5 | DOC | `attachment_links.evidence_role` | todas | Um arquivo, N vínculos; PDF referencia `storage_key` | T-A4, T-A11 |
| R-42 | Comprovantes em imagem ou PDF com zoom e legibilidade preservada | W§6, W§7; P-M5 | DOC | `attachments.mime_type` | CMP-08, ADM-11 | Original preservado; thumb gerado à parte | T-A7 |
| R-43 | Estados de upload (enviando, concluído, falhou, tentar novamente); sem duplicata em reenvio | W§6 ("confirmar o recebimento"); P-M5; P-A17 | DOC | `attachments.upload_status`, `.client_upload_id` (idempotência) | `MediaUploader` | `UNIQUE(uploader_id, client_upload_id)`; `content_hash` para detectar repetidos | T-A17 |
| R-44 | Tamanho/tipo máximos configuráveis; validação MIME real (magic bytes) | P-M5, P§7 | DOC | `company_settings.upload_limits`, `attachments` | ADM-17 | Validação no servidor ao finalizar upload; rejeita spoofing | I-upload-mime |
| R-45 | Storage privado, URLs assinadas curtas, permissões em anexos e PDFs | W§9 ("permissões… inclusive nos arquivos anexos"); P-M5 | DOC | bucket privado, `attachment_links` | — | Acesso só via função que checa vínculo cliente/obra; TTL curto (ex.: 10 min) | T-A10 |
| R-46 | Sem geolocalização obrigatória, reconhecimento facial ou coleta excessiva | P-M5, LGPD | DOC | — | — | EXIF de localização removido no processamento da imagem | U-exif-strip |

### 2.6 Despesas, rateio e reembolso (M6)

| ID | Requisito | Origem | Classe | Entidade | Tela | Regra | Teste |
|----|-----------|--------|--------|----------|------|-------|-------|
| R-50 | Lançamento: data, fornecedor, categoria, descrição/itens, valor total, forma de pagamento, comprador, pagador, comprovante, nº documento, OS/tarefa opcional | W§7; P-M6 | DOC | `expenses` | CMP-08, ADM-11 | Valor em `total_cents BIGINT` | T-A7 |
| R-51 | Compra para uma ou várias obras com rateio e finalidade por parcela | W§7; P-M6 | DOC | `expense_allocations` | CMP-08 | Cada parcela: `site_id NOT NULL`, `amount_cents > 0`, `purpose` | T-A7 |
| R-52 | Soma das parcelas = total; bloquear negativo, obra vazia e diferença de centavo; sem float | W§7 (tabela R$ 1.000 = 600 + 400); W-T10.6; P-M6 | DOC | trigger `check_expense_allocations` | CMP-08 | Constraint deferida ao fim da transação; inteiros em centavos | T-A7 (inclui erro de R$ 0,01) |
| R-53 | Conferência: Enviado para conferência → Aprovado / Devolvido para correção, com justificativa | W§7; P-M6 | DOC | `expenses.review_status`, `expense_reviews` | ADM-11 | Devolução exige `reason` | T-A8 |
| R-54 | Edição de valor/rateio aprovado invalida aprovação e exige nova conferência, com histórico | W§7; W-T10.10; P-M6 | DOC | trigger em `expenses`/`expense_allocations` | ADM-11, CMP-08 | Insere `expense_reviews(action=invalidada)` e volta para `enviado_para_conferencia` | T-A8 |
| R-55 | Reembolso independente: valor a reembolsar, já reembolsado, situação, quitação pelo admin; sem transferência | W§7; P-M6 | DOC | `reimbursements` | ADM-12 | `status ∈ {pendente, parcial, quitado}`; só admin quita | T-A8 |
| R-56 | Painel interno: aprovadas × em conferência; por obra, fornecedor, data, categoria, comprador | W§7, W§8; P-M6 | DOC | views agregadas | ADM-01, ADM-11 | Somas sobre `expense_allocations`, nunca sobre `expenses.total` + parcelas | T-A13 |
| R-57 | Cliente nunca acessa valores, comprovantes, fornecedores, reembolsos | W§7, W§8; P-M6 | DOC | RLS: nenhuma policy de leitura para papel cliente | — | Teste de acesso negado por API/URL | T-A10 |

### 2.7 Orçamentos (M7 — COMPLEMENTO)

| ID | Requisito | Origem | Classe | Entidade | Tela | Regra | Teste |
|----|-----------|--------|--------|----------|------|-------|-------|
| R-60 | Proposta com número, cliente/contato, local, emissão, validade, prazo de execução, pagamento, garantia, observações, notas técnicas | ORC p.1, p.5; P-M7 | COMP | `quotes` | ADM-14 | Campos espelham o PDF; texto de declaração (ORC p.5) é modelo editável em `company_settings` | T-A14 |
| R-61 | Itens por local com descrição, subitens, qtd, unidade, preço unitário, subtotal e total; **valor global por local** | ORC p.1 ("Cobertura" R$ 7.600,00 global); P-M7 | COMP | `quote_items`, `quote_item_lines` | ADM-14 | `pricing_mode ∈ {global, detalhado}`; total = Σ subtotais em centavos | T-A14 |
| R-62 | Fotos do local e fotos de serviços realizados (referências) | ORC p.2–4; P-M7 | COMP | `quote_attachments.section` | ADM-14 | `section ∈ {local, referencia}` | T-A14 |
| R-63 | Dados e identidade visual da Megagyn vindos do perfil | ORC p.1/p.5 × REL (divergem); P-M7 | COMP | `company_settings` | ADM-14 | Ver R-01 | T-A14 |
| R-64 | Status Rascunho, Enviado, Aprovado, Rejeitado, Expirado, Cancelado; histórico e versões | P-M7 | COMP | `quotes.status`, `quote_versions` | ADM-14 | `Expirado` derivado por `valid_until < today` quando `status=enviado` (job diário ou cálculo em leitura) | U-quote-status |
| R-65 | Duplicar, pré-visualizar, exportar PDF A4, registrar aceite manual | P-M7 | COMP | `quote_versions.pdf_artifact_id` | ADM-14 | Sem assinatura eletrônica | T-A14 |
| R-66 | Soma correta, valor por extenso correto, não importar divergências do PDF | ORC p.1 ("setembro mil, seiscentos reais" — errado); P-M7 | COMP | função `amount_in_words_pt_br` | ADM-14 | Testar 7.600,00 → "sete mil e seiscentos reais" e casos de borda (centavos, 1.000.000) | U-extenso |
| R-67 | Orçamento ≠ despesa; aprovado não vira gasto nem receita | P-M7 | COMP | — | — | Nenhuma FK de `quotes` para `expenses`; dashboards separados | T-A18 |
| R-68 | Desejável: criar obra e tarefas iniciais a partir de orçamento aprovado | P-M7 | COMP (desejável) | `sites.quote_id` | ADM-14 | Ação explícita do admin; nunca automática | E-quote-to-site |

### 2.8 Horas, diárias e demonstrativo (M8 — COMPLEMENTO)

| ID | Requisito | Origem | Classe | Entidade | Tela | Regra | Teste |
|----|-----------|--------|--------|----------|------|-------|-------|
| R-70 | Jornada/hora por profissional e dia com vínculo à obra | REL p.1–33 ("Carga horária: 09 horas"); P-M8 | COMP | `time_entries` | CMP-10, ADM-13 | 1 linha por (usuário, obra, dia) | T-A18 |
| R-71 | Valor de diária e/ou hora por contrato/obra, com vigência; não é salário nem custo | REL p.34 (R$ 333,00); P-M8 | COMP | `billing_rules` | ADM-13 | `unit_type ∈ {diaria, hora}`, `valid_from/valid_to`; preço do dia = regra vigente na data | U-billing-rule-vigencia |
| R-72 | Dia faturável, quantidade de diárias, ajustes aprovados | P-M8 | COMP | `time_entries.billable`, `.billing_units`, `.approved_by` | ADM-13 | Só admin ajusta `billing_units` | T-A18 |
| R-73 | Demonstrativo mensal quando habilitado para o contrato e liberado ao cliente | REL p.34 (24 × 333 = 7.992); P-M8 | COMP | `billing_rules.show_in_client_report` | ADM-15 | Bloco do PDF só aparece se habilitado; teste com 24 × 333,00 = 7.992,00 | T-A11, U-demonstrativo |
| R-74 | Separar visibilidade de valores comerciais ao cliente de custos internos | P-M8 | COMP | whitelist do relatório | ADM-15 | Despesas nunca no relatório do cliente | T-A10, T-A18 |

### 2.9 Dashboards (M9)

| ID | Requisito | Origem | Classe | Entidade | Tela | Regra | Teste |
|----|-----------|--------|--------|----------|------|-------|-------|
| R-80 | Admin: chamados por estado, novos hoje, atrasados, pendências por responsável/motivo, tarefas de hoje, atividades por obra, obras ativas, despesas aprovadas × em conferência, aguardando validação, orçamentos em aberto | W§8; P-M9 | DOC (+COMP para orçamentos) | views `v_dashboard_*` | ADM-01 | Cada card declara janela temporal e regra; clique abre lista filtrada | E-dashboard-drilldown |
| R-81 | Filtros por cliente, obra, profissional, período, situação | W§8; P-M9 | DOC | — | ADM-01/05 | Filtros em query string (persistentes) | E-dashboard-drilldown |
| R-82 | Campo: cards grandes Hoje, Minhas atividades, Registrar serviço, Enviar foto, Pendências, Registrar compra (encarregado) | P-M9 | DOC | — | CMP-01 | Botão "Registrar compra" só para `role=foreman` | E-campo-home |
| R-83 | Cliente: resumo das unidades, chamados ativos/concluídos, últimas fotos autorizadas, pendências, relatórios publicados; sem indicador financeiro | P-M9 | COND | views com whitelist | CLI-01 | Só cenário A | T-A10 |

### 2.10 Relatórios e fechamento mensal (M10)

| ID | Requisito | Origem | Classe | Entidade | Tela | Regra | Teste |
|----|-----------|--------|--------|----------|------|-------|-------|
| R-90 | Relatórios: OS individual, diário por local/período, atividades por pessoa, fechamento mensal (resumo e detalhado), despesas internas, orçamento | W§8 (tabela); P-M10 | DOC (+COMP orçamento) | `report_artifacts` | ADM-16, ADM-15, ADM-14 | Mesmo motor de PDF (HTML+CSS paginado) | T-A11 |
| R-91 | Fechamento: cabeçalho editável, cliente, unidade, período, emissão, resp. técnico | W§8; REL p.1; P-M10 | DOC | `closing_versions.header_snapshot` | ADM-15 | Cabeçalho congelado na versão | T-A12 |
| R-92 | Seções: pendências herdadas, novos no mês, concluídos no mês (mesmo antigos), em aberto no corte por status, executados aguardando validação, cancelados, reabertos, com motivos/providências | W§8 "Conteúdo do fechamento mensal"; P-M10 | DOC | `closing_versions.payload` | ADM-15 | Classificação em 04 §9; reaberturas/cancelamentos não contam como novas aberturas | T-A9 |
| R-93 | **Snapshot temporal**: estado por eventos até 23:59:59 do último dia (America/Sao_Paulo); resolvido no mês seguinte continua pendente no fechamento anterior | W§8; W-T10.7; P-M10 | DOC | função `request_status_at(request_id, cutoff)` | ADM-15 | Usa `request_events.created_at <= cutoff_utc` | T-A9, U-status-at |
| R-94 | Fechamento persistido e versionado; correção gera nova versão preservando a anterior | W§8; W-T10.10; P-M10 | DOC | `monthly_closings`, `closing_versions`, `report_artifacts` | ADM-15 | Versão é imutável após `status=fechada`; `version_no` incremental | T-A12 |
| R-95 | Sem duplicidade OS × diário; visões distintas, sem somar duas vezes | W§5, W§8; P-M10 | DOC | payload com blocos `requests[]` e `activities[]` separados | ADM-15 | Indicadores contam entidades diferentes e dizem qual | T-A4, T-A11 |
| R-96 | Opções Resumo gerencial e Detalhado com fotos; fotos legíveis, proporções, quebras de página | W§8 "Formatos"; REL p.2–33; P-M10 | DOC | `report_artifacts.kind` | ADM-15 | CSS `break-inside: avoid` por bloco de atividade/foto; grade 2 colunas (como o original) | T-A11 |
| R-97 | **Botão "Exportar PDF"** no fechamento; PDF A4 paginado com **mês por extenso + ano** no título/cabeçalho (ex.: "SETEMBRO / 2026") e nome `Relatorio_<Cliente>_<Mês>_<Ano>.pdf` (ex.: `Relatorio_Park_dos_Alpes_Setembro_2026.pdf`) | P-V3; REL p.1 ("RELATÓRIO DE SERVIÇOS PRESTADOS — SETEMBRO / 2026") | DOC (confirmado em 25/10) | `report_artifacts.file_name` | ADM-15 | Função `closing_file_name(client, month, year, kind, version)`; sufixos `_Resumo` e `_v2+` (hipótese H-07) | U-file-name, T-A11 |
| R-98 | CSV UTF-8 (com BOM, `;` como separador) de listagens e despesas; totais conciliam com os indicadores | W§8; W-T10.9; P-M10 | DOC | — | ADM-05/11/16 | Mesma query da tela gera CSV | T-A13 |
| R-99 | Relatório do cliente sanitizado por whitelist; nunca valores/comprovantes internos | W§8; P-M10 | DOC | `report_payload_client_whitelist` | ADM-15 | Serializador explícito campo a campo | T-A10 |
| R-100 | Admin sempre baixa PDF; publicação/revogação e download pelo cliente **somente no cenário A** | P-V3; P-M10 | DOC/COND | `report_publications` | ADM-15, CLI-05 | Tabela existe nos dois cenários (registra "liberado ao cliente"); UI do portal só em A | T-A12 |
| R-101 | Geração estável de relatórios longos com estado de processamento | REL (35 págs.); P-M10 | DOC | `report_artifacts.status` (`na_fila, processando, pronto, falhou`) | ADM-15 | Geração assíncrona; UI consulta estado | E-pdf-long |

### 2.11 Segurança e operação (P§7)

| ID | Requisito | Origem | Classe | Entidade | Tela | Regra | Teste |
|----|-----------|--------|--------|----------|------|-------|-------|
| R-110 | Login individual, recuperação de acesso, bloqueio de desligados | W§9; P§7 | DOC | Supabase Auth, `profiles.is_active` | AUTH-01/02/03 | Middleware + RLS checam `is_active` | T-A15 |
| R-111 | Autorização papel + cliente + obra em API, consulta e arquivo | W§9; P§2, P§7 | DOC | RLS + funções `has_site_access()` | — | Nenhuma rota usa `service_role` para leitura de dados do usuário | T-A10 |
| R-112 | Clientes não inferem dados por troca de ID/URL (cenário A) | W-T10.8; P§7 | COND | RLS | — | Teste automatizado de IDOR | T-A10 |
| R-113 | HTTPS, segredos por env, `.env.example` sem tokens | W§9; P§7 | DOC | — | — | — | checklist |
| R-114 | Auditoria de alterações sensíveis, aprovações, status, rateios, cancelamentos, reaberturas, versões | P§7 | DOC | `audit_events` | ADM-18 | Trigger genérico + eventos de domínio | I-audit-trail |
| R-115 | Proteção contra upload malicioso, tamanho, injeção | P§7 | DOC | validação servidor | — | Zod + magic bytes + limites | I-upload-mime |
| R-116 | LGPD: minimização, retenção, exclusão compatível com rastreabilidade | P§7 | DOC | `company_settings.retention_policy` | ADM-17 | Documentar; anonimização de contato em vez de DELETE | doc |
| R-117 | Backup de banco **e storage** com teste de restauração documentado | W§9; W-T10.10; P§7 | DOC | — | — | Procedimento em 03 §9; evidência na Etapa 6 | T-A16 |
| R-118 | Idempotência em criação de work entries, anexos, despesas sob rede instável | P§4, P-A17 | DOC | `client_request_id` UNIQUE | CMP-04/08 | Duplo clique = 1 registro | T-A17 |

## 3. Cobertura dos testes de aceite

| Teste Prompt | Equivalente Word | Requisitos cobertos | Fase (06) |
|---|---|---|---|
| T-A1 abrir chamado (admin em nome do cliente; cliente só em A) | T10.1 | R-10..R-12 | F2 |
| T-A2 triagem, execução, bloqueio sem foto/solução | T10.2 | R-13, R-14, R-16 | F2 |
| T-A3 pendência e retomada | T10.3 | R-15, R-17 | F2 |
| T-A4 OS alimenta diário sem duplicar | T10.4 | R-30, R-31, R-35 | F3 |
| T-A5 atividade sem chamado no diário | T10.4 | R-32 | F3 |
| T-A6 encarregado em duas obras | T10.5 | R-25..R-29 | F3 |
| T-A7 rateio 1.000 = 600 + 400; rejeita 0,01 | T10.6 | R-50..R-52 | F4 |
| T-A8 alteração pós-aprovação; reembolso independente | T10.10 | R-53..R-55 | F4 |
| T-A9 snapshot mensal | T10.7 | R-22, R-92, R-93 | F5 |
| T-A10 isolamento campo (sempre) e cliente (A) | T10.8 | R-45, R-57, R-99, R-111, R-112 | F1, F5 |
| T-A11 PDF A4 detalhado | T10.9 | R-90, R-96, R-97, R-73 | F5 |
| T-A12 v1 → v2 preservando v1 | T10.10 | R-94, R-100 | F5 |
| T-A13 CSV concilia | T10.9 | R-56, R-98 | F5 |
| T-A14 orçamento soma, PDF | — (COMP) | R-60..R-66 | F4 |
| T-A15 usuário inativado | — | R-05, R-110 | F1 |
| T-A16 restauração de backup | T10.10 | R-117 | F6 |
| T-A17 duplo clique sem duplicar | — | R-43, R-118 | F3, F4 |
| T-A18 não somar categorias heterogêneas | — | R-34, R-67, R-74 | F4, F5 |

## 4. Discrepâncias, ambiguidades e decisões

### 4.1 Discrepâncias entre documentos (tratadas como **configuração**, nunca como verdade)

| # | Item | Relatório set/2026 | Orçamento | Decisão de projeto |
|---|------|--------------------|-----------|--------------------|
| D-01 | Endereço | Av. T-8, nº 548, sala 04, Galeria Via Luma, St. Bueno (p.1–35) | Rua 16-A, nº 667, St. Aeroporto (p.1–5) | Campo em `company_settings`; confirmar com a Megagyn |
| D-02 | Site | www.megagynreformas.com.br | www.megagynreformas.com | idem |
| D-03 | CNPJ | 42.232.243/0001-03 (p.35) | 42.232.243/0001-06 (p.5) | idem; validar dígito verificador no cadastro |
| D-04 | CREA | "1018014640-GO" (p.1) e "1018014640 AP" (p.35) | "1018014640 AP" (p.5) | idem |
| D-05 | Razão social | "Megagyn Reformas" (p.1) / "Megagyn Reforma e Construções" (p.35) | "Megagyn Reforma e Construções" | `legal_name` + `trade_name` separados |
| D-06 | Nome do produto | Word: "Megagyn Service" | — | Nome do sistema; não é razão social |
| D-07 | Valor por extenso | — | "setembro mil, seiscentos reais" para R$ 7.600,00 | Erro humano; sistema gera extenso por função |
| D-08 | Planilha de diárias | 25 linhas de data (uma em branco, item 5) para "24 dias trabalhados"; 24 × 333 = 7.992 confere com os 24 dias narrados (01,02,03,04,05,08–11,14–19,21–26,28–30) | — | Demonstrativo gerado a partir de `time_entries`, sem digitação |
| D-09 | Numeração dos dias no relatório | Itens 1–7 numerados, depois "•" sem número (p.10 em diante) | — | Numeração automática |
| D-10 | Carga horária | Todos os 24 dias "09 horas", mas cobrança por diária | — | `hours` e `billing_units` separados (R-34) |
| D-11 | Resolução das fotos | Fotos embutidas em ~255×340 px | ~400×380 px | Decisão de 30/10/2026: versão única de 1600 px sem metadados + miniatura, para caber no plano gratuito. Fotos anteriores mantêm original + derivadas |
| D-12 | Endereço do cliente no orçamento | — | "Av. Castelo Branco, Qd. 16-B,, lt. Goiânia - GO" (lote ausente, vírgula dupla) | Campos estruturados de endereço |

### 4.2 Ambiguidades do escopo (hipóteses adotadas, detalhadas em 07)

| # | Ambiguidade | Hipótese adotada |
|---|-------------|------------------|
| H-01 | Reabertura: volta para qual estado? | `Aberta` (exige nova triagem); admin pode reprogramar na mesma ação |
| H-02 | Quem pode cancelar? | Só admin; cliente (A) pode **solicitar** cancelamento via comentário |
| H-03 | Funcionário pode criar OS? | Pode criar **atividade avulsa**; OS interna só admin (encarregado: ver Q4) |
| H-04 | Corte do snapshot usa hora do evento ou data da atividade? | Hora de registro do evento (`created_at`), conforme texto "eventos existentes até 23:59:59" |
| H-05 | "Executada" exige work_entry? | Sim: concluir cria/usa um `work_entry` com fotos `resultado` |
| H-06 | Diárias: unidade padrão | `billing_units` decimal (permite 0,5 diária); padrão 1 por dia faturável |
| H-07 | Nome do arquivo com versão/tipo | `Relatorio_<Cliente>_<Mês>_<Ano>.pdf` para detalhado v1; `_Resumo` para resumo; `_v2` a partir da 2ª versão |

### 4.3 Questão bloqueante
**Q1 — O cliente final terá login?** Bloqueia apenas as telas CLI-xx, as policies de RLS do papel `client`, a publicação no portal e o teste T-A10 (parte cliente). **Não bloqueia** o restante. Comparação dos cenários em [07-questoes-de-negocio.md](07-questoes-de-negocio.md).
