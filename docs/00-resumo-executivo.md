# 00 — Resumo executivo (1 página)

> Megagyn Service · Etapa 1 concluída em 25/10/2026 · Somente planejamento; nenhum código, dependência, banco ou deploy.

**O que é.** Plataforma web (celular e desktop) para a Megagyn centralizar chamados/ordens de serviço, agenda do encarregado, diário de obra automático, despesas com rateio entre obras, orçamentos básicos e o fechamento mensal por cliente em PDF — substituindo mensagens soltas e o relatório de 35 páginas montado à mão.

**Fontes.** Escopo Word (requisitos contratados: 4 perfis, 7 estados do chamado, diário sem duplicidade, rateio exato, fechamento com corte temporal e versões, PDF/CSV, backup testado); relatório real de setembro/2026 (24 dias, ~100 fotos, 24 diárias × R$ 333,00 = R$ 7.992,00); orçamento real (item global "Cobertura" R$ 7.600,00, fotos do local e de referência, extenso **errado** no original). Os dois PDFs divergem em endereço, site, CNPJ e CREA → todos esses dados viram **configuração**, nunca constante.

**Decisão pendente (bloqueia só o portal).** O Word prevê login para o responsável do cliente; dúvida informal posterior questiona isso. O plano compara **Cenário A** (cliente com login: abre/acompanha chamados, baixa relatórios; +5 telas, +policies, maior superfície de segurança, +~20–25% de esforço) e **Cenário B** (só usuários internos; admin abre em nome do cliente e envia PDF por fora). Em ambos, o admin abre chamados em nome do cliente com origem/canal/solicitante. A modelagem é neutra (`client_contacts` sem conta; `user_id` opcional) e permite decidir depois sem migração destrutiva. Detalhes em [07](07-questoes-de-negocio.md).

**Arquitetura recomendada.** Repositório vazio → Next.js 15 + TypeScript + Tailwind + shadcn/ui; PostgreSQL/Supabase (Auth, Storage privado, RLS); Zod; migrações SQL versionadas; regras críticas em RPC/trigger **e** no servidor; PDFs em HTML/CSS renderizados por Chromium headless em worker assíncrono; dinheiro em centavos; fuso America/Sao_Paulo nas fronteiras de mês. Um app + um worker na mesma imagem Docker; sem microserviços. [03](03-arquitetura.md)

**Cinco riscos de modelagem resolvidos no plano.** (1) Máquina de estados do chamado com pré-condições por transição e trilha append-only; (2) RBAC + escopo por cliente/obra imposto em RLS, RPC e storage; (3) `work_entries` como fonte única — diário e relatório são projeções, nunca somadas a chamados; (4) rateio com trigger deferido (soma exata em centavos; 1.000 = 600 + 400; 0,01 rejeitado) e invalidação de aprovação ao editar; (5) fechamento mensal por `request_status_at(cutoff)` com payload congelado por versão (v1 íntegra após v2). [04](04-modelo-dados.md)

**Exportação confirmada.** Botão **"Exportar PDF"** no fechamento gera A4 paginado com título/cabeçalho "SETEMBRO / 2026" e arquivo `Relatorio_Park_dos_Alpes_Setembro_2026.pdf` (sufixos `_Resumo`, `_vN`), fotos legíveis, numeração "Página X de Y", geração assíncrona com estado.

**Telas.** 3 de autenticação, 18 de administração (desktop-first), 10 de campo (mobile-first, funcionário e encarregado) e 5 de cliente (somente cenário A). Wireframes em [05](05-fluxos-e-telas.md).

**Sequência.** F0 preparação → F1 fundação (dados, auth, RLS, storage, cadastros) → **F2 primeira fatia vertical: admin abre chamado com foto → atribui → executor relata e envia foto → admin valida → PDF/histórico** → F3 campo completo (agenda multiobra, diário, pendências) → F4 financeiro e orçamentos → F5.a fechamento mensal/PDF/CSV/dashboard → F5.b portal (só se A) → F6 qualidade, backup testado, manuais. 18 testes de aceite mapeados por fase em [06](06-plano-por-fases.md).

**Riscos principais.** PDF longo com muitas fotos (mitigado por worker + derivadas); fuso/corte do mês (função única testada); vazamento de dado interno ao cliente (whitelist + teste); backup declarado sem teste (T-A16 só com restauração real); hosting serverless inviabiliza Chromium embutido (alternativa Gotenberg).

**Próximo passo.** Revisar e aceitar este plano; responder Q1 (login do cliente) e, se possível, Q2 (dados cadastrais oficiais) e Q13 (hosting). Com o aceite, a implementação começa por F0/F1 sem depender de Q1.
