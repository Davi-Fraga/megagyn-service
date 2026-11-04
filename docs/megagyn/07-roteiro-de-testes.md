# 07 — Roteiro de testes

> Propósito: dizer, para cada cenário de aceite do V4 e cada critério CA do caderno, o que já é testado, o que falta, qual teste novo cobre a lacuna e o resultado esperado, além da regressão, do backup e da verificação manual. Data: 03/11/2026.

Itens de backlog: `05-backlog-priorizado.md`. Migrações: `03-arquitetura-e-modelo-de-dados.md`. Bugs: `01-auditoria-plataforma-atual.md` §5.

## 1. Tipos de teste e onde ficam

| Tipo | Ferramenta | Pasta | Comando |
|---|---|---|---|
| Unit | Vitest, projeto `unit` | `src/**/*.test.ts` | `npm test` |
| Banco | Vitest, projeto `db`, contra o Supabase local | `tests/db/*.test.ts` | `npm run test:db` |
| E2E | Playwright contra o build de produção | `tests/e2e/*.spec.ts` | `E2E_BASE_URL=http://localhost:3100 npx playwright test` |
| Manual | Roteiro com evidência registrada em `docs/10-checklist-aceite.md` | — | — |

O CI (`.github/workflows/ci.yml`) roda só lint, typecheck, unit e build. Banco e E2E rodam na máquina de desenvolvimento, antes de cada PR.

Última execução conhecida (31/10/2026): unit 232/232, banco 85/85, E2E 19/19. Ninguém rodou testes nesta auditoria.

## 2. Dados de teste (todos fictícios)

| Tipo | Valores |
|---|---|
| Clientes | "Cliente Exemplo Ltda." com "Unidade Centro" e "Unidade Norte"; "Cliente Outro Ltda." com "Unidade Sul" |
| Pessoas | "Admin Teste" (admin); "Encarregado Exemplo" (Centro e Norte); "João Exemplo" (funcionário, Centro); "Maria Exemplo" (funcionária, Sul); "Ana Exemplo" (responsável do cliente, só Centro) |
| E-mails | `<nome>@exemplo.invalid` (domínio reservado, não entrega) |
| Documentos | CPF e CNPJ gerados pelos helpers de teste, válidos só no dígito verificador; nunca de pessoa ou empresa real |
| Fotos | Imagens geradas nos próprios testes (padrão de `src/server/images.test.ts`) |
| Valores | Compra de R$ 1.000,00 rateada em R$ 600,00 + R$ 400,00; orçamento de R$ 4.800,00 (valor ilustrativo do GPT p. 13) |
| Datas | Setembro e outubro de 2026 para fechamento, como os testes atuais |

Os testes existentes usam os nomes fictícios do seed (por exemplo, "Condominio Jardim Exemplo Torre A"); os novos podem seguir o mesmo seed. Nenhum dado real de cliente, colaborador ou da Megagyn entra em teste, log ou exemplo.

## 3. Os 26 cenários do V4 §9

Cobertura atual: 8 totais, 13 parciais, 5 sem teste (auditoria de telas).

| # | Cenário | Teste existente | Falta | Teste novo (tipo, arquivo) | Dados | Resultado esperado |
|---|---|---|---|---|---|---|
| 1 | O.S. em unidade de outro cliente | Nenhum explícito. Proteção: cliente derivado do local em `request_open` e FK composta (`0300:52`) | Teste explícito; orçamento, fechamento e cobrança sem garantia (A-18) | Banco + `tests/db/requests.test.ts` "O.S. com local de outro cliente é recusada pelo banco"; + `quotes.test.ts` e `closings.test.ts` (B-22) | Cliente Exemplo e Unidade Sul | Erro do banco; nenhuma linha criada, nem órfã |
| 2 | Cliente da Unidade Centro tenta O.S., PDF ou foto da Norte por URL ou API | Só para funcionário: `tests/e2e/campo.spec.ts:92`; `tests/db/requests.test.ts:282` | Perfil de cliente | Banco novo `tests/db/client-isolation.test.ts`; E2E novo `tests/e2e/portal-cliente.spec.ts` (Fase 6) | Ana Exemplo (Centro) | 0 linhas na consulta; 404 no link da foto; 403 no PDF e no CSV |
| 3 | O.S. em nome do cliente com foto; dois cliques ou reenvio geram um registro | `requests.test.ts:66`, `:83`; `tests/e2e/vertical-slice.spec.ts:8` | — (total) | — | Admin Teste, Unidade Centro | Um número, um registro, um evento de abertura |
| 4 | Funcionário sem permissão tenta validar ou encerrar | `requests.test.ts:115` (validar recusado); `src/domain/request-status.test.ts:52` | Cancelar, devolver e reabrir pelo funcionário; exceção da matriz | Banco + `requests.test.ts` "funcionário não cancela, não devolve, não reabre"; `tests/db/permissions.test.ts` | João Exemplo | Recusa no banco (`42501`) em todas |
| 5 | Executada sem solução ou sem foto final é bloqueada; com ambas, aguarda validação | `requests.test.ts:115`; `tests/db/review-fixes.test.ts:141`; `vertical-slice.spec.ts:8` | — (total) | — | João Exemplo | Recusa sem um dos dois; Executada com ambos |
| 6 | Pendência incompleta é bloqueada; completa aparece no painel e no relatório | `requests.test.ts:209`; `tests/e2e/painel.spec.ts`; `tests/db/closings.test.ts:119` | Teste encadeado da mesma pendência; diário (A-10) | E2E novo `tests/e2e/pendencia.spec.ts`: pendência → cartão do painel → lista → prévia do fechamento → diário do dia (depois de B-45) | João Exemplo, "Falta de material" | Recusa sem motivo, providência ou responsável; a mesma pendência nos quatro lugares |
| 7 | Admin devolve com motivo; funcionário refaz; histórico permanece | `requests.test.ts:182` | Refazer e conferir o histórico | Banco + `requests.test.ts` "devolver, refazer e validar mantém os eventos em ordem" | Admin Teste, João Exemplo | Eventos de execução, devolução, nova execução e validação, em ordem, com autores |
| 8 | Cancelar e reabrir exigem motivo e preservam autoria e cronologia | `requests.test.ts:254`, `:273`; `request-status.test.ts:105` | Cancelar sem motivo no banco; "Encerrado em" após reabrir (A-26) | Banco + `requests.test.ts` "cancelar sem motivo é recusado"; + `closings.test.ts` (B-49) | Admin Teste | Recusa sem motivo; conclusão anterior visível na lista e no CSV |
| 9 | Prazo vencido é alerta, não estado | `request-status.test.ts:125`; `painel.spec.ts` | — (total) | — | O.S. com prazo ontem | Situação inalterada; alerta no painel e na lista |
| 10 | Encarregado com tarefas em duas obras no mesmo dia | `tests/db/work-and-tasks.test.ts:108`; `campo.spec.ts:7` | — (total) | — | Encarregado Exemplo, Centro e Norte | Cada atividade no local certo |
| 11 | Tarefa avulsa vira atividade do diário sem criar O.S. | `work-and-tasks.test.ts:73`, `:108` | — (total) | — | Encarregado Exemplo | Lançamento no diário; nenhuma O.S. nova |
| 12 | Atividade ligada a tarefa e O.S. aparece uma vez no diário e nos contadores | `work-and-tasks.test.ts:108`; `src/domain/daily-log.test.ts:38`, `:45` | Contadores do painel | Banco + `tests/db/dashboard.test.ts` "atividade ligada a O.S. e tarefa conta uma vez no cartão" | João Exemplo | 1 no diário; 1 no cartão "Atividades registradas" |
| 13 | Orçamento incompleto salva rascunho e não emite; completo gera PDF com texto, valor, prazo, pagamento, garantia, imagens e anexos | `tests/db/quotes.test.ts:167`; `tests/e2e/orcamentos.spec.ts:9`; `src/reports/templates/quote.test.ts:46` | Exigir pagamento, garantia e período; anexos PDF | Banco + `quotes.test.ts` (B-50); E2E + `orcamentos.spec.ts` com anexo (B-52); unit + `quote.test.ts` conferindo cada seção | Orçamento de R$ 4.800,00 | Rascunho salvo; emissão recusada sem garantia; PDF com todas as seções |
| 14 | Aprovação registra a revisão exata, pessoa, canal e data; duas conversões mostram a mesma O.S. | Só aprovação manual: `quotes.test.ts:202` | Revisão exata (A-03); resposta estruturada; conversão em O.S. | Banco + `quotes.test.ts` (B-04); banco novo `tests/db/quote-response.test.ts` (B-54, B-55); E2E + `orcamentos.spec.ts` | Orçamento v1 enviado; cliente alterado depois | `approved_version_no` = 1; uma O.S. ligada; segunda conversão devolve a mesma |
| 15 | Orçamento e contrato emitidos idênticos depois de alterar cliente ou modelo | `src/domain/quote-snapshot.test.ts:41` | Alterar cliente e assinatura depois do envio; contrato | Banco + `quotes.test.ts` "PDF da v1 igual após mudar cliente e assinatura"; banco novo `tests/db/contracts.test.ts` "alterar modelo não muda contrato emitido" | Cliente Exemplo com endereço trocado | Conteúdo da revisão emitida igual, campo a campo |
| 16 | Contrato filtra O.S. pelo cliente; id de outro cliente negado; `.docx` e PDF da mesma revisão | Nenhum (módulo ausente) | Tudo | Banco `contracts.test.ts`; unit novo `src/domain/contract-render.test.ts`; E2E novo `tests/e2e/contratos.spec.ts` | O.S. da Unidade Centro e da Unidade Sul | Só O.S. do cliente na lista; id de outro cliente recusado pelo banco; texto do `.docx` = texto do PDF = texto da revisão |
| 17 | Cliente acessa só relatórios autorizados; nunca documentos pessoais, despesas ou outras empresas | Lateral: `closings.test.ts:150` (payload sem dados financeiros) | Perfil de cliente | Banco `client-isolation.test.ts`; E2E `portal-cliente.spec.ts` | Ana Exemplo | Só fechamentos publicados da Centro; 0 linhas em despesas, reembolsos, jornadas e fichas |
| 18 | Fechamento de setembro mostra pendente a O.S. concluída em outubro; v1 inalterada; correção cria v2 | `closings.test.ts:119`, `:161`; `src/domain/closing.test.ts:107`; `tests/e2e/fechamento.spec.ts:6` | — (total) | — | O.S. aberta em 09/2026, concluída em 10/2026 | Pendente em setembro; v1 igual; v2 com motivo |
| 19 | "SETEMBRO / 2026" no cabeçalho, nome `Relatorio_<Cliente>_Setembro_2026.pdf`, fotos legíveis, páginas e filtros | `fechamento.spec.ts:6`; `tests/db/pdf-long.test.ts:96`; `src/domain/report-naming.test.ts:5`; `src/domain/dates.test.ts:58` | Legibilidade só por inspeção | Manual (§6 e §9.3) | Fechamento de setembro com cerca de 150 fotos | Título e nome corretos; "Página X de Y"; nenhuma foto partida |
| 20 | PDF e CSV com os mesmos critérios; conjuntos não somados duas vezes | `tests/e2e/despesas.spec.ts:21`; `closing.test.ts:152` | CSV de chamados × tela; PDF da lista | E2E novo `tests/e2e/relatorio-os.spec.ts` (B-44) | 20 O.S. em situações variadas | Total da tela = PDF = CSV; conjuntos do fechamento com texto "não somar" |
| 21 | Configuração inativada preserva histórico; nenhuma configuração contorna permissão | `tests/e2e/cadastros.spec.ts:163` | Segunda parte | Banco `permissions.test.ts`; banco novo `tests/db/field-settings.test.ts` | Motivo de pendência inativado; exceção na matriz | Registros antigos mostram o valor; exceção não libera validar nem outro cliente |
| 22 | Colaborador bloqueado perde sessão e anexos; autoria preservada | `requests.test.ts:320`; `cadastros.spec.ts:52`, `:153`; `review-fixes.test.ts:245` | `/api/files` depois do bloqueio; cache (A-28) | E2E + `cadastros.spec.ts` "depois do bloqueio, o link da foto não responde 200 e a resposta tem `no-store`" | João Exemplo bloqueado com sessão aberta | 401 ou 404, nunca 200; registros antigos com o nome dele |
| 23 | Reenvio de upload mantém o formulário e liga as fotos ao registro certo, sem nova O.S. | `requests.test.ts:83` | Rota `/api/uploads` (mesmo `clientUploadId`); reenvio na tela; foto em falha (A-06) | Banco novo `tests/db/uploads-route.test.ts` (padrão de `tests/db/api-health-jobs.test.ts`); E2E novo `tests/e2e/upload-falha.spec.ts` | 3 fotos, 1 com falha simulada | Envio bloqueado até reenviar ou retirar; mesmo anexo no reenvio; uma O.S. |
| 24 | Backup e restauração em ambiente seguro recuperam registros e arquivos | `tests/db/backup-files.test.ts`; execução manual de 31/10/2026 com ressalva | Base limpa; cópia do Drive real | Manual (§8), registrado em `docs/10` | Base do seed | Contagens iguais; todos os arquivos conferidos; base e bucket descartáveis removidos |
| 25 | Compra de R$ 1.000,00 rateada R$ 600,00 + R$ 400,00 mantém R$ 1.000,00 no consolidado, sem exposição ao cliente | `tests/db/expenses.test.ts:43`, `:63`, `:88`; `despesas.spec.ts:21`; `closings.test.ts:150` | Cliente com perfil (Fase 6) | Banco `client-isolation.test.ts` "cliente não lê compras nem rateios" | R$ 1.000,00 = R$ 600,00 + R$ 400,00 | R$ 1.000,00, não R$ 2.000,00; 0 linhas para o cliente |
| 26 | Validação visual em celular estreito, desktop e impressão A4 | `tests/e2e/alvos-toque.spec.ts:26` (412 px, 6 telas do campo); `pdf-long.test.ts:96` | 360 px; desktop; impressão das telas | E2E + `alvos-toque.spec.ts` com 360 px; manual (§9) | — | Sem rolagem lateral; alvos ≥ 44 px; impressão legível |

## 4. Critérios CA-1 a CA-10 (GPT p. 20)

O caderno pede demonstrar com um administrador, um cliente e um colaborador.

| Id | Caso | Teste existente | Falta | Teste novo | Dados | Resultado esperado |
|---|---|---|---|---|---|---|
| CA-1 | Cliente com duas unidades | Equivalente para funcionário (`campo.spec.ts:92`) | Perfil de cliente | `client-isolation.test.ts`; `portal-cliente.spec.ts` (cenário 2) | Ana Exemplo, Centro × Norte | Nada da Norte abre, nem por link direto |
| CA-2 | Cadastros completos | `cadastros.spec.ts:52` (cliente, local, usuário) | Documentos, fotos, ficha do colaborador, unicidade | Banco novos `clients.test.ts`, `client-documents.test.ts`, `collaborators.test.ts`; E2E + `cadastros.spec.ts` | Cliente Exemplo; João Exemplo | Salvar e alterar sem perder histórico; documento duplicado recusado |
| CA-3 | O.S. e pendência | Cenários 3, 5 e 6 | Foto inicial obrigatória (se DP-06) | + `requests.test.ts` (B-30) | Unidade Centro | Número único; pendência exige motivo e providência; execução exige solução e foto |
| CA-4 | Validação e retorno | Cenários 7 e 8 | Conclusão anterior na lista (A-26) | + `closings.test.ts` (B-49) | O.S. concluída e reaberta | Devolver com motivo ou concluir; reabrir preserva conclusão e justificativa |
| CA-5 | Orçamento completo | Cenário 13 | Anexos PDF; assinatura congelada | Ver cenário 13; + `quote-snapshot.test.ts` (B-53); manual do PDF (§6 e §9.3) | Orçamento de R$ 4.800,00 | PDF com descrição, valor, prazo, pagamento, garantia, texto livre, imagens, anexos escolhidos, assinatura e data |
| CA-6 | Orçamento aprovado | Nenhum | Conversão em O.S. | `quote-response.test.ts`; + `orcamentos.spec.ts` (cenário 14) | Orçamento aprovado | O.S. ligada à revisão aprovada; repetir mostra a mesma |
| CA-7 | Contrato editável | Nenhum | Módulo inteiro | `contracts.test.ts`; `contract-render.test.ts`; `contratos.spec.ts` (cenário 16) | Modelo de teste | Cliente filtra O.S.; variáveis preenchidas; PDF e Word com o mesmo texto e revisão |
| CA-8 | Tarefas e diário | Cenários 10, 11 e 12 | Contadores do painel | + `dashboard.test.ts` | Encarregado Exemplo | Atividade uma vez, no local e no dia certos |
| CA-9 | Relatórios por período | Cenário 18 | Tipo de data; PDF da lista com filtros | Unit novo `src/domain/request-period.test.ts`; `relatorio-os.spec.ts` (B-42, B-44) | O.S. que atravessa setembro e outubro | Filtros e critérios impressos; fechamento emitido não muda |
| CA-10 | Configuração e recuperação | Cenários 21, 22 e 24 (parciais) | Campo configurável; anexo após bloqueio; restauração na base limpa | `field-settings.test.ts`; + `cadastros.spec.ts`; manual §8 | Campo inativado; João bloqueado | Valores preservados; bloqueado sem acesso; dados e anexos restaurados |

## 5. Segurança

| Tema | O que testar | Arquivo |
|---|---|---|
| Isolamento entre locais (equipe) | Funcionário de outro local não vê O.S., eventos, fotos nem CSV | `tests/db/requests.test.ts:282`; `tests/e2e/campo.spec.ts:92` (existentes) |
| Isolamento entre clientes | Bateria de `03-arquitetura-e-modelo-de-dados.md` §6.6: toda tabela pública, link direto, PDF, CSV, internos, removidos, vínculo encerrado, portal desligado, `has_site_access` sempre falso para cliente | `tests/db/client-isolation.test.ts`; `tests/e2e/portal-cliente.spec.ts` |
| Link direto de anexo | Sem acesso: 404 igual a inexistente; anexo removido: 404 para quem não é admin; resposta com `no-store` | `tests/db/attachment-revoke.test.ts`; `tests/e2e/fotos.spec.ts` |
| Sessão bloqueada | Dados negados na próxima consulta; link de foto sem 200; autoria preservada | `requests.test.ts:320`; `cadastros.spec.ts:153`; caso novo do cenário 22 |
| Permissões | Seed igual ao atual; exceção não passa do piso; ninguém altera a própria permissão; alteração na trilha | `tests/db/permissions.test.ts` |
| Dados pessoais | Funcionário não lê CPF, RG, endereço nem telefone de colega; trilha sem CPF em claro | `tests/db/collaborators.test.ts` |
| Trilha administrativa | Criar usuário, bloquear, senha provisória e encerrar vínculo do cliente gravam o ator real | `tests/db/audit-trail.test.ts` |
| Idempotência | Orçamento, reembolso, obra, O.S. a partir de orçamento, pedido de PDF, versão de fechamento | `quotes.test.ts`, `expenses.test.ts`, `quote-response.test.ts`, `report-queue.test.ts`, `closings.test.ts` |
| Redirecionamento | `base` externo vai para a rota padrão | `src/domain/safe-redirect.test.ts` |
| RLS ligada | Teste "todas as tabelas públicas têm RLS ligada" segue verde depois de cada migração | Existente em `tests/db/` |

## 6. Documentos

| Documento | Verificação | Como |
|---|---|---|
| PDF A4 longo | 30+ páginas, "Página X de Y", nenhuma foto partida na quebra | `tests/db/pdf-long.test.ts:96` (existente); inspeção visual |
| Título do fechamento | "SETEMBRO / 2026" | Inspeção visual; `src/domain/dates.test.ts:58` |
| Nome do arquivo | `Relatorio_<Cliente>[_<Unidade>]_<Mês>_<Ano>[_Resumo][_vN].pdf`, mês por extenso | `src/domain/report-naming.test.ts:5`; `tests/e2e/fechamento.spec.ts:6` |
| PDF da lista de O.S. | Filtros, tipo de data, data de emissão e páginas impressos; total igual à tela e ao CSV | `tests/e2e/relatorio-os.spec.ts` |
| Orçamento | Todas as seções do CA-5; revisão emitida igual depois de mudar cliente e assinatura | `src/reports/templates/quote.test.ts`; `quotes.test.ts` |
| `.docx` igual ao PDF | Texto normalizado do `.docx` = texto do PDF = texto da revisão; mesmo número de revisão nos dois | `src/domain/contract-render.test.ts`; abrir no Word e no LibreOffice (manual) |
| CSV | BOM UTF-8, separador `;`, datas dd/MM/yyyy, valores sem "R$", fórmula neutralizada | `src/domain/csv.test.ts` (existente) |

## 7. Regressão

Antes de cada PR e ao fim de cada fase (`docs/10-checklist-aceite.md`):

```bash
npm run lint && npm run typecheck && npm test && npm run test:db && npm run build
npx next start -p 3100   # em outro terminal
E2E_BASE_URL=http://localhost:3100 npx playwright test
```

Depois de cada migração, no mesmo PR:

```bash
npm run db:types   # regenera src/server/db/database.types.ts
npm run typecheck
```

Regras:

- Bug: escrever o teste, ver falhar, corrigir, ver passar.
- Contagens registradas a cada fase. Cair o número de testes sem explicação é falha.
- Nunca desativar teste para passar.
- Registrar em `docs/10-checklist-aceite.md` o comando, a data e o resultado; dizer o que não foi verificado.

## 8. Backup e restauração antes de migrações

Obrigatório antes das migrações de risco (M-02, M-03, M-04, M-07, M-08, M-09, M-10, M-14, M-24, M-26, M-27).

| Passo | Comando ou ação | Esperado |
|---|---|---|
| 1. Base local limpa (Davi; apaga a base local) | `npm run db:reset` e `npm run seed` | Sem os 110 anexos sem arquivo (A-31) |
| 2. Backup | `npm run backup` | Pasta `backups/<data-hora>/` com `db.dump` e `manifest.json` |
| 3. Restauração em base descartável | `npm run restore:test -- backups/<pasta>` | Hash do banco confere; contagens iguais; todo arquivo conferido; todo anexo com arquivo; base e bucket descartáveis removidos |
| 4. Migração no local e na homologação | `supabase db push` na homologação (B-79); `npm run test:db` | Verde |
| 5. Diagnóstico na produção (só leitura) | Consulta da migração, mostrada ao Davi com o impacto | Davi confirma |
| 6. Aplicação na produção | `supabase db push`, com o OK do Davi | Sem erro |
| 7. Conferência | Contagens, somas e constraints validadas | Iguais ao previsto |

Nunca restaurar sobre a produção (`docs/08-operacao.md` §5). Com o workflow diário ligado (B-76), o passo 2 pode usar a cópia do Google Drive, seguindo `docs/08` §4.

## 9. Verificação manual

### 9.1 Celular estreito

- Android real, largura de 360 px, rede móvel; roteiro de `docs/09-manual-por-perfil.md`.
- Telas: Hoje, Chamados, detalhe da O.S., Registrar, Concluí, Não consegui concluir, Tarefas, Minhas atividades.
- Conferir: sem rolagem lateral; botões de pelo menos 44 px; teclado não cobre o campo ativo; câmera abre direto; foto com falha mostra "Tentar de novo" e bloqueia o envio; leitura ao sol.
- Registrar tempo de envio de 3 fotos e problemas em `docs/12-revisao-ux-mobile.md`.

### 9.2 Desktop

- Larguras de 1366 e 1920 px.
- Painel, lista de O.S. com filtros, detalhe com abas, agenda, diário, orçamento, contrato, configurações.
- Conferir: tabelas legíveis; filtros mantidos ao voltar; estados vazios com ação; mensagens de erro claras.

### 9.3 Impressão A4

- PDFs: O.S. individual, lista filtrada, diário, fechamento detalhado e resumo, orçamento, contrato.
- Conferir: margens; cabeçalho com dados da empresa; título com mês por extenso; "Página X de Y"; fotos legíveis em duas colunas, sem corte na quebra; filtros e critérios impressos; nenhum dado interno no PDF do cliente.
- Imprimir em papel pelo menos o fechamento e o orçamento.
