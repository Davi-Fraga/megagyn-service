# 08 — Trilha visual

Aprovada pelo Davi em 05/11/2026. Usa a stack que o projeto já tem: React 19 pelo Next 16, servidor Node do Next e Tailwind 4. Nenhuma dependência nova.

## 1. Por que

A base é boa: as telas usam os componentes de `src/ui`, e não sobrou cor fora da paleta Petróleo. Há dois problemas:

- Tabelas e listas são montadas à mão em cada tela. O mesmo cabeçalho de tabela se repete 9 vezes, e a mesma moldura de lista se repete 6.
- A "Régua de obra" (`docs/megagyn/visual/proposta-visual.html`) só chegou ao painel, à O.S. e ao campo. As outras telas só trocaram as cores.

## 2. Decisões

| Decisão | Motivo |
|---|---|
| Sem backend Node separado | O Next já é o servidor Node (server actions e rotas `/api`). Um segundo servidor duplicaria login, deploy e hospedagem |
| Tailwind continua | Trocar por CSS puro ou CSS Modules criaria um segundo jeito de estilizar. As cores já são variáveis CSS em `src/app/globals.css` |
| Sem biblioteca de componentes (shadcn, MUI) | Traz o visual padrão que o Davi quis evitar |
| `@axe-core/playwright` só com aprovação | É dependência nova |
| A régua vai primeiro para as telas que a V4 não reescreve | Cadastros e configurações (Fase 1), agenda e atividades (Fase 2) e diário (Fase 3) recebem a régua dentro dessas fases, para nenhuma tela ser feita duas vezes |
| A trilha vem antes da Fase 0, parte 2 | Produção tinha 0 orçamentos, 0 despesas e 0 reembolsos em 05/11/2026. A parte 2 precisa entrar antes de a Megagyn lançar esses dados |

## 3. Etapas

Uma branch e um PR por etapa. Verificação de toda etapa: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e `npm run test:e2e` contra `next start`.

| # | Etapa | Critério de aceite |
|---|---|---|
| 1 | Componentes `DataTable` e `List` em `src/ui`, sem mudar a aparência | O HTML das 17 telas afetadas é igual antes e depois, exceto pelas diferenças da seção 4.3. As classes repetidas da seção 4.1 não aparecem mais em `src/app` |
| 2 | Histórico da O.S. (`src/ui/request-timeline.tsx`) sem bolinhas e sem "·" | Histórico no estilo da régua; E2E das O.S. passando |
| 3 | Régua de obra em 3 PRs: (a) orçamentos; (b) fechamentos e relatórios; (c) despesas, reembolsos e horas | Capturas antes e depois de cada tela, em 1440 e em 390 px; nada rola para o lado em 360 px; E2E da área passando |
| 4 | Contagens do painel feitas no banco, por uma função nova (migração aditiva) | Mesmos números do `painel.spec`; painel em menos de 2 s com 18 mil chamados na base local; a função aceita os indicadores do B-28 sem ser refeita; protocolo de migração do `03` §8 |
| 5 | Capturas novas em `docs/megagyn/visual/app-*.png` | Feitas depois do `db:reset` do Davi (B-02), sem resíduo de teste |

Ficam no backlog da V4: "Tarefas de hoje" e os 4 indicadores do painel (B-28), os contadores no menu e os alvos de 44 px em celular real (B-41).

## 4. Etapa 1 em detalhe

### 4.1 O que se repete hoje

- Tabela "régua", em `admin/page.tsx` e `admin/chamados/page.tsx`: cabeçalho `border-b border-grafite pb-2 pr-5 font-semibold`; linha `align-top hover:bg-concreto/45 [&>td]:border-b [&>td]:border-linha`.
- Tabela "caixa", em clientes, despesas, locais, orçamentos e usuários: moldura `overflow-x-auto rounded-panel border border-linha bg-papel`; cabeçalho `border-b border-linha bg-concreto text-sm text-muted`.
- Lista "caixa", em agenda, atividades, auditoria, fechamentos, horas e relatórios: `divide-y divide-linha overflow-hidden rounded-panel border border-linha bg-papel`.
- Lista "sangria", no campo (início, chamados, horas e tarefas): `-mx-4 divide-y divide-linha border-y border-linha`.

As tabelas compactas dentro de painéis ficam como estão: rateio de despesas, itens do orçamento, horas a conferir, `allocation-table` e `closing-view`. Cada uma tem espaçamento e rodapé próprios, e duas já são componentes.

### 4.2 Componentes

`src/ui/data-table.tsx`, componente de servidor:

```tsx
<DataTable
  variant="boxed"            // "ruler" | "boxed"
  minWidth="min-w-[40rem]"   // classe literal, para o Tailwind gerar
  rows={clients}
  rowKey={(c) => c.id}
  columns={[
    { header: "Cliente", cell: (c) => … },
    { header: "Locais", align: "right", cell: (c) => … },
    showExtra && { header: "…", cell: (c) => … },   // coluna condicional
  ]}
/>
```

- Cada coluna aceita:
  - `header` e `cell`;
  - `align` ("right");
  - `className`, para a célula: fixa ou calculada por linha, como o texto apagado quando falta responsável;
  - `headerClassName`;
  - `padY`, que troca o padding vertical padrão da célula (`py-4` na régua, `py-2.5` na caixa).
- Na régua, o padding horizontal depende da posição: a primeira coluna tem `pl-4 pr-5`, as do meio `pr-5` e a última `pr-1`.
- O componente devolve, célula por célula, o mesmo conjunto de classes de hoje. O `cn` do projeto só junta strings e não resolve conflito entre classes.

`src/ui/list.tsx`:

```tsx
<List variant="boxed">…<li>…</li>…</List>   // "boxed" | "bleed"
```

### 4.3 Diferenças aceitas no HTML

- Todo `th` ganha `scope="col"`, como a régua já tinha. Muda a acessibilidade, não a aparência.
- O último `th` do painel ganha `font-semibold`. Ele só tem texto `sr-only` ("Ação"), então nada muda na tela.

### 4.4 Ordem

1. Testes de `DataTable` e `List` (`src/ui/data-table.test.ts`, `src/ui/list.test.ts`, com `react-dom/server`) falhando, depois os componentes.
2. Troca nas 7 tabelas grandes.
3. Troca nas 11 listas.
4. Comparação do HTML das 17 telas, antes e depois, com o build de produção. O script fica fora do git (`.superpowers/sdd/trilha-visual/`).
5. Lint, typecheck, unitários, build e E2E completo.

## 5. Etapa 4 em detalhe

### 5.1 O que acontece hoje

O painel (`src/server/dashboard.ts`) baixa todos os chamados do filtro, de mil em mil, só para contá-los no servidor do Next. Em 06/11/2026 a base local tinha 27,6 mil chamados, e o painel levou 88 s por carga (mediana de 7 cargas no `next start`). Os chamados vêm de `tests/db/dashboard.test.ts`, que insere 1050 a cada rodada.

### 5.2 Função

`public.dashboard_summary(p_today, p_from, p_to, p_client_id, p_site_id, p_person_id, p_attention_size)` devolve um `jsonb`.

- Só leitura e `security invoker`: vale a RLS de quem chama, a mesma das listas que os cartões abrem (B-11).
- Indicador novo, como os do B-28, entra como chave nova no `jsonb`, com a mesma assinatura.
- Chaves:
  - `requests`: por situação, em aberto, prazo vencido, novos hoje e pendências por motivo e por responsável;
  - `attention`: total e as linhas de "O que precisa de você", já com número e título;
  - `work_entries`: total e contagem por local;
  - `active_sites`;
  - `open_quotes`: quantidade e valor.
- Os filtros repetem os da lista de chamados (`src/server/request-list.ts`), da lista de atividades e da lista de locais.

Ficam fora da função as despesas e as tarefas de hoje. Elas já usam a mesma função das listas que abrem (`listExpenses` e `listOccurrences`), e a janela delas é curta. Repetir a regra no banco criaria um segundo cálculo, que poderia divergir da lista.

### 5.3 Diferença aceita na tela

As pendências por motivo e por responsável passam a aparecer da maior para a menor. Antes, a ordem seguia o id dos chamados.

### 5.4 Ordem

1. Testes em `tests/db/dashboard.test.ts`, falhando. Cada contagem tem de ser igual ao total de `listRequests` com o mesmo filtro, também acima de 1000 chamados. Há casos para pessoa desligada do chamado, para a ordem da fila e para funcionário sem acesso ao local.
2. Migração `20261106000100_dashboard_summary.sql` aplicada no banco local, depois `npm run db:types`.
3. Painel lendo a função.
4. Tempo medido com a mesma base local da seção 5.1.
5. `db:reset` e seed do Davi, depois a verificação completa com o `painel.spec`.
6. Em produção, o banco vem antes do app (`03` §9): a migração é aplicada com o OK do Davi antes do merge.

### 5.5 Achado: a regra de acesso rodava linha a linha

Com a função, o painel caiu para 4,2 s, e a meta é menos de 2 s. O resto vinha da RLS. A leitura de chamados e de atividades chamava `has_site_access(site_id)` em cada linha, a cerca de 100 µs por chamada. Um `count(*)` de 30 mil chamados como admin levava 2,5 s.

Decisão do Davi em 06/11/2026: a migração `20261106000200_select_admin_once.sql` troca as duas políticas para `(select public.is_admin()) or public.has_site_access(site_id)`.
- A regra é a mesma para todos os papéis, porque `has_site_access` já aceita o admin.
- O "é admin?" passa a ser decidido uma vez por consulta, e a mesma contagem cai para 12 ms.
- Com 33 mil chamados na base local, o painel ficou em 0,8 s; na `main`, eram 88 s.

As outras políticas com teste por linha ficam como estão, porque o painel não depende delas. Eventos, anexos e ocorrências também crescem com o uso, e o mesmo atalho pode entrar nelas se alguma lista ficar lenta.
