# 11 — Revisão de segurança

> F6.2 do plano. Revisão independente feita em 25/10/2026 por um revisor sem participação na implementação, seguida de um passe único de correções e de verificações adicionais em 25 e 26/10/2026. Cada correção tem um teste automatizado que falhou antes dela e passa depois. Ambiente: Supabase local (CLI) e build de produção do Next.js.

## 1. Como o sistema se protege

| Camada | Regra |
|---|---|
| Banco | RLS em todas as tabelas. O papel da pessoa é lido da tabela `profiles` a cada checagem (sem papel no token), então desativar um usuário corta o acesso na hora. |
| Escrita | Mudanças de situação, lançamentos, compras e fechamentos passam por funções `SECURITY DEFINER` com `search_path` vazio, que conferem papel, vínculo com o local e regras de negócio. Gatilho impede alterar a situação de um chamado por fora delas. |
| Histórico | `request_events`, versões de fechamento e versões de orçamento não aceitam alteração nem exclusão, nem pela chave de serviço. |
| Arquivos | Buckets privados, sem nenhuma política de Storage para usuários. Os bytes só saem pela rota do app depois de a pessoa conseguir ler a linha do anexo pela RLS. Anexos só entram pela rota de upload. |
| Chaves | A chave `service_role` existe só no servidor. O navegador não usa cliente Supabase; recebe apenas cookies de sessão `HttpOnly`. |
| Navegador | CSP sem origens externas, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; anexos de imagem com CSP `sandbox`. |

## 2. Achados e correções

| ID | Gravidade | Achado | Correção | Teste |
|---|---|---|---|---|
| C1 | Crítica | Usuário autenticado podia gravar linha em `attachments` apontando para arquivo e tipo arbitrários; a rota servia o conteúdo inline (risco de HTML/script). | Sem INSERT de usuário em `attachments`; CHECK de tipo, chave e derivados; vínculo exige objeto real no Storage; rota de arquivos com lista de tipos e CSP `sandbox`. | `tests/db/review-fixes.test.ts`, `src/domain/file-serving.test.ts` |
| C2 | Crítica | Fechamento mensal perdia eventos e chamados acima de 1000 linhas (limite da API), alterando números do relatório do cliente. | Paginação completa (`fetchAll` + lotes de ids) no fechamento, diário, fotos e listas. | `tests/db/closings.test.ts` (160 chamados), `src/server/paginate.test.ts` |
| I1 | Importante | Redirecionamento aberto nos retornos de login e confirmação (`//`, barra invertida, caracteres de controle). | `safeRedirectPath` em todos os retornos. | `src/domain/safe-redirect.test.ts` |
| I2 | Importante | Comprovante interno de compra podia aparecer como foto no PDF do cliente. | Vínculo exige bucket certo para cada tipo de registro; diário e fechamento do cliente só usam fotos de evidência liberadas. | `tests/db/review-fixes.test.ts` |
| I3 | Importante | Foto de um tipo de registro podia ser vinculada a outro (bucket errado). | `link_attachments` com bucket por entidade e contagem só dos vínculos criados. | idem |
| I4 | Importante | Regra de cobrança marcada como interna aparecia no demonstrativo do cliente. | Filtro `show_in_client_report`. | `tests/db/closings.test.ts` |
| I5 | Importante | Encarregado podia direcionar reembolso a outra pessoa; troca de fornecedor não invalidava a aprovação. | Regras no `expense_save`. | `tests/db/review-fixes.test.ts` |
| M | Menor | `FOUND` lido após `PERFORM`; foto repetida como resultado e intermediária; leitura de "próprias linhas" por usuário inativo; vírgula decimal; fórmula em CSV; cookies sem `HttpOnly`; sem CSP; corpo de upload lido antes de checar tamanho; `in` aceitando nomes herdados; foto original (com GPS) servida a todos. | Corrigidos um a um. | `tests/db/review-fixes.test.ts`, `src/domain/*.test.ts` |

Achados das verificações posteriores (mesma família de risco):

| Achado | Correção | Teste |
|---|---|---|
| Tela de tarefa do campo dava 404 para todos (consulta ambígua) e erros de consulta viravam "não encontrado" em 15 telas. | Ligação explícita; erro de consulta é lançado e registrado. | `tests/db/field-queries.test.ts`, `src/server/query.test.ts` |
| Painel, demonstrativo de diárias e "Minhas compras" contavam no máximo 1000 ou 150 linhas, sem aviso. O demonstrativo enviaria cobrança a menor. | Paginação e resumos com consulta própria. | `tests/db/dashboard.test.ts`, `tests/db/closing-billing-volume.test.ts`, `tests/db/purchases.test.ts` |
| Backup não restaurava (dados do cofre interno do Supabase no dump). | Dump exclui `vault.secrets`. | `npm run backup` + `npm run restore:test` |

## 3. Verificado sem achado

- **Acesso a registro de outra obra por link direto (IDOR):** chamado, foto, CSV e telas da administração respondem "não encontrado" ou acesso negado para quem não tem vínculo. Coberto por `tests/e2e/campo.spec.ts` (isolamento) e `tests/db/requests.test.ts`.
- **Upload malicioso:** tipo conferido pela assinatura binária, não pela extensão; imagens reprocessadas com metadados removidos; limite de tamanho antes de ler o corpo.
- **Segredos:** `.env*` fora do git (exceto `.env.example`); nenhuma chave no código. A varredura de 26/10/2026 encontrou só um log local com as chaves do Supabase local, já removido.
- **Formulários:** ações de servidor exigem sessão e papel; formulários usam POST e bloqueiam envio antes de a página carregar (evita senha na URL).

## 4. Limite de requisições

| Ponto | Proteção atual |
|---|---|
| Login, verificação de link e renovação de sessão | Limites do Supabase Auth por IP (`supabase/config.toml`, `[auth.rate_limit]`; no projeto de produção, em Auth → Rate Limits). |
| E-mails de convite e recuperação | Com SMTP próprio, o limite padrão é baixo (2 por hora). Ajustar ao volume de convites antes do piloto. |
| Upload e geração de PDF | Só para pessoas autenticadas da equipe; PDF só para a administração; upload com limite de tamanho. Não há limite por pessoa no app. |

**Recomendação:** em produção, aplicar limite por IP no proxy reverso ou na plataforma de hospedagem para `/login` e `/api/uploads`.

## 5. Riscos residuais e decisões

- **CSP com `'unsafe-inline'` em script:** exigido pelos scripts de hidratação do Next sem nonce. O ganho real é bloquear origens externas, plugins, `<base>` e envio de formulário para outro site. Nonce exigiria renderização dinâmica em todas as rotas.
- **Equipe de campo age em qualquer chamado do local:** quem tem vínculo com o local pode iniciar ou registrar chamados de colegas. Decisão tomada pelo texto do Word ("demandas da unidade autorizada").
- **Sem autenticação em dois fatores:** recomendável para contas de administração em produção (o Supabase oferece TOTP); exige telas novas.
- **Itens externos não verificados:** Supabase de produção, SMTP, hospedagem, cópia externa dos backups e renderização por Gotenberg.
- **Portal do cliente:** fora do sistema até a decisão Q1. Quando entrar, as políticas do papel `client` precisam de testes de isolamento entre clientes antes do uso.
