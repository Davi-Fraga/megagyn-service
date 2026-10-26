# 01 — Visão de produto: Megagyn Service

> Etapa 1 (diagnóstico e planejamento) — 25/10/2026. Documento de planejamento; nenhuma linha de código foi escrita.
> Fontes: `Escopo Sistema Megagyn Service.docx` (fonte principal), `Relatório de Serviços setembro 2026 - Megagyn Reformas.pdf` (referência de relatório), `Orçamento - Megagyn Reformas.pdf` (referência de proposta) e `Prompt.md` V3 (orientações de 25/10/2026).

## 1. Problema

A Megagyn presta serviços de mão de obra ligados à engenharia (reformas, manutenção predial) em condomínios, empresas e obras. Hoje:

- Pedidos chegam por mensagem/telefone e se perdem; não há número único por atendimento.
- O que foi feito em cada dia é reconstruído manualmente a partir de fotos no celular. O relatório mensal de setembro/2026 (35 páginas, 24 dias, ~100 fotos) foi montado à mão em editor de texto.
- Não há visão de "quem está fazendo o quê, onde, com qual prazo e o que parou".
- Compras feitas pelo encarregado beneficiam mais de uma obra e o rateio é feito de cabeça; comprovantes ficam em fotos soltas.
- Propostas comerciais são documentos avulsos com dados cadastrais divergentes entre si (ver §7).

## 2. Objetivos do produto

| # | Objetivo | Como medir no MVP |
|---|----------|-------------------|
| O1 | Todo atendimento nasce com número único e carrega histórico, fotos e situação até o encerramento | Testes de aceite 1, 2, 3 |
| O2 | O trabalhador registra o dia em poucos toques pelo celular, com foto, sem redigitar nada depois | Fluxo "Registrar o que foi feito" em no máximo 4 telas; testes 4, 5, 17 |
| O3 | O diário de obra e o relatório mensal são **projeções** dos registros, não documentos redigitados | Testes 4, 9, 11 |
| O4 | Compras com rateio correto e sem dupla contagem; reembolso controlado | Testes 7, 8, 13 |
| O5 | Fechamento mensal versionado, exportável em PDF A4 com "MÊS / ANO" no título e no nome do arquivo | Testes 11, 12 |
| O6 | Acesso restrito por papel + cliente + obra, inclusive em arquivos e links diretos | Testes 10, 15 |
| O7 | Orçamentos padronizados a partir do cadastro da empresa (complemento) | Teste 14 |

## 3. Atores

| Ator | Origem | Situação | Resumo |
|------|--------|----------|--------|
| **Administrador Megagyn** | Word §2 | Confirmado | Gerencia cadastros, faz triagem, atribui, valida, aprova despesas, fecha o mês, emite PDFs. **Em qualquer cenário pode abrir chamado em nome do cliente**, registrando origem e solicitante externo. |
| **Responsável do cliente** | Word §2 | **PENDENTE** (ver [07-questoes-de-negocio.md](07-questoes-de-negocio.md), Q1) | Previsto no Word: abre chamados com foto, acompanha, comenta e consulta relatórios das unidades autorizadas. Dúvida informal posterior sugere que talvez não tenha login. O planejamento mantém os dois cenários (A: com login / B: sem login). |
| **Funcionário fixo (executor)** | Word §2 | Confirmado | Alocado em unidade(s) do cliente. Vê demandas da unidade autorizada e tarefas atribuídas; registra execução, fotos, materiais, horas, impedimentos. |
| **Encarregado** | Word §2 | Confirmado | Circula entre várias obras. Agenda consolidada multiobra, registra visitas/atividades/soluções/fotos e compras com comprovante e rateio. |

Contexto atual: 2 funcionários fixos + 1 encarregado. **Isso não é limite do sistema** (Word §2 e §10 exigem crescimento sem presumir quantidades).

## 4. Jornadas principais

### J1 — Chamado de ponta a ponta (prioridade máxima; primeira fatia vertical)

```
[Cliente liga / manda WhatsApp]            [Cliente no portal — só cenário A]
            │                                          │
            ▼                                          ▼
  Admin abre chamado                        Cliente abre chamado
  (origem = cliente_externo, canal,         (origem = cliente_portal)
   solicitante, foto inicial)               só nas unidades autorizadas
            └──────────────┬───────────────────────────┘
                           ▼
              Chamado nº 2026-000123 · ABERTA
                           ▼
   Admin faz triagem: categoria, prioridade, responsável, data  → PROGRAMADA
                           ▼
   Executor no celular: "Iniciar"                                → EM EXECUÇÃO
        ├── "Registrar o que foi feito" (texto + fotos + materiais + horas) → work_entry
        ├── "Não consegui concluir" (motivo + providência + previsão)       → PENDENTE
        └── "Concluí" (solução + ao menos 1 foto de resultado)              → EXECUTADA
                           ▼
   Admin valida → CONCLUÍDA   ou   devolve para correção → EM EXECUÇÃO
                           ▼
   Aparece no diário do dia, no dashboard e no fechamento do mês (snapshot)
```

### J2 — Dia do encarregado (multiobra)
Abre "Hoje" → vê tarefas de 2 ou mais obras → em cada uma: Iniciar / Registrar atividade / Fotos / Impedimento / Finalizar → registra compra com comprovante e rateio entre as obras → envia para conferência.

### J3 — Dia do funcionário fixo
Abre "Hoje" → lista de OS/tarefas da sua unidade → registra execução com câmera → informa horas do dia → consulta "Minhas atividades".

### J4 — Fechamento mensal (admin)
Seleciona cliente + unidade + mês → sistema apura snapshot (eventos até 23:59:59 do último dia, fuso America/Sao_Paulo) → pré-visualiza "Resumo gerencial" e "Detalhado com fotos" → **Exportar PDF** gera `Relatorio_<Cliente>_<Mês>_<Ano>.pdf` com título "<MÊS> / <ANO>" → fecha versão v1 → correções geram v2 preservando v1 → (cenário A) publica no portal do cliente.

### J5 — Compra rateada (encarregado → admin)
Compra R$ 1.000,00 → rateio Obra A R$ 600,00 + Obra B R$ 400,00 → comprovante → "Enviar para conferência" → admin aprova ou devolve → reembolso controlado à parte.

### J6 — Orçamento (admin, complemento)
Novo orçamento a partir do cadastro da empresa e do cliente → itens por local (valor global ou detalhado) → fotos do local e referências → PDF A4 → registra aceite manual → opcional: criar obra a partir do orçamento aprovado.

## 5. Limites do MVP

### Dentro (requisito documental — Word §9 "O que compõe a primeira versão")
Cadastros e perfis; chamados/OS com estados; agenda do encarregado; relatório diário; fotografias e comprovantes; despesas com rateio; conferência e reembolso simples; painel; fechamento mensal versionado; PDFs; exportação CSV; histórico e cópias de segurança.

### Dentro (complementos expressamente solicitados no Prompt — rotulados como **COMPLEMENTO**)
- M7 Orçamentos/propostas comerciais básicas com PDF.
- M8 Horas/diárias e demonstrativo de serviços com regra de valor por contrato.
- Experiência mobile simplificada para campo (é reforço de requisito, não escopo novo).

### Fora (Word §9 "Itens a orçar separadamente" + Prompt §8)
Offline/sincronização; WhatsApp, e-mail, push; assinatura/aceite eletrônico; manutenção recorrente automática; estoque; integrações contábeis/financeiras/NF-e/ERP; app nas lojas; PIX/transferência; IA em fotos. Notificações **apenas dentro da plataforma**.

### Condicional (decisão pendente Q1)
Portal do cliente: login, abertura de chamado pelo cliente, comentários do cliente, galeria autorizada, publicação/revogação de relatórios e download pelo cliente.

## 6. Princípios de produto

1. **Fato único, várias visões.** Um `work_entry` alimenta OS, agenda, diário, dashboard e PDF. Nunca duas cópias, nunca soma dupla.
2. **Estado é derivado de eventos.** A situação do chamado em qualquer data é calculada pela trilha de eventos; o fechamento mensal congela essa apuração em versão imutável.
3. **Dinheiro em centavos inteiros.** Três categorias que nunca se somam entre si: custo interno (despesas), valor comercial (orçamento) e valor faturável (diárias/horas).
4. **Dados da empresa são configuração**, nunca constante no código (os PDFs trazem endereço, site, CNPJ e CREA divergentes).
5. **Permissão no servidor e no banco** (RLS + storage privado + URLs assinadas), não só na interface.
6. **Mobile primeiro para campo**: botões grandes, linguagem simples ("Registrar o que foi feito", "Tirar foto", "Não consegui concluir", "Enviar para conferência"), tolerante a rede instável (idempotência).

## 7. O que os documentos realmente dizem (e o que não dizem)

| Tema | Word (escopo) | Relatório set/2026 | Orçamento | Observação |
|------|---------------|--------------------|-----------|------------|
| Razão/nome | "Megagyn Service" | "Megagyn Reformas" / "Megagyn Reforma e Construções" | "Megagyn Reforma e Construções" | Configurável |
| Endereço | — | Av. T-8, nº 548, sala 04, Galeria Via Luma, St. Bueno, Goiânia-GO | Rua 16-A, nº 667, St. Aeroporto, Goiânia-GO | **Divergente** → configurável |
| Site | — | www.megagynreformas.com.br | www.megagynreformas.com | **Divergente** |
| CNPJ | — | 42.232.243/0001-03 | 42.232.243/0001-06 | **Divergente** (dígitos finais) |
| Resp. técnico / CREA | — | Eng. Márcio Roberto P. Leite, "Crea 1018014640-GO" (capa) e "CREA 1018014640 AP" (assinatura) | "CREA 1018014640 AP" | **Divergente** dentro do próprio PDF |
| Telefone | — | (62) 98409-2546 | (62) 98409-2546 | Coerente |
| Identidade visual | — | Logo laranja/cinza "MEGAGYN REFORMAS" com telhado | mesmo logo | Logo embutido tem 206×105 px (baixa qualidade) → **upload de logo real na configuração** |
| Cobrança | — | 24 diárias × R$ 333,00 = R$ 7.992,00; cada dia "09 horas" | item global R$ 7.600,00 | Exemplos, **não tarifas padrão** |
| Valor por extenso | — | — | "R$ 7.600,00 (setembro mil, seiscentos reais)" — **errado** | Sistema gera extenso por função testada |
| Perfil do cliente | Previsto, abre e acompanha chamados | — | — | **Pendente** (dúvida informal posterior) |

Detalhes adicionais e decisões em [02-requisitos-rastreabilidade.md](02-requisitos-rastreabilidade.md) §4 e [07-questoes-de-negocio.md](07-questoes-de-negocio.md).
