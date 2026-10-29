# 07 — Questões de negócio, hipóteses e decisões pendentes

> Etapa 1 — 25/10/2026. Nada aqui pressupõe resposta. As hipóteses marcadas **H** permitem avançar sem bloquear; as questões **Q** precisam de resposta do solicitante/Megagyn.

## 1. QUESTÃO PRIORITÁRIA — Q1: o cliente final terá login?

**Contexto.** O Word (§2, §4, §10 teste 1 e 8) prevê o perfil "Responsável do cliente" abrindo e acompanhando chamados. Uma dúvida informal posterior ("acho que o cliente não vai ter perfil; quem vai abrir o chamado é ele mesmo") **não confirma** a remoção. Este planejamento mantém os dois cenários e **não escolhe**.

**Em ambos os cenários:** o administrador abre chamados em nome do cliente, registrando origem (`cliente_externo`), canal (WhatsApp, telefone, e-mail, presencial) e solicitante (contato cadastrado ou nome livre).

### 1.1 Comparação objetiva

| Dimensão | **Cenário A — cliente com login** (conforme Word) | **Cenário B — somente usuários internos** |
|----------|---------------------------------------------------|--------------------------------------------|
| Quem abre o chamado | Cliente no portal (origem `cliente_portal`) **ou** admin em nome dele | Somente admin, a partir de WhatsApp/telefone/e-mail |
| Acompanhamento pelo cliente | Portal: status, prazos divulgáveis, fotos autorizadas, comentários, pendências | Fora do sistema: PDF mensal e mensagens enviadas pela Megagyn |
| Entrega do relatório | Publicar/revogar no portal + download pelo cliente; admin também baixa | Admin baixa o PDF e envia por fora; sistema registra "entregue em dd/MM por …" |
| Telas adicionais | CLI-01 a CLI-05 (5 telas) + "Convidar para o portal" em ADM-02 + "Publicar/Revogar" em ADM-15 | Nenhuma |
| Permissões adicionais | Papel `client`; função `is_client()`; ~12 policies; 3 views sanitizadas; policy de storage por `visibility='client'`; campos "visível ao cliente" ganham efeito de leitura | Papel `client` existe no enum mas sem policies (deny por padrão); campos "visível ao cliente" só controlam o PDF |
| Dados | `client_contacts.user_id` preenchido via convite | `client_contacts` sem conta |
| Escopo funcional | Word §2/§4/§8 integralmente | Word §2 "Responsável do cliente" e teste 1/8 (parte cliente) ficam fora; o restante igual |
| Risco de segurança | **Maior**: superfície externa, IDOR entre clientes, vazamento de dado interno em comentário/foto/relatório. Mitigado por RLS, whitelist e testes T-A10 | **Menor**: só usuários internos autenticados |
| Risco de produto | Clientes podem não adotar o portal (síndicos/gestores com pouco tempo); exige treinamento e suporte a senha | Megagyn continua intermediando toda comunicação; mais trabalho manual do admin; cliente sem transparência em tempo real |
| Esforço relativo | +~20–25% sobre o MVP (F5.b: 5 telas, policies, convite, publicação, testes de isolamento e sanitização) | Base |
| Operação | Suporte a login/senha de pessoas externas; LGPD com titulares externos autenticados | Sem contas externas; LGPD limitada a dados de contato |
| Reversibilidade | Pode ser **desligado** por configuração (`portal_enabled=false`) sem perder dados | Pode **evoluir** para A sem migração destrutiva (modelo neutro, ver 1.2) |

### 1.2 Modelagem recomendada (neutra, sem implementar dois portais)

- Pessoas do cliente ficam em `client_contacts` (nome, e-mail, telefone, unidades autorizadas) **sem conta**. Em A, um convite preenche `client_contacts.user_id` e cria o `profile` com `role='client'`.
- `service_requests` sempre registra `origin`, `channel` e `requester_contact_id` — útil nos dois cenários (histórico, relatório, "quem pediu").
- `report_publications` existe nos dois cenários: em A alimenta o portal; em B registra a entrega manual.
- Campos `client_visible`/`is_internal`/`visibility` existem desde o início: em B controlam apenas o PDF; em A também a leitura no portal.
- Pasta `app/cliente/` e policies do papel `client` **não são criadas** antes da decisão.

### 1.3 O que esta decisão bloqueia e o que não bloqueia

| Bloqueia | Não bloqueia |
|----------|--------------|
| Telas CLI-01..05; policies/views do papel `client`; publicação no portal; T-A1 (parte cliente) e T-A10 (isolamento entre clientes) | F0–F4 inteiras; fechamento mensal, PDF, versões, CSV (F5.a); dashboards; auditoria; backup |

**Pergunta direta à Megagyn:** "Os responsáveis dos locais (síndico, gerente, encarregado do condomínio) vão entrar no sistema com login próprio para abrir e acompanhar chamados e baixar relatórios, ou a Megagyn vai continuar recebendo os pedidos por WhatsApp/telefone e enviando os relatórios por fora?"

## 2. Outras questões (não bloqueiam o início)

| ID | Questão | Hipótese adotada enquanto não há resposta | Impacto se a resposta for diferente |
|----|---------|---------------------------------------------|-------------------------------------|
| Q2 | Dados cadastrais oficiais (razão social, CNPJ `…/0001-03` ou `…/0001-06`, endereço St. Bueno ou St. Aeroporto, site `.com.br` ou `.com`, CREA "GO" ou "AP") | Campos editáveis em ADM-17; seed vazio/placeholder "A CONFIRMAR" | Nenhum técnico; só preenchimento |
| Q3 | Logotipo em boa resolução e assinatura digitalizada | Upload em ADM-17; até lá, texto "MEGAGYN" estilizado | Nenhum |
| Q4 | Encarregado pode **abrir chamado** (demanda interna) ou só atividades/tarefas? | Encarregado cria atividades avulsas e tarefas próprias; OS interna só admin (H-03) | Pequeno: liberar transição `abertura` para `foreman` com `origin='interna'` |
| Q5 | Reabertura volta para `Aberta` (nova triagem) ou direto para `Programada` com o mesmo responsável? | `Aberta`, com atalho "reprogramar na mesma ação" (H-01) | Pequeno: ajuste na RPC |
| Q6 | Snapshot: um registro feito em 01/10 sobre trabalho de 30/09 conta no fechamento de setembro? | **Não** (usa instante de registro do evento, conforme Prompt M10) (H-04). Sugestão operacional: fechar o mês alguns dias depois, após conferência | Médio: trocar `occurred_at` por `activity_date` na apuração muda a semântica e exige regra para status |
| Q7 | Prazo padrão por prioridade (SLA)? Ex.: Alta = 2 dias | Catálogo de prioridades tem `sla_days` opcional; sem valor, prazo manual | Nenhum |
| Q8 | Unidade de cobrança no demonstrativo: só diária, só hora, ou ambos por contrato? | Ambos possíveis por `billing_rules.unit_type`; padrão diária (como set/2026) | Nenhum |
| Q9 | Demonstrativo mensal vai ao cliente por padrão? | Desligado por padrão (`show_in_client_report=false`); liga por contrato | Nenhum |
| Q10 | Nome do arquivo: incluir unidade quando o cliente tem várias? | `Relatorio_<Cliente>_<Mês>_<Ano>.pdf`; com unidade específica: `Relatorio_<Cliente>_<Unidade>_<Mês>_<Ano>.pdf` (H-07) | Nenhum |
| Q11 | Quem pode cancelar chamado? Cliente (A) pode? | Só admin; cliente solicita por comentário (H-02) | Pequeno |
| Q12 | Limite para lançar atividade com data retroativa | 7 dias para campo; admin sem limite, com auditoria | Nenhum (configurável) |
| Q13 | Hospedagem: container próprio (VPS/Railway/Fly) ou serverless (Vercel)? | Container (permite Playwright embutido) | Médio: serverless exige Gotenberg/Browserless para PDF |
| Q14 | Plano Supabase e política de backup/retenção contratada | Rotina própria de `pg_dump` + espelho de storage, independente do plano | Nenhum técnico; custo |
| Q15 | Volume esperado (nº de responsáveis, chamados/mês, fotos/mês) — o Word §10 pede levantamento antes da proposta | Dimensionamento de referência: 1 cliente ≈ 100 fotos/mês | Custo de storage |
| Q16 | Fotos com marca d'água da câmera (ex.: "CAMON 30" no orçamento) são aceitáveis no PDF? | Aceitas; sem processamento | Nenhum |
| Q17 | Numeração de chamados reinicia por ano (`2026-000001`)? | Sim | Pequeno |

## 3. Hipóteses de projeto (consolidadas)

| ID | Hipótese | Onde se aplica |
|----|----------|----------------|
| H-01 | Reabertura → `Aberta` | 04 §4 |
| H-02 | Cancelamento só por admin | 04 §4 |
| H-03 | Encarregado não abre OS; cria atividade/tarefa | 03 §5 |
| H-04 | Corte do snapshot pelo instante de registro do evento | 04 §9 |
| H-05 | "Concluí" cria/usa `work_entry` com foto `resultado` | 04 §4 |
| H-06 | Diária em `NUMERIC(6,2)`, padrão 1 por dia faturável | 04 §2.6 |
| H-07 | Nome do PDF: `Relatorio_<Cliente>_<Mês>_<Ano>[_Resumo][_vN].pdf` | 03 §7 |
| H-08 | Limites de upload iniciais 15 MB imagem / 20 MB PDF / 20 por envio, configuráveis | 03 §6 |
| H-09 | URLs assinadas com 10 min de validade | 03 §6 |
| H-10 | Notificações internas por tabela `notifications` (sem e-mail/push) | 06 F3.9 |
| H-11 | Stack Next.js + Supabase (repositório vazio; preferência do Prompt; stack do desenvolvedor) | 03 §2 |

## 4. O que os documentos sustentam × o que é melhoria proposta

| Sustentado pelos documentos (Word/PDFs) | Complemento/melhoria (Prompt ou este plano) |
|------------------------------------------|---------------------------------------------|
| 4 perfis; chamado = OS; 7 estados e regras de bloqueio; relatório diário automático; agenda multiobra com ocorrências por local; fotos com autor/data separadas da data da atividade; compras com rateio exato e conferência; reembolso separado; painel; fechamento mensal com corte temporal e versões; PDF A4 e CSV; permissões por cliente/obra inclusive em anexos; backup com restauração demonstrada | Orçamentos (M7); horas/diárias com regra de valor por contrato (M8); botão "Exportar PDF" com mês/ano no título e no nome (confirmado em 25/10); idempotência por `client_request_id`; derivadas de imagem e remoção de EXIF; auditoria genérica before/after; notificações internas; criação de obra a partir de orçamento; catálogo de formas de pagamento; `report_publications.delivery_note` no cenário B |

## 5. Dependências externas reais (para a implementação)

1. Projeto Supabase (URL, anon key, service role) para homologação e produção.
2. SMTP para convite/recuperação de senha (único e-mail do MVP).
3. Hosting de container com Chromium (ou Gotenberg) para PDFs.
4. Domínio + HTTPS.
5. Destino do backup externo (bucket S3-compatível ou similar).
6. Dados cadastrais e logo oficiais da Megagyn.
7. Decisão Q1.
