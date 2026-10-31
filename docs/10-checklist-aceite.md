# 10 — Checklist dos 18 testes de aceite

> Situação em 31/10/2026, ambiente local (Supabase CLI + build de produção do Next.js com `next start`). "Passou" só quando há teste automatizado executado com o resultado indicado. Cenário em uso: **B** (sem login de cliente — Q1 pendente).

Comandos de verificação usados:

```bash
npm run lint && npm run typecheck && npm test && npm run test:db && npm run build
npx next start -p 3100   # em outro terminal
E2E_BASE_URL=http://localhost:3100 npx playwright test
npm run backup && npm run restore:test
```

Resultado da última execução (31/10/2026):

| Verificação | Resultado |
|---|---|
| Lint e typecheck | 0 erros |
| Testes unitários | 232/232 |
| Testes de banco (RLS, RPCs, gatilhos) | 85/85 |
| Build de produção | OK |
| E2E contra o build de produção | 19/19 (17,2 min) |
| Backup + restauração em banco descartável | banco restaurado, 9/9 contagens, 5.448/5.448 arquivos conferidos no envio e na volta; ver T-A16 |

| # | Critério | Situação | Evidência |
|---|---|---|---|
| T-A1 | Admin abre chamado em nome do cliente, com foto e número único | Passou (cenário B) | `tests/e2e/vertical-slice.spec.ts`; `tests/db/requests.test.ts` (T-A1, incl. clique duplo). Parte "cliente autenticado": **não executado — depende de Q1 (cenário A)**. |
| T-A2 | Triagem, atribuição, execução com foto; bloqueio sem foto/solução | Passou | `vertical-slice.spec.ts` (bloqueio exibido no celular); `requests.test.ts` (T-A2: sem foto, sem solução, foto de outro local, só admin valida). |
| T-A3 | Pendência por falta de material e retomada sem perder histórico | Passou | `campo.spec.ts` (pendência e retomada); `requests.test.ts` (T-A3). |
| T-A4 | Atividade da OS alimenta o diário no dia certo, sem duplicar | Passou | `tests/db/work-and-tasks.test.ts` (T-A4); `src/domain/daily-log.test.ts` (dedupe). |
| T-A5 | Atividade direta sem chamado entra no diário | Passou | `work-and-tasks.test.ts` (T-A5). |
| T-A6 | Encarregado com tarefas em duas obras no mesmo dia | Passou | `campo.spec.ts` (agenda multiobra; esta E2E revelou que a tela da tarefa dava 404 por embed ambíguo, corrigido com `tests/db/field-queries.test.ts`); `work-and-tasks.test.ts` (T-A6: foto de outra obra recusada; um único lançamento com os dois vínculos). |
| T-A7 | R$ 1.000,00 = R$ 600,00 + R$ 400,00; rejeita R$ 0,01 | Passou | `tests/db/expenses.test.ts` (T-A7); `despesas.spec.ts`; `src/domain/money.test.ts`. |
| T-A8 | Alteração pós-aprovação volta à conferência; reembolso independente | Passou | `expenses.test.ts` (T-A8); `despesas.spec.ts`. |
| T-A9 | Fechamento pelo estado no fim do mês (snapshot) | Passou | `src/domain/closing.test.ts`; `tests/db/closings.test.ts`; `fechamento.spec.ts` (chamado concluído em outubro aparece pendente em setembro). |
| T-A10 | Isolamento: campo não acessa outras obras/mídias, nem por link direto | Passou (cenário B) | `campo.spec.ts` (isolamento: 404 no chamado e na foto, acesso negado ao admin, 403 no CSV); `requests.test.ts`. Parte "cliente A × cliente B": **não executado — depende de Q1**. |
| T-A11 | PDF A4 detalhado: cabeçalho, período, dias, horas, fotos, pendências, páginas, demonstrativo | Passou | `tests/db/pdf-long.test.ts` (agosto/2026, 26 dias × 6 fotos pela fila real: 37 páginas, nenhuma foto partida na quebra de página); `tests/db/closing-billing-volume.test.ts` (demonstrativo com 1134 diárias no mês); `fechamento.spec.ts` (download `Relatorio_…_Setembro_2026.pdf`, > 50 KB); inspeção visual das páginas (título "SETEMBRO / 2026", dias numerados com carga horária, fotos 2 colunas, "Página X de Y", planilha de diárias). |
| T-A12 | v1 publicada, correção gera v2, v1 íntegra | Passou | `closings.test.ts` (T-A12, v1 imutável mesmo pela chave de serviço); `fechamento.spec.ts`. |
| T-A13 | CSV com totais corretos e rateios sem duplicar | Passou | `despesas.spec.ts` (CSV: soma do atribuído = total da compra); CSV de chamados usa a mesma consulta da tela (`src/server/request-list.ts`). |
| T-A14 | Orçamento global + detalhado soma certo; validade, garantia, fotos; PDF | Passou | `orcamentos.spec.ts`; `tests/db/quotes.test.ts`; `src/domain/quote.test.ts`; `amount-in-words.test.ts` (R$ 7.600,00 → "sete mil e seiscentos reais"). |
| T-A15 | Usuário inativado perde acesso sem apagar autorias | Passou | `requests.test.ts` (T-A15); `cadastros.spec.ts` (sessão aberta perde acesso; novo login mostra "Seu acesso está desativado"). |
| T-A16 | Restaurar dados e anexos de backup em ambiente de teste | Passou, com ressalva | `npm run backup` + `npm run restore:test`, com os passos do workflow de backup e uma pasta local no lugar do Google Drive (rclone 1.60.1, a versão do CI): banco restaurado em banco descartável, 9/9 contagens iguais, 5.448/5.448 arquivos conferidos, banco e bucket descartáveis removidos. Nesse teste, a segunda execução baixou 0 arquivos, e os arquivos vieram da cópia cifrada, que recusa conteúdo alterado ao decifrar. A conferência "todo anexo tem arquivo" apontou 110 registros sem arquivo, todos criados por execuções antigas dos testes de banco na base local (gravação direta, hoje bloqueada pela correção C1). O teste de banco que criava esses registros agora apaga o que cria. Para uma execução limpa: base nova (`npm run db:reset` + `npm run seed`), que apaga a base local. A execução pelo assistente foi bloqueada pela proteção de ações destrutivas do ambiente; precisa ser rodada pelo usuário. A primeira execução falhou porque o dump trazia `vault.secrets`; o backup passou a excluir esses dados. Cópia externa no Google Drive real: workflow pronto, **pendente (externo)** até cadastrar os segredos e ligar `BACKUP_ENABLED`. |
| T-A17 | Clique duplo / rede instável não duplica registros | Passou | `requests.test.ts` (chamadas simultâneas com a mesma chave), `work-and-tasks.test.ts`, `expenses.test.ts`; formulário reaproveita a chave até o sucesso e bloqueia o botão durante o envio. |
| T-A18 | Custo interno, valor comercial e valor faturável não se somam | Passou | Tabelas e telas separadas; painel com blocos distintos ("não se somam"); `closings.test.ts` verifica que o payload do cliente não contém dados financeiros; nenhuma FK de orçamento para despesa. |

Verificações além dos 18 testes (plano F1.7, F5.6, F6.2 e F6.4):

| Item | Evidência |
|---|---|
| Convite por e-mail: a pessoa cria a própria senha | `tests/e2e/convite.spec.ts` (e-mail lido no Mailpit, senha criada, login no campo) |
| Painel: número do cartão igual ao total da lista | `tests/e2e/painel.spec.ts`; `tests/db/dashboard.test.ts` (1050 chamados) |
| "Minhas compras": valor a receber com todos os reembolsos abertos | `tests/db/purchases.test.ts` |
| Revisão de segurança | `docs/11-revisao-seguranca.md` |
| Uso no celular com 3G simulado | `docs/12-revisao-ux-mobile.md` (aparelho real pendente); `tests/e2e/alvos-toque.spec.ts` barra alvos de toque menores que 44 px e rolagem lateral em 6 telas do campo |
