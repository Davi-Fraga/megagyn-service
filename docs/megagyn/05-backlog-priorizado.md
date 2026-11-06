# 05 — Backlog priorizado

> Propósito: organizar a evolução V4 em fases e itens verificáveis, na ordem que as dependências exigem, sem cronograma nem custo. Data: 03/11/2026.

Bugs (A-xx): `01-auditoria-plataforma-atual.md` §5. Requisitos por tela: `02-matriz-requisitos-T01-T14.md`. Migrações (M-xx): `03-arquitetura-e-modelo-de-dados.md` §4. Decisões (DP-xx): `06-decisoes-pendentes.md`. Testes: `07-roteiro-de-testes.md`.

## 1. Como ler

- **Esforço relativo:** P (pequeno, poucos arquivos), M (médio, banco + tela + testes), G (grande, módulo novo ou mudança transversal). Sem datas e sem custo.
- **Risco:** Baixo, Médio, Alto (chance de regressão ou de expor dados).
- **Teste:** tipo (unit, banco, E2E, manual) e arquivo previsto. "+" quer dizer caso novo em arquivo existente.
- **Regras de execução para todos os itens:** uma branch e um PR por assunto; bug sempre com teste que falha antes da correção; migração com SQL e impacto mostrados ao Davi antes de rodar; commit, push e merge só com o pedido do Davi; sem dependência nova sem aprovação; sem Prettier.

## 2. Por que esta ordem

As fases seguem o V4 §8 (cadastros → O.S. e campo → diário e relatórios → comercial → configurações e qualidade), com três ajustes:

1. **Fase 0 antes de tudo.** Há 9 bugs de gravidade média confirmados (A-02 a A-09, A-11). Corrigir antes evita construir em cima deles. O backup testado também vem antes da primeira migração.
2. **Portal do cliente numa fase própria, a 6, e condicional.** O portal depende da matriz de permissões (B-24, Fase 1), da trilha dos vínculos do cliente (B-10, Fase 0), da foto removida fora do alcance (B-03, Fase 0) e dos relatórios com critérios guardados (B-48, Fase 3). Ligar antes repetiria o risco A-01. A ativação depende de DP-01.
3. **Operação em trilha paralela.** E-mail, backup diário e troca de hospedagem dependem de contas do Davi, não de código novo. A troca de hospedagem precisa acontecer antes do uso comercial (DP-16), não antes do desenvolvimento.

Bugs de gravidade baixa entram na fase do módulo onde vivem (por exemplo, A-19 na Fase 2, A-26 na Fase 3), para não abrir PRs fora do assunto.

## 3. Fase 0 — correções e proteção

| Id | História | Fonte | Tela | Depende | Risco | Esf. | Critério de aceite | Teste |
|---|---|---|---|---|---|---|---|---|
| B-01 | Como desenvolvedor, quero uma branch de trabalho e a linha de base verificada, para comparar regressões | V4 (Segurança); `docs/10` | — | — | Baixo | P | Branch criada a partir da `main`; lint 0, typecheck 0, unit, banco, build e E2E rodados e números registrados | Regressão completa (`07` §7) |
| B-02 | Como Davi, quero backup e restauração testados antes da primeira migração, para poder voltar | V4 (Segurança); GPT p. 19; `docs/08` §4–5 | — | Davi roda o `db:reset` (A-31) | Médio | P | `npm run backup` e `npm run restore:test` com contagens iguais e todos os arquivos conferidos em base descartável | Manual, cenário 24 |
| B-03 | Como admin, quero que a foto removida saia do alcance de quem não é admin, inclusive por link direto e cache | `docs/02 R-20`; GPT p. 4 | T07 | M-01 | Baixo | P | Funcionário do local recebe 404 no link da foto removida; resposta com `no-store`; fechamento emitido igual | Banco + `tests/db/attachment-revoke.test.ts`; E2E + `tests/e2e/fotos.spec.ts` |
| B-04 | Como admin, quero que a aprovação aponte a revisão enviada e que a situação do orçamento só mude pela RPC | GPT p. 14, p. 19 | T10 | M-03 | Médio | M | Enviar v1, mudar o cliente, aprovar: `approved_version_no` = 1 e o PDF mostra v1; update direto de `status` é recusado | Banco + `tests/db/quotes.test.ts`; unit + `src/domain/quote-snapshot.test.ts` |
| B-05 | Como funcionário, quero ver todos os chamados atribuídos a mim, mesmo em local com mais de 100 chamados ativos | GPT p. 5 | T01 (campo) | — | Baixo | P | Com 150 chamados ativos no local e o atribuído fora dos 100 primeiros, ele aparece em "Hoje" e em "Chamados" | Banco + `tests/db/field-queries.test.ts` (consulta com o filtro no banco); E2E + `tests/e2e/campo.spec.ts` |
| B-06 | Como admin, quero remarcar uma tarefa não realizada sem que ela fique cancelada para sempre | GPT p. 16 | T12 | M-02 | Médio | M | Tarefa de 1 local, não realizada, remarcada: volta a planejada e aceita novo local; tarefa cancelada de verdade continua cancelada | Banco + `tests/db/work-and-tasks.test.ts` |
| B-07 | Como funcionário, quero que uma foto com falha impeça o envio até eu tentar de novo ou retirá-la, para não perder evidência | GPT p. 4, p. 10 | T06, T07 | — | Baixo | P | Com 1 foto em falha, "Salvar registro" fica bloqueado com aviso; ao retirar a foto ou reenviar com sucesso, libera | E2E novo `tests/e2e/upload-falha.spec.ts` (falha simulada na rota) |
| B-08 | Como admin, quero que o orçamento seja salvo uma vez e sem itens duplicados, mesmo com reenvio ou duas abas | GPT p. 19 | T09 | M-06 | Médio | M | Reenvio com a mesma chave devolve o mesmo orçamento; dois salvamentos simultâneos deixam só os itens do último | Banco + `tests/db/quotes.test.ts` |
| B-09 | Como admin, quero que um pagamento de reembolso repetido não seja lançado duas vezes | `docs/02 R-55` | Financeiro | M-04 | Médio | M | Repetir o pagamento com a mesma chave grava 1 linha; total pago por reembolso igual antes e depois da migração | Banco + `tests/db/expenses.test.ts` |
| B-10 | Como admin, quero saber no banco quem criou usuário, trocou senha, bloqueou e tirou acesso de responsável do cliente | GPT p. 4, p. 8 | T04 | M-05 | Baixo | M | Cada ação gera `audit_events` com o ator real; vínculo contato × local encerrado com data, não apagado | Banco novo `tests/db/audit-trail.test.ts` |
| B-11 | Como admin, quero que cada cartão do painel abra uma lista com o mesmo número | GPT p. 5; `docs/02 R-80` | T01 | — | Baixo | M | Para cada cartão, número do cartão = total da lista aberta, com os mesmos filtros | E2E + `tests/e2e/painel.spec.ts` (todos os cartões) |
| B-12 | Como admin, quero que "criar obra a partir do orçamento" nunca crie duas obras | GPT p. 19 | T10 | M-07 | Baixo | P | Duas chamadas simultâneas devolvem a mesma obra | Banco + `tests/db/quotes.test.ts` |
| B-13 | Como desenvolvedor, quero que todo redirecionamento use `safeRedirectPath` | Téc. (A-20) | T07, T12 | — | Baixo | P | `base` igual a `//exemplo.invalid` redireciona para a rota padrão | Unit + `src/domain/safe-redirect.test.ts` |
| B-14 | Como admin, quero que a compra do encarregado só se ligue a O.S. ou ocorrência de local do rateio com acesso | `docs/02 R-50` (A-22) | Financeiro | M-04 | Baixo | P | Ligar a O.S. de outro local é recusado com mensagem clara | Banco + `tests/db/expenses.test.ts` |
| B-15 | Como desenvolvedor, quero `docs/04-modelo-dados.md` coerente com o código | Téc. (A-30) | — | — | Baixo | P | As 4 divergências apontadas corrigidas no texto | Revisão do documento |

**Critério de saída da Fase 0:** B-01 a B-15 concluídos; nenhum A-xx de gravidade média aberto, exceto A-10 (Fase 3); regressão completa verde; backup e restauração testados com evidência registrada.

## 4. Fase 1 — cadastros, locais e permissões (T02–T05, T14 essencial)

| Id | História | Fonte | Tela | Depende | Risco | Esf. | Critério de aceite | Teste |
|---|---|---|---|---|---|---|---|---|
| B-16 | Como colaborador, quero que colegas não leiam meu e-mail e telefone, e que a equipe não leia campos internos dos clientes | GPT p. 7 (A-24) | T03 | M-10 etapa 1; B-02 | Médio | M | Funcionário lê de colegas só nome e papel; não lê `notes_internal` nem `billing_info`; todas as telas seguem funcionando | Banco novo `tests/db/collaborators.test.ts`; E2E completo |
| B-17 | Como admin, quero que o sistema recuse CPF/CNPJ repetido, com ou sem pontuação | Descrição p. 1; GPT p. 6 | T02 | M-08 | Baixo | M | Segundo cadastro com o mesmo número normalizado é recusado com "CPF/CNPJ já cadastrado" | Banco novo `tests/db/clients.test.ts`; unit + `src/domain/registry.test.ts` |
| B-18 | Como admin, quero anexar documentos e fotos ao cliente e ver o histórico ao inativar | Descrição p. 1; GPT p. 6 | T02 | M-12; B-16 | Médio | M | Documento e foto anexados ao cliente; funcionário do local não baixa; inativar pede motivo e mostra a trilha | Banco novo `tests/db/client-documents.test.ts`; E2E + `tests/e2e/cadastros.spec.ts` |
| B-19 | Como admin, quero a ficha do colaborador com CPF, RG, endereço, foto e documentos privados | Descrição p. 1; GPT p. 7 | T03 | M-10 etapa 2; B-16; DP-20 | Médio | G | Ficha salva e alterada; CPF único; só admin e a própria pessoa leem; a trilha não mostra CPF em claro | Banco `tests/db/collaborators.test.ts`; E2E + `cadastros.spec.ts` |
| B-20 | Como admin, quero desligar um colaborador vendo e transferindo as tarefas e O.S. abertas dele | GPT p. 7 (A-12) | T03 | M-13 | Médio | M | Prévia lista pendências; com transferência, atribuições passam para outra pessoa; autoria dos registros antigos intacta | Banco + `tests/db/requests.test.ts`; E2E + `cadastros.spec.ts` |
| B-21 | Como admin, quero registrar no local o horário e as orientações de acesso e os responsáveis | GPT p. 9 | T05 | M-11 | Baixo | P | Campos salvos e exibidos no detalhe do local e na tela do campo; responsável do cliente precisa ser contato do mesmo cliente | Banco + `tests/db/clients.test.ts`; E2E + `cadastros.spec.ts` |
| B-22 | Como admin, quero que orçamento, fechamento e regra de cobrança só aceitem local do mesmo cliente | GPT p. 4, p. 19 (A-18) | T05 | M-09 | Baixo | P | Local de outro cliente é recusado pelo banco; o fechamento não deixa linha órfã | Banco + `tests/db/closings.test.ts`, `quotes.test.ts` |
| B-23 | Como admin, quero escolher o cliente e ver só os locais dele em O.S., orçamento e tarefa | GPT p. 9 | T05, T06, T09, T12 | — | Baixo | P | Nos três formulários, a lista de locais muda com o cliente; local de outro cliente enviado à mão é recusado | E2E novo `tests/e2e/cascata-local.spec.ts` |
| B-24 | Como admin, quero a matriz de permissões por módulo, ação e local, começando igual ao comportamento atual | Descrição p. 1–2; GPT p. 4, p. 8 | T04 | M-14; B-10 | Alto | G | Seed reproduz `04` §4.1; nenhuma tela muda de comportamento; exceção não contorna o piso; ninguém altera a própria permissão | Banco novo `tests/db/permissions.test.ts`; regressão completa |
| B-25 | Como admin, quero na tela do usuário o perfil, os locais, a matriz, o bloqueio e o envio de recuperação | GPT p. 8 | T04 | B-24 | Médio | M | Alterar a matriz pela tela grava na trilha; bloqueio derruba o acesso na próxima consulta | E2E + `cadastros.spec.ts` |
| B-26 | Como admin, quero aviso quando outra pessoa alterou o registro que estou editando | GPT p. 19 (A-25) | T02, T05, T07, T09 | M-15 | Médio | M | Duas abas editando a mesma O.S.: a segunda recebe "registro alterado por outra pessoa" e nada é sobrescrito | Banco + `tests/db/requests.test.ts`; E2E novo `tests/e2e/edicao-concorrente.spec.ts` |
| B-27 | Como admin, quero os dados da empresa conferidos e o CNPJ com dígito verificador | GPT p. 18; `docs/07 Q2` | T14 | DP-15 | Baixo | P | CNPJ inválido recusado na tela; nenhum dado da empresa fixado no código | Unit + `src/domain/registry.test.ts` |

**Critério de saída da Fase 1:** cenários 1, 21 (parte de permissões) e 22 verdes; CA-2 demonstrável com dados fictícios; matriz ativa com seed igual ao atual; nenhuma regressão no E2E.

## 5. Fase 2 — O.S., tarefas e campo (T01, T06, T07, T12)

| Id | História | Fonte | Tela | Depende | Risco | Esf. | Critério de aceite | Teste |
|---|---|---|---|---|---|---|---|---|
| B-28 | Como admin, quero no painel os 4 indicadores do caderno, a lista de atenção e o agrupamento; como funcionário, minhas atividades | GPT p. 5 | T01 | B-11 | Baixo | M | 4 cartões (em aberto, prazo vencido, aguardam validação, tarefas de hoje) com regra escrita; lista de atenção abre o registro; números iguais às listas | E2E + `painel.spec.ts`; banco + `tests/db/dashboard.test.ts` |
| B-29 | Como encarregado ou funcionário autorizado, quero abrir O.S. no meu local | GPT p. 4, p. 10 | T06 | M-16; B-24; DP-02 | Médio | M | Com permissão, abre só no local autorizado, com autor real; sem permissão, recusa no banco | Banco + `tests/db/requests.test.ts`; E2E + `campo.spec.ts` |
| B-30 | Como admin, quero poder exigir foto inicial na abertura | Descrição p. 1; GPT p. 10 | T06 | M-16; DP-06 | Baixo | P | Opção ligada: abrir sem foto é recusado no banco; desligada: comportamento atual | Banco + `requests.test.ts` |
| B-31 | Como usuário, quero ver os limites de arquivo antes de enviar, e o limite de arquivos por envio deve valer | GPT p. 4 (A-15) | T06, T07, T12 | — | Baixo | P | Texto com tipo, tamanho e quantidade antes do envio; com limite 5, a sexta foto é recusada na tela e na rota | Unit + `src/domain/upload.test.ts`; E2E novo `upload-falha.spec.ts` |
| B-32 | Como usuário, quero ser avisado se a legenda não foi salva | Téc. (A-21) | T07, T10 | — | Baixo | P | Falha na legenda mostra aviso e não "salvo" | Unit da ação (padrão de `src/server/query.test.ts`) |
| B-33 | Como funcionário, quero registrar pendência sem data de retorno quando ela não existe, com justificativa | GPT p. 11 | T07 | M-17; DP-07 | Baixo | P | Sem data e sem justificativa: recusa; com justificativa: grava e aparece como alerta no painel | Banco + `requests.test.ts` |
| B-34 | Como admin, quero que reprogramar mudando prazo ou prioridade exija motivo | GPT p. 4 (A-19) | T07 | M-19 | Baixo | P | Mudar prazo sem motivo é recusado; o motivo aparece no histórico | Banco + `requests.test.ts` |
| B-35 | Como admin, quero reabrir e cancelar conforme a regra decidida | GPT p. 3 | T07 | M-19; DP-04 | Baixo | P | A reabertura leva à situação decidida, com motivo, e preserva a conclusão anterior | Banco + `requests.test.ts` |
| B-36 | Como encarregado autorizado, quero validar O.S. executada | GPT p. 4 | T07 | B-24; DP-03 | Médio | P | Só com exceção individual na matriz; sem ela, recusa no banco | Banco `tests/db/permissions.test.ts` |
| B-37 | Como admin, quero a O.S. em abas Solicitação, Atendimentos, Fotos e Histórico, com o interno destacado | GPT p. 11 | T07 | — | Baixo | M | As 4 abas existem; comentários internos marcados; dados iguais aos atuais | E2E + `vertical-slice.spec.ts` |
| B-38 | Como funcionário, quero finalizar a tarefa com observação e fotos | Descrição p. 2; GPT p. 16 (A-14) | T12 | M-18 | Baixo | M | Observação e fotos gravadas e exibidas no encerramento; aparecem no diário | Banco + `work-and-tasks.test.ts`; E2E + `campo.spec.ts` |
| B-39 | Como admin, quero filtrar a agenda por cliente e ver o histórico da tarefa | GPT p. 16 | T12 | — | Baixo | M | Filtro por cliente; histórico com autor, data e motivo de cada mudança | E2E + `tests/e2e/agenda.spec.ts` |
| B-40 | Como admin, quero validar tarefas concluídas, se a Megagyn decidir | GPT p. 16, p. 20 | T12 | DP-05 | Médio | M | Com a opção ligada, tarefa concluída aguarda validação; desligada, comportamento atual | Banco + `work-and-tasks.test.ts` |
| B-41 | Como funcionário, quero usar o sistema num celular estreito e real | V4 §9 cenário 26 | T01, T06, T07, T12 | — | Baixo | P | Sem rolagem lateral e alvos ≥ 44 px em 360 px; roteiro de `docs/09` num Android real com câmera | E2E + `tests/e2e/alvos-toque.spec.ts` (360 px); manual |

**Critério de saída da Fase 2:** cenários 3 a 12 e 23 verdes; CA-3, CA-4 e CA-8 demonstráveis; opções novas desligadas até as decisões; verificação em celular real registrada em `docs/12`.

## 6. Fase 3 — diário, PDFs e CSV (T08, T13)

| Id | História | Fonte | Tela | Depende | Risco | Esf. | Critério de aceite | Teste |
|---|---|---|---|---|---|---|---|---|
| B-42 | Como admin, quero escolher o tipo de data do relatório de O.S.: abertura, atividade, conclusão ou situação no corte | GPT p. 12 | T08 | — | Médio | G | Cada tipo devolve o conjunto certo num caso de teste com O.S. que atravessa meses; o tipo aparece na tela, no PDF e no CSV | Unit novo `src/domain/request-period.test.ts`; banco + `tests/db/closings.test.ts` |
| B-43 | Como admin, quero filtrar por prioridade, categoria e origem, e ver os grupos Abertas, Em andamento, Fechadas e Canceladas | Descrição p. 1; GPT p. 3, p. 12 | T08 | — | Baixo | M | Grupos com o mapeamento do caderno; filtros novos funcionam na tela e no CSV | Unit + `src/domain/request-status.test.ts`; E2E novo `tests/e2e/relatorio-os.spec.ts` |
| B-44 | Como admin, quero imprimir a lista filtrada em PDF, com os filtros impressos, e o CSV com os mesmos critérios | Descrição p. 1; GPT p. 12 | T08 | B-42, B-43 | Médio | M | PDF A4 com filtros, data de emissão e páginas; total do PDF = total do CSV = total da tela | E2E `relatorio-os.spec.ts`; banco + `tests/db/report-queue.test.ts` |
| B-45 | Como admin, quero ver no diário do dia a pendência registrada, sem contar duas vezes | GPT p. 17 (A-10) | T13 | — | Baixo | M | Pendência do dia aparece no diário e no PDF com motivo, providência e previsão; contagem de atividades igual | Unit + `src/domain/daily-log.test.ts`; banco + `work-and-tasks.test.ts` |
| B-46 | Como admin, quero ver no diário a origem (O.S., tarefa, avulsa), as ocorrências do dia e avulsa com responsável e resultado | GPT p. 17 | T13 | — | Baixo | M | Origem visível em cada linha; avulsa sem responsável recusada | Unit + `daily-log.test.ts`; E2E + `campo.spec.ts` |
| B-47 | Como admin, quero CSV do diário e das atividades por pessoa | GPT p. 17 | T13 | — | Baixo | P | CSV com BOM, `;`, dd/MM/yyyy; total igual ao PDF do mesmo filtro | Unit + `src/domain/csv.test.ts`; E2E `relatorio-os.spec.ts` |
| B-48 | Como admin, quero que cada relatório guarde filtros e corte, e que duplo clique não gere duplicatas | GPT p. 19 (A-23) | T08, T13 | M-20 | Baixo | M | Pedido repetido devolve o mesmo PDF; emitir versão duas vezes com a mesma chave cria uma | Banco + `report-queue.test.ts`, `closings.test.ts` |
| B-49 | Como admin, quero ver a data da conclusão anterior de O.S. reaberta e o fechamento usar a situação interna do corte | Téc. (A-26, A-27) | T08 | — | Baixo | P | Lista e CSV mostram a última conclusão; reexportar a v1 não muda o conjunto | Banco + `closings.test.ts` |

**Critério de saída da Fase 3:** cenários 18, 19 e 20 verdes; CA-9 demonstrável; PDFs conferidos em impressão A4 (manual).

## 7. Fase 4 — comercial (T09–T11)

| Id | História | Fonte | Tela | Depende | Risco | Esf. | Critério de aceite | Teste |
|---|---|---|---|---|---|---|---|---|
| B-50 | Como admin, quero emitir orçamento com descrição, valor, período, pagamento, garantia e data, podendo usar só o valor total | Descrição p. 2; GPT p. 13 | T09 | M-23; B-08; DP-08, DP-09 | Médio | M | Rascunho incompleto salva; emissão sem garantia recusada; orçamento só com valor total emitido; orçamentos já enviados intactos | Banco + `quotes.test.ts`; E2E + `tests/e2e/orcamentos.spec.ts` |
| B-51 | Como admin, quero ordenar as fotos, editar legenda e escolher quais entram no PDF | Descrição p. 2; GPT p. 14 | T10 | M-22 | Baixo | M | Nova ordem aparece no PDF; foto desmarcada não entra | Banco + `quotes.test.ts`; unit + `src/reports/templates/quote.test.ts` |
| B-52 | Como admin, quero anexar PDFs ao orçamento | Descrição p. 2; GPT p. 14 | T10 | M-22; aprovação de biblioteca para incorporar | Médio | M | PDF anexado e baixado à parte; incorporar ao fim só depois da aprovação | Banco + `quotes.test.ts`; E2E + `orcamentos.spec.ts` |
| B-53 | Como admin, quero indicar assinante e função, e a assinatura visual congelada na revisão | Descrição p. 2; GPT p. 14 | T10 | B-04; DP-14 | Baixo | P | Trocar a assinatura nas Configurações não muda revisão emitida | Unit + `quote-snapshot.test.ts` |
| B-54 | Como admin, quero registrar a resposta do cliente com pessoa, canal, data e evidência | GPT p. 14 | T10 | M-21; B-04 | Médio | M | Resposta imutável aponta a revisão exata; aparece no histórico do orçamento | Banco novo `tests/db/quote-response.test.ts` |
| B-55 | Como admin, quero gerar ou vincular O.S. a partir do orçamento aprovado, sem duplicar | GPT p. 2, p. 14 | T10 | M-21; B-54; B-12 | Médio | M | Gerar duas vezes mostra a mesma O.S.; vincular O.S. de outro cliente é recusado | Banco `quote-response.test.ts`; E2E + `orcamentos.spec.ts` |
| B-56 | Como admin, quero manter modelos de contrato versionados, com variáveis e prévia | Descrição p. 2; GPT p. 15, p. 18 | T11, T14 | M-24; DP-13 | Médio | M | Alterar modelo cria versão; contratos emitidos não mudam | Banco novo `tests/db/contracts.test.ts` |
| B-57 | Como admin, quero criar contrato com cliente, O.S. do mesmo cliente, datas e texto revisável, e gerar PDF | Descrição p. 2; GPT p. 15 | T11 | M-24; B-56; DP-22 | Médio | G | Escolher cliente filtra as O.S.; id de O.S. de outro cliente é recusado pelo banco; variável sem valor bloqueia emissão; PDF da revisão | Banco `contracts.test.ts`; unit novo `src/domain/contract-render.test.ts`; E2E novo `tests/e2e/contratos.spec.ts` |
| B-58 | Como admin, quero exportar o contrato em Word (`.docx`) com o mesmo texto e revisão do PDF | Descrição p. 2; GPT p. 15 | T11 | B-57; aprovação da biblioteca (`03` §7); DP-12 | Médio | G | `.docx` abre no Word e no LibreOffice; texto normalizado do `.docx` = texto do PDF = texto da revisão | Unit `contract-render.test.ts`; manual (abrir no Word) |
| B-59 | Como admin, quero registrar aceite ou assinatura do contrato como evento separado, com anexo | GPT p. 15 | T11 | B-57; DP-14 | Baixo | P | Exportar não marca como assinado; aceite grava data, responsável e anexo | Banco `contracts.test.ts` |

**Critério de saída da Fase 4:** cenários 13 a 16 verdes; CA-5, CA-6 e CA-7 demonstráveis com dados fictícios; textos contratuais aprovados pela Megagyn (DP-13).

## 8. Fase 5 — configurações avançadas e qualidade (T14)

| Id | História | Fonte | Tela | Depende | Risco | Esf. | Critério de aceite | Teste |
|---|---|---|---|---|---|---|---|---|
| B-60 | Como admin, quero mudar rótulos e textos de ajuda dos campos aprovados | Descrição p. 2; GPT p. 18 | T14 | M-25; DP-10 | Médio | M | Rótulo novo aparece na tela; dado salvo não muda | Banco novo `tests/db/field-settings.test.ts`; E2E + `cadastros.spec.ts` |
| B-61 | Como admin, quero definir obrigatoriedade e visibilidade dos campos aprovados, sem passar do piso de segurança | GPT p. 18 | T14 | M-25; B-24; DP-10 | Alto | G | Campo essencial não desliga; obrigatoriedade configurada nunca afrouxa a RPC; visibilidade vale em tela, PDF e anexo | Banco `field-settings.test.ts` |
| B-62 | Como admin, quero pré-visualizar e ver o histórico das versões das configurações | GPT p. 18 | T14 | B-60 | Baixo | M | Prévia antes de salvar; cada versão com autor e data | E2E + `cadastros.spec.ts` |
| B-63 | Como usuário, quero estados de carregamento e filtros que persistem entre telas | V4 (Telas, UX) | Todas | — | Baixo | M | Telas lentas mostram carregamento; filtros voltam ao retornar à lista | E2E novo `tests/e2e/filtros.spec.ts` |
| B-64 | Como Megagyn, quero ver a demonstração dos casos CA-1 a CA-10 com admin, cliente e colaborador | GPT p. 20 | Todas | Fases 0–5; Fase 6 para CA-1 | Baixo | M | Roteiro de `07` §4 executado com dados fictícios e evidência registrada | Manual + regressão completa |

**Critério de saída da Fase 5:** cenário 21 verde; CA-10 demonstrável; regressão completa verde; `docs/10-checklist-aceite.md` atualizado.

## 9. Fase 6 — portal do cliente (condicional a DP-01)

| Id | História | Fonte | Tela | Depende | Risco | Esf. | Critério de aceite | Teste |
|---|---|---|---|---|---|---|---|---|
| B-65 | Como desenvolvedor, quero a base segura do acesso do cliente publicada desligada | GPT p. 4, p. 8 (A-01) | T04 | M-26; B-03, B-10, B-24, B-48 | Alto | G | Função `client_site_access` própria; `has_site_access` intocada; nenhuma rota do cliente responde com o portal desligado | Banco novo `tests/db/client-isolation.test.ts` |
| B-66 | Como Megagyn, quero prova de que um cliente não vê nada de outro cliente nem de unidade não autorizada | GPT p. 4, p. 20 | Todas | B-65 | Alto | M | Bateria de `03` §6.6 verde: tabelas, link direto, PDF, CSV, internos, removidos, vínculo encerrado | Banco `client-isolation.test.ts`; E2E novo `tests/e2e/portal-cliente.spec.ts` |
| B-67 | Como Davi, quero uma revisão de segurança independente antes de ligar | V4 (Segurança) | — | B-66 | Médio | M | Revisão registrada; achados corrigidos com teste | Revisão + testes dos achados |
| B-68 | Como admin, quero convidar um responsável do cliente e ligá-lo às unidades | Descrição p. 1; GPT p. 6, p. 8 | T02, T04 | B-65 | Médio | M | Convite cria perfil `client` ligado ao contato; vínculo por unidade com trilha | Banco `client-isolation.test.ts`; E2E `portal-cliente.spec.ts` |
| B-69 | Como cliente, quero ver meu painel, abrir O.S., acompanhar e comentar nas minhas unidades | GPT p. 5, p. 10, p. 11 | T01, T06, T07 | M-27; B-68; DP-02 | Alto | G | Abre só nas unidades com permissão; comentário sempre não interno; não vê internos | E2E `portal-cliente.spec.ts` |
| B-70 | Como cliente, quero baixar os relatórios das minhas unidades | GPT p. 4, p. 17 | T08, T13 | B-48; B-65 | Alto | G | Só fechamentos publicados e PDFs da versão do cliente; parâmetro de outra unidade responde 403 | Banco `client-isolation.test.ts`; E2E `portal-cliente.spec.ts` |
| B-71 | Como Davi, quero ligar o portal para um cliente piloto | — | — | B-66, B-67; DP-01 | Médio | P | Portal ligado só para o piloto; desligar volta ao estado anterior | Manual |

**Critério de saída da Fase 6:** cenários 2 e 17 e CA-1 verdes com perfil de cliente real de teste; revisão de segurança concluída; DP-01 decidida por escrito.

## 10. Módulos existentes a preservar e itens fora do escopo

| Id | História | Fonte | Depende | Risco | Esf. | Critério de aceite | Teste |
|---|---|---|---|---|---|---|---|
| B-72 | Como Megagyn, quero o financeiro (compras, rateio, reembolso) preservado e protegido, sem expansão | `docs/02 R-50` a `R-57`; GPT p. 20; V4 (Divergências) | DP-11 | Baixo | M | Nenhum histórico financeiro apagado; correções A-08 e A-22 feitas (B-09, B-14); anulação (M-28) só se DP-11 pedir | Banco `tests/db/expenses.test.ts`, `purchases.test.ts`; E2E `despesas.spec.ts` (cenário 25) |
| B-73 | Como Megagyn, quero horas, diárias e demonstrativo preservados | `docs/02 R-70` a `R-74` | DP-18 | Baixo | P | Demonstrativo igual antes e depois de cada fase | Banco `tests/db/closing-billing-volume.test.ts` |
| B-74 | Como Megagyn, quero saber o que fica fora e precisa de escopo próprio | GPT p. 14, p. 20 | — | — | — | Lista registrada: WhatsApp, funcionamento sem internet, assinatura ou aceite eletrônico, integrações, estoque, notificação por e-mail ou push, dois fatores | — |

## 11. Trilha de operação (paralela, depende de contas do Davi)

| Id | História | Fonte | Depende | Risco | Esf. | Critério de aceite | Teste |
|---|---|---|---|---|---|---|---|
| B-75 | Como usuário, quero receber convite e recuperação de senha por e-mail | GPT p. 4; `docs/14` Task 9 | Conta Brevo (Davi) | Baixo | P | E-mail chega em menos de 1 minuto e fora do spam | Manual (`docs/14` Task 9) |
| B-76 | Como Megagyn, quero backup diário cifrado de dados e arquivos e teste mensal de restauração | GPT p. 19, p. 20; `docs/08` §4 | Segredos no GitHub (Davi) | Médio | P | Workflow verde; restauração com contagens iguais | Manual, cenário 24 |
| B-77 | Como Davi, quero o Gotenberg protegido por senha enquanto o Render for usado | `docs/14` Task 2 | Variáveis no Render e na Vercel (Davi) | Baixo | P | Chamada sem credencial responde 401; `/api/health` com `rendererUp: true` | Manual |
| B-78 | Como Megagyn, quero o sistema numa hospedagem que permite uso comercial antes da operação real | `docs/13` §5; `docs/14` Fase C; DP-16 | Conta Oracle (Davi) | Médio | G | Roteiro de `docs/14` Task 12 cumprido no endereço novo; Vercel e Render desligados depois de 7 dias | Manual + E2E contra o endereço novo |
| B-79 | Como Davi, quero um banco de homologação separado para testar migrações | `docs/08` §2 (homologação e produção separados) | Segundo projeto Supabase Free | Baixo | M | Migrações de risco aplicadas primeiro na homologação, com `test:db` e E2E verdes | Manual |
| B-80 | Como Davi, quero confirmar que a pré-visualização da Vercel não usa o banco de produção | `03` §9 | Painel da Vercel | Médio | P | Variáveis de Preview separadas ou pré-visualização desligada | Manual |

## 12. Resumo

| Fase | Foco | Itens |
|---|---|---|
| 0 | Correções e proteção | 15 (B-01 a B-15) |
| 1 | Cadastros, locais e permissões | 12 (B-16 a B-27) |
| 2 | O.S., tarefas e campo | 14 (B-28 a B-41) |
| 3 | Diário, PDFs e CSV | 8 (B-42 a B-49) |
| 4 | Comercial | 10 (B-50 a B-59) |
| 5 | Configurações avançadas e qualidade | 5 (B-60 a B-64) |
| 6 | Portal do cliente (condicional) | 7 (B-65 a B-71) |
| Preservar e fora do escopo | Financeiro, horas, lista de exclusões | 3 (B-72 a B-74) |
| Operação | E-mail, backup, Gotenberg, hospedagem, homologação, pré-visualização | 6 (B-75 a B-80) |
