# 05 — Fluxos e telas

> Etapa 1 — 25/10/2026. Wireframes textuais; nenhuma tela foi construída. IDs de tela são os usados em 02 e 06.

## 1. Diretrizes de interface

- **Campo (CMP) é mobile-first**: largura base 360 px, alvos de toque ≥ 44 px, barra de ação fixa no rodapé, 1 tarefa por tela, texto direto ("Registrar o que foi feito", "Tirar foto", "Não consegui concluir", "Enviar para conferência").
- **Admin (ADM) é desktop-first, responsivo**: tabelas com filtros persistentes na URL; no celular viram cartões.
- **Cliente (CLI)**: só no cenário A; mobile-first, leitura.
- Identidade: laranja Megagyn (primária, ajustada para contraste AA sobre branco: ex. `#D97706`-ish em texto, laranja claro só em fundos), cinza-escuro `#1F2937` para texto, fundo claro `#F8FAFC`. Logo real via upload (o embutido nos PDFs tem 206×105 px).
- Estados obrigatórios em toda tela: carregando (skeleton), vazio (empty state com ação), erro (mensagem + repetir), sucesso (toast + navegação). Formulários: label visível, erro junto ao campo, foco visível, sem cor como único indicador (ícone + texto no status).
- Upload: fila visível por foto (enviando / concluído / falhou → "Tentar novamente"); o botão principal só habilita quando as fotos obrigatórias estão `concluido`.
- Rede instável: todo envio tem `client_request_id`; duplo toque reenvia o mesmo id e recebe o mesmo registro (T-A17).

## 2. Navegação por perfil

```
/login · /recuperar-acesso · /acesso-negado                      (AUTH)

/admin                                                            (admin, sidebar)
  ├─ /dashboard                 ADM-01
  ├─ /clientes[/id]             ADM-02   (contatos do cliente, unidades)
  ├─ /locais[/id]               ADM-03   (obras e unidades, ambientes, equipe vinculada)
  ├─ /usuarios[/id]             ADM-04
  ├─ /chamados                  ADM-05   lista + filtros + CSV
  │    ├─ /novo                 ADM-07   abrir em nome do cliente
  │    └─ /[numero]             ADM-06   detalhe, triagem, atribuição, timeline, validação, PDF da OS
  ├─ /agenda                    ADM-08   dia/semana · por pessoa · por obra · alocação
  ├─ /diario                    ADM-09   por local e período (projeção)
  ├─ /atividades                ADM-10   work entries, revisão/ajuste com histórico
  ├─ /despesas[/id]             ADM-11   conferência, filtros, comprovantes, CSV
  ├─ /reembolsos                ADM-12
  ├─ /horas                     ADM-13   jornada/diárias por pessoa e regras de valor (COMP)
  ├─ /orcamentos[/id]           ADM-14   (COMP)
  ├─ /fechamentos[/id]          ADM-15   fechamento mensal, versões, Exportar PDF, publicação (A)
  ├─ /relatorios                ADM-16   OS, diário, por pessoa, despesas internas
  ├─ /configuracoes             ADM-17   empresa, logo, catálogos, limites
  └─ /auditoria                 ADM-18

/campo                                                            (worker e foreman, barra inferior)
  ├─ /hoje                      CMP-01   cards grandes
  ├─ /tarefas                   CMP-02   minhas OS/tarefas (foreman: semana multiobra)
  ├─ /tarefas/[id]              CMP-03   detalhe + ações
  │    ├─ /registrar            CMP-04   Registrar o que foi feito (+câmera)
  │    ├─ /impedimento          CMP-05   Não consegui concluir
  │    └─ /concluir             CMP-06   Concluí (solução + foto de resultado)
  ├─ /atividades                CMP-07   minhas atividades lançadas
  ├─ /compras                   CMP-09   (foreman) minhas compras e devoluções
  ├─ /compras/nova              CMP-08   (foreman) registrar compra com rateio
  └─ /horas                     CMP-10   horas do dia (COMP)

/cliente                                                          (SÓ CENÁRIO A)
  ├─ /resumo                    CLI-01
  ├─ /chamados/novo             CLI-02
  ├─ /chamados[/numero]         CLI-03   lista, status, detalhe, comentários
  ├─ /fotos                     CLI-04   galeria autorizada
  └─ /relatorios                CLI-05   publicados (download do PDF)
```

## 3. Inventário de telas

| ID | Tela | Perfil | Prioridade | Desktop | Mobile | Cenário |
|----|------|--------|-----------|---------|--------|---------|
| AUTH-01 | Login | todos | P0 | ✔ | ✔ | A/B |
| AUTH-02 | Recuperar acesso | todos | P0 | ✔ | ✔ | A/B |
| AUTH-03 | Acesso negado / usuário inativo | todos | P0 | ✔ | ✔ | A/B |
| ADM-01 | Dashboard | admin | P1 | ✔ (grade de cards) | cartões empilhados | A/B |
| ADM-02 | Clientes: lista, detalhe, contatos | admin | P0 | ✔ | ✔ | A/B (em A: botão "Convidar para o portal") |
| ADM-03 | Locais (obras/unidades), ambientes, equipe vinculada | admin | P0 | ✔ | ✔ | A/B |
| ADM-04 | Usuários e permissões (papel, vínculos, ativar/inativar) | admin | P0 | ✔ | ✔ | A/B |
| ADM-05 | Chamados: lista, filtros, CSV | admin | P0 | tabela | cartões | A/B |
| ADM-06 | Chamado: detalhe, triagem, atribuição, timeline, validação, nota interna, PDF OS | admin | P0 | 2 colunas | 1 coluna + abas | A/B |
| ADM-07 | Novo chamado em nome do cliente (origem, canal, solicitante, foto) | admin | P0 | ✔ | ✔ | A/B |
| ADM-08 | Agenda: dia/semana, por pessoa/obra, criar tarefa, desdobrar por local | admin | P1 | ✔ | lista do dia | A/B |
| ADM-09 | Diário de obra por local/período (projeção) + PDF | admin | P1 | ✔ | ✔ | A/B |
| ADM-10 | Atividades: lista, revisão/ajuste com histórico | admin | P1 | ✔ | ✔ | A/B |
| ADM-11 | Despesas: lista, filtros, detalhe, aprovar/devolver, comprovante, CSV | admin | P1 | ✔ | ✔ | A/B |
| ADM-12 | Reembolsos: pendentes/parciais/quitados, registrar quitação | admin | P1 | ✔ | ✔ | A/B |
| ADM-13 | Horas/diárias por pessoa e mês; regras de valor por contrato (COMP) | admin | P2 | ✔ | ✔ | A/B |
| ADM-14 | Orçamentos: lista, editor de itens, fotos, preview, PDF, aceite manual, duplicar (COMP) | admin | P2 | ✔ | leitura | A/B |
| ADM-15 | Fechamento mensal: seletor cliente/unidade/mês, prévia resumo/detalhado, **Exportar PDF**, versões, publicação | admin | P0 | ✔ | leitura + botão | A/B (publicar só em A) |
| ADM-16 | Relatórios: OS, diário, atividades por pessoa, despesas internas; CSV | admin | P1 | ✔ | ✔ | A/B |
| ADM-17 | Configurações: empresa, logo/assinatura, catálogos, limites de upload, textos padrão | admin | P0 | ✔ | ✔ | A/B |
| ADM-18 | Auditoria essencial (filtro por entidade/ator/período) | admin | P2 | ✔ | ✔ | A/B |
| CMP-01 | Hoje (cards grandes) | worker/foreman | P0 | — | ✔ | A/B |
| CMP-02 | Minhas OS/tarefas (dia; foreman: semana multiobra agrupada por obra) | worker/foreman | P0 | ✔ simples | ✔ | A/B |
| CMP-03 | Detalhe OS/tarefa com ações Iniciar / Registrar / Fotos / Impedimento / Concluir | worker/foreman | P0 | ✔ simples | ✔ | A/B |
| CMP-04 | Registrar o que foi feito (descrição, data da atividade, fotos, materiais, horas, participantes) | worker/foreman | P0 | — | ✔ | A/B |
| CMP-05 | Não consegui concluir (motivo, explicação, providência, responsável próxima ação, previsão) | worker/foreman | P0 | — | ✔ | A/B |
| CMP-06 | Concluí (solução + ≥1 foto de resultado) | worker/foreman | P0 | — | ✔ | A/B |
| CMP-07 | Minhas atividades (histórico, filtro por obra/período) | worker/foreman | P1 | ✔ | ✔ | A/B |
| CMP-08 | Registrar compra com comprovante e rateio | foreman | P1 | — | ✔ | A/B |
| CMP-09 | Minhas compras (em conferência, devolvidas, aprovadas; reembolso) | foreman | P1 | ✔ | ✔ | A/B |
| CMP-10 | Horas do dia por obra (COMP) | worker/foreman | P2 | — | ✔ | A/B |
| CLI-01 | Resumo das unidades, chamados ativos/concluídos, últimas fotos, relatórios | client | — | ✔ | ✔ | **só A** |
| CLI-02 | Abrir chamado (unidade autorizada, setor, título, descrição, fotos) | client | — | ✔ | ✔ | **só A** |
| CLI-03 | Meus chamados: lista, status, detalhe (eventos públicos), comentários | client | — | ✔ | ✔ | **só A** |
| CLI-04 | Galeria autorizada | client | — | ✔ | ✔ | **só A** |
| CLI-05 | Relatórios publicados (download PDF) | client | — | ✔ | ✔ | **só A** |

P0 = primeira fatia vertical e fundação; P1 = operação completa de campo e financeiro; P2 = complementos.

## 4. Wireframes dos fluxos prioritários

### 4.1 CMP-01 — Hoje (celular)

```
┌──────────────────────────────┐
│ ☰  Olá, João         sáb 25/10│
│ Obra: [Park dos Alpes ▾]      │   ← só se o usuário tem >1 local
├──────────────────────────────┤
│ ┌──────────┐ ┌──────────┐    │
│ │ 📋 HOJE   │ │ 🛠 MINHAS │    │
│ │ 3 tarefas │ │ ATIVIDADES│    │
│ └──────────┘ └──────────┘    │
│ ┌──────────┐ ┌──────────┐    │
│ │ ✍ REGISTRAR│ │ 📷 ENVIAR │   │
│ │ SERVIÇO   │ │ FOTO      │    │
│ └──────────┘ └──────────┘    │
│ ┌──────────┐ ┌──────────┐    │
│ │ ⚠ PENDÊN- │ │ 🧾 REGISTRAR│  │ ← só encarregado
│ │ CIAS (2)  │ │ COMPRA    │    │
│ └──────────┘ └──────────┘    │
├──────────────────────────────┤
│ Hoje · Park dos Alpes         │
│ ▸ 2026-000123 Vazamento subsolo│
│   PROGRAMADA · prazo 27/10     │
│ ▸ Tarefa: Vistoria cobertura   │
│   Obra Demo · PREVISTA         │
└──────────────────────────────┘
 [Hoje] [Tarefas] [Atividades] [Mais]
```
Estados: sem tarefas → "Nada programado para hoje. Registrar atividade avulsa"; erro de rede → banner "Sem conexão. Tente novamente".

### 4.2 CMP-03 — Detalhe da OS com ações

```
┌──────────────────────────────┐
│ ← 2026-000123   [EM EXECUÇÃO] │
│ Vazamento no cano do subsolo  │
│ Park dos Alpes · Subsolo      │
│ Prazo 27/10 · Prioridade Alta │
├──────────────────────────────┤
│ Descrição do pedido …         │
│ Fotos iniciais [▣][▣][▣]      │
│ ── Histórico ──               │
│ 24/10 14:02 Iniciado (João)   │
│ 24/10 16:40 Atividade: troca  │
│   de luva… [▣][▣]             │
├──────────────────────────────┤
│ [ ✍ Registrar o que foi feito]│  ← primário
│ [ ✅ Concluí ]  [ ⚠ Não consegui concluir ] │
└──────────────────────────────┘
```
Botões variam por status: `programada` → "Iniciar"; `pendente` → "Retomar"; `executada` → somente leitura ("Aguardando validação da Megagyn"); `concluida` → leitura.

### 4.3 CMP-04 — Registrar o que foi feito

```
┌──────────────────────────────┐
│ ← Registrar o que foi feito   │
│ Data da atividade  [25/10/2026]│  (padrão hoje; passado até N dias)
│ O que foi feito *             │
│ ┌──────────────────────────┐ │
│ │ Removido entulho do salão │ │
│ └──────────────────────────┘ │
│ Fotos                         │
│ [📷 Tirar foto] [🖼 Galeria]  │
│ [▣ ✓][▣ ✓][▣ ⟳ enviando][▣ ✖ tentar novamente] │
│ Materiais usados (opcional)   │
│ Horas trabalhadas (opcional) [ 9 ] │
│ Quem participou  [João ✓][Pedro] │
│ Resultado: (•) Executado ( ) Parcial ( ) Não executado │
│   └ se parcial/não: motivo ▾ + próximo passo │
├──────────────────────────────┤
│ [        SALVAR REGISTRO      ]│  desabilitado enquanto houver foto "enviando"
└──────────────────────────────┘
```
Resultado: cria `work_entry` (+ evento `atividade` quando há OS). Aparece no diário do dia e local. Se a mesma ação for feita a partir de uma tarefa ligada a uma OS, é **um** registro com os dois vínculos.

### 4.4 CMP-05 — Não consegui concluir

```
Motivo *            [Falta de material ▾]
Explique *          [Faltou luva de 50 mm …]
Providência necessária * [Comprar luva — encarregado]
Quem faz a próxima ação * [Encarregado Carlos ▾]
Previsão de retorno *    [28/10/2026]
Fotos (opcional)    [📷]
[ REGISTRAR PENDÊNCIA ]
```
Bloqueio: sem motivo ou providência → erro no campo, botão não envia (validação também no servidor).

### 4.5 CMP-06 — Concluí

```
Solução aplicada *   [Substituída luva e refeita vedação …]
Fotos do resultado * [📷 Tirar foto] [🖼]   (mínimo 1 concluída)
Materiais usados     [ … ]
Horas (opcional)     [ 9 ]
[ ENVIAR PARA VALIDAÇÃO ]  → status EXECUTADA
```
Se não houver foto de resultado concluída: botão desabilitado + texto "Tire ao menos 1 foto do resultado". O servidor rejeita igualmente (T-A2).

### 4.6 CMP-08 — Registrar compra com rateio (encarregado)

```
Data da compra  [25/10/2026]   Fornecedor [Casa do Construtor ▾ / outro]
Categoria       [Material hidráulico ▾]
Descrição *     [Luvas, cola PVC …]
Valor total *   [R$ 1.000,00]
Pagamento       [PIX ▾]   Quem pagou: (•) Empresa ( ) Eu mesmo → gera reembolso
Comprovante *   [📷 Foto da nota] [📄 PDF]
── Para quais obras? ──
[Park dos Alpes ▾]  R$ [600,00]  finalidade [Cozinha salão]  [×]
[Obra Demo      ▾]  R$ [400,00]  finalidade [Cobertura]      [×]
[+ adicionar obra]
Rateado: R$ 1.000,00 de R$ 1.000,00  ✔ (diferença: R$ 0,00)
[ ENVIAR PARA CONFERÊNCIA ]
```
Diferença ≠ 0 → aviso em vermelho com ícone e botão desabilitado; o banco também rejeita.

### 4.7 ADM-07 — Novo chamado em nome do cliente (admin, ambos os cenários)

```
Cliente *        [Condomínio Demo ▾]    Unidade/Obra * [Torre A ▾]   Setor [Subsolo ▾]
Origem *         (•) Pedido do cliente  ( ) Demanda interna  ( ) Atividade programada
Canal            [WhatsApp ▾]           Solicitante [Maria (síndica) ▾ | + nome livre]
Título *         [Vazamento no subsolo]
Descrição *      [ … ]
Categoria        [Hidráulica ▾]   Prioridade [Alta ▾]   Prazo [27/10/2026]
Fotos iniciais   [⬆ enviar]
Visível ao cliente (•) Sim ( ) Não (demanda interna)
[ Abrir chamado ]   [ Abrir e já programar → responsável + data ]
```

### 4.8 ADM-06 — Detalhe do chamado (desktop, 2 colunas)

```
┌ 2026-000123 · Vazamento no subsolo ─────────────── [ABERTA] prazo 27/10 (⚠ vence em 2 dias) ┐
│ Cliente › Unidade › Setor | Origem: WhatsApp (Maria) | Aberto 24/10 09:12 por Admin          │
├──────────────────────────────────────┬───────────────────────────────────────────────────────┤
│ TRIAGEM                               │ LINHA DO TEMPO                                        │
│ Categoria [Hidráulica ▾]              │ 24/10 09:12 Abertura (Admin) — fotos [▣][▣]           │
│ Prioridade [Alta ▾]  Prazo [27/10]    │ 24/10 09:30 Classificação: Hidráulica/Alta (Admin)    │
│ Responsável [João ▾] Data [26/10]     │ 24/10 09:31 Atribuído a João, programado 26/10        │
│ [ Programar ]                         │ 26/10 08:05 Iniciado (João)                           │
│                                       │ 26/10 11:40 Atividade: troca de luva… [▣][▣] 9h       │
│ AÇÕES                                 │ 26/10 11:41 Execução informada — solução: … [▣]       │
│ [Validar → Concluída] [Devolver p/ correção] │ 🔒 Nota interna (Admin): cobrar fornecedor…     │
│ [Cancelar] [Reabrir] [Imprimir OS PDF]│ [Escrever comentário] (•) Público ( ) Nota interna   │
└──────────────────────────────────────┴───────────────────────────────────────────────────────┘
```

### 4.9 ADM-15 — Fechamento mensal (botão Exportar PDF)

```
┌ Fechamento mensal ────────────────────────────────────────────────────────────┐
│ Cliente [Condomínio Demo ▾]  Unidade [Torre A ▾ | Todas]  Mês [Setembro ▾] Ano [2026 ▾]  [Apurar] │
├───────────────────────────────────────────────────────────────────────────────┤
│ SETEMBRO / 2026 · corte 30/09/2026 23:59:59 (America/Sao_Paulo)   Situação: RASCUNHO │
│ Herdados 3 · Novos 12 · Concluídos 10 · Em aberto 3 (Pendente 2, Programada 1) ·     │
│ Aguard. validação 1 · Cancelados 0 · Reabertos 1 · Dias com atividade 24 · Atividades 41 │
│ [ ] Incluir demonstrativo de diárias (regra vigente: R$ 333,00/diária — 24 un. = R$ 7.992,00) │
│ Modelo: (•) Detalhado com fotos  ( ) Resumo gerencial                                 │
│ [👁 Pré-visualizar]  [⬇ Exportar PDF]  [🔒 Fechar mês (gera v1)]                       │
├───────────────────────────────────────────────────────────────────────────────┤
│ VERSÕES                                                                        │
│ v1 · 01/10/2026 10:14 · Admin · Relatorio_Condominio_Demo_Setembro_2026.pdf · PRONTO [Baixar] [Publicar*] │
│ v2 · 03/10/2026 09:02 · "foto faltante dia 18" · …_Setembro_2026_v2.pdf · PROCESSANDO ⟳ │
│ * Publicar/Revogar só no cenário A; no B registra "entregue por …"               │
└───────────────────────────────────────────────────────────────────────────────┘
```
"Exportar PDF" em rascunho gera prévia marcada "PRÉVIA — não fechado"; após fechar, gera o PDF da versão. Estado do processamento visível (na fila / processando / pronto / falhou → repetir).

### 4.10 PDF do fechamento (estrutura, A4 retrato)

```
Pág. 1  Cabeçalho (logo + dados da empresa configurados) · "RELATÓRIO DE SERVIÇOS PRESTADOS"
        "SETEMBRO / 2026" · Elementos de identificação (contratado, resp. técnico, cliente,
        objetivo, localização, período) · Resumo (contagens por seção, com critério e janela)
Pág. 2+ CHAMADOS: herdados · novos · concluídos (solução, data, fotos) · em aberto no corte
        (motivo, providência, responsável, previsão) · aguardando validação · cancelados · reabertos
Pág. n+ DIÁRIO: "1. Data: 01/09/2026 — Carga horária: 09 horas" · Serviços realizados (lista)
        · Fotos em grade 2 colunas com legenda (break-inside: avoid por atividade)
Pág. m  DEMONSTRATIVO (se habilitado): tabela data · diárias · valor unitário · total · "24 dias · R$ 7.992,00"
Última  Encerramento: local/data, assinatura/rodapé configurados
Rodapé  "Megagyn | site" · "Página X de Y"
```

### 4.11 CLI-02 — Abrir chamado (somente cenário A)

```
Unidade * [Torre A ▾]  (só as autorizadas)   Setor [Subsolo ▾]
Título * [ … ]   Descrição * [ … ]
Fotos [📷 Tirar foto] [🖼]
[ Enviar solicitação ]  → "Chamado 2026-000124 aberto. Você acompanha em Meus chamados."
```

## 5. Fluxos prioritários (sequência)

### F-01 Primeira fatia vertical (ambos os cenários)
ADM-07 abrir com foto → ADM-06 programar (responsável + data) → CMP-01/02 vê na lista → CMP-03 Iniciar → CMP-04 registrar atividade com foto → CMP-06 concluir com foto de resultado → ADM-06 validar → ADM-16 PDF da OS / ADM-15 histórico no fechamento. (Cenário A: CLI-02 abre e CLI-03 acompanha.)

### F-02 Pendência e retomada
CMP-05 → status `pendente` com motivo/providência → ADM-05 filtro "Pendentes por motivo" → encarregado resolve providência → CMP-03 "Retomar" → `em_execucao` → histórico íntegro.

### F-03 Encarregado em duas obras
ADM-08 cria tarefa "Vistoria" com ocorrências em Obra A e Obra B para o mesmo dia → CMP-02 semana mostra as duas, agrupadas por obra → CMP-03 em cada uma: Iniciar / Registrar / Finalizar → ADM-09 diário de cada obra mostra apenas sua ocorrência.

### F-04 Compra rateada → conferência → reembolso
CMP-08 → ADM-11 aprovar (ou devolver com motivo) → edição posterior pelo encarregado invalida → nova conferência → ADM-12 registra quitação do reembolso.

### F-05 Fechamento mensal
ADM-15 apurar → pré-visualizar → fechar v1 → **Exportar PDF** (`Relatorio_<Cliente>_Setembro_2026.pdf`) → correção de origem (ADM-10) → "Gerar nova versão" v2 → ambas baixáveis → (A) publicar v2, revogar v1 se desejado.

## 6. Componentes compartilhados

`StatusBadge` (ícone + texto + cor), `MediaUploader` (câmera/galeria, fila, retry, legenda, ampliar), `Timeline` (eventos com autor/hora/motivo, filtro público/interno), `MoneyInput` (centavos, máscara `R$`), `AllocationTable` (rateio com diferença ao vivo), `DateField` (dd/MM/yyyy, fuso SP), `FilterBar` (persistente na URL, gera CSV da mesma query), `PdfJobStatus` (na fila/processando/pronto/falhou), `EmptyState`, `ConfirmDialog` (ações críticas: cancelar, devolver, fechar mês, revogar).
