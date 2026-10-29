# 13 — Plano de implantação do piloto (opções gratuitas)

> Escrito em 29/10/2026 para colocar o sistema no ar e entregar um escopo ao cliente sem custo mensal. Preços e limites vêm das páginas oficiais e de comparativos de outubro de 2026 (fontes no fim); conferir na página do provedor antes de contratar, porque mudam sem aviso. Decisões de hospedagem eram a pré-condição PC-5 do plano por fases.

## 1. O que a hospedagem precisa suportar

| Necessidade | Por quê |
|---|---|
| Node 22+ e `next start` | app Next.js 16, build já testado |
| Chromium ou um serviço Gotenberg | PDFs de OS, diário, fechamento, despesas e orçamento (`PDF_RENDERER=playwright` ou `gotenberg`; os dois verificados em 29/10/2026 com o relatório de 37 páginas) |
| Memória para o Chromium | relatório mensal com ~150 fotos: Chromium local ou Gotenberg precisam de mais que 512 MB para não falhar |
| Processo contínuo ou agendamento | worker que retoma PDFs interrompidos; opcional, porque o botão "Tentar de novo" existe |
| Corpo de requisição de até 20 MB | comprovantes em PDF; fotos chegam com até ~3 MB porque o celular reduz antes |
| HTTPS | câmera no navegador e cookies `Secure` |
| Supabase | banco, autenticação, e-mails e arquivos; projeto separado por ambiente |

## 2. Comparativo das opções gratuitas

| Opção | Adormece? | Cartão? | Memória | PDFs | Worker | Observações |
|---|---|---|---|---|---|---|
| **Render Free** | sim: 15 min sem tráfego, volta em ~1 min | não | 512 MB, 0,1 CPU | só com Gotenberg em outro serviço | não há worker nem cron gratuitos | 750 h/mês por workspace: um serviço acordado o mês inteiro consome tudo; a documentação diz "não use em produção" |
| **Vercel Hobby** | não | não | serverless | só com Gotenberg externo | só cron diário | corpo da requisição limitado a 4,5 MB; tempo por função limitado; `after()` funciona |
| **Google Cloud Run** | reduz a zero quando ocioso; volta em segundos | sim: conta de faturamento obrigatória, com US$ 300 de crédito por 90 dias | configurável, até 2 GiB sem custo no uso do piloto | Chromium na própria imagem, como testado | Cloud Scheduler chama uma rota | 2 milhões de requisições, 180 mil vCPU-s e 360 mil GiB-s por mês no nível gratuito; CPU é cortada após a resposta se não marcar "CPU sempre alocada" |
| **Oracle Always Free** | não, mas a Oracle pode recolher máquinas ociosas (CPU, rede e memória abaixo de 20% por 7 dias) | sim | 2 OCPU Arm e 12 GB | Chromium na imagem | processo contínuo | é uma VM: Docker Compose, HTTPS, atualizações por sua conta; melhor base para a operação real |
| Railway | não | sim para o trial | — | — | — | US$ 5 de crédito por 30 dias; depois pago. Não é gratuito |
| Fly.io | não | sim | — | — | — | sem nível gratuito para contas novas |
| Koyeb | sim, após 1 h | sim, com pré-autorização | 512 MB, 0,1 vCPU | não | não | nível gratuito incerto após a aquisição em 2026 |
| **Supabase Free** (banco) | pausa após 7 dias sem atividade; religar é manual no painel | não | — | — | — | 2 projetos ativos; dados não se perdem na pausa |

## 3. Recomendação

**Opção B, sem cartão e sem adormecer: Vercel (app) + Gotenberg no Render Free (PDFs) + Supabase Free, com um "despertador" que mantém os três ativos.**

- O app na Vercel não dorme, então o cliente nunca espera para abrir uma tela.
- O Gotenberg só é usado ao gerar PDF. Um monitor externo gratuito chama `/api/health` a cada 5 minutos; a rota toca o Gotenberg, que fica acordado dentro das 750 h mensais por ser o único serviço desse workspace.
- A mesma rota consulta o banco, o que evita a pausa do Supabase. Se o monitor falhar, o primeiro PDF espera o Gotenberg acordar em vez de falhar.
- Custo: zero. Limites a aceitar no piloto: comprovante em PDF acima de 4,5 MB é recusado; retomada automática de PDF só uma vez por dia (o botão "Tentar de novo" cobre o resto).

**Opção A, se puder cadastrar um cartão: Google Cloud Run com a imagem Docker atual.** É o que foi testado, PDF e worker inclusos, com cold start de segundos. Exige conta de faturamento, a ferramenta `gcloud` e marcar "CPU sempre alocada". Zero de custo no uso de um piloto, com alerta de orçamento configurado.

**Opção C, tudo no Render Free:** só se as duas acima não servirem. Com 512 MB e 0,1 CPU, o app fica lento e os PDFs grandes podem falhar; e o despertador do app consome as 750 h, deixando o Gotenberg sem horas.

**Depois do piloto:** Oracle Always Free (máquina de 12 GB, sem dormir) ou Render Starter a US$ 7/mês para o app mais Gotenberg. Decisão com a Megagyn quando o uso real começar.

## 4. Plano por etapas

Responsável: **Davi** = contas, credenciais e decisões; **assistente** = código, scripts e verificação. Nenhuma etapa usa dados reais de clientes: o piloto sobe com o seed fictício e a Megagyn cadastra os dados reais pela tela.

### E0 — Contas e decisões (Davi)

| Tarefa | Critério de conclusão |
|---|---|
| Escolher a opção (B recomendada) | resposta registrada aqui |
| Contas: GitHub (já existe), Vercel, Render, Supabase | conectadas ao repositório `Davi-Fraga/megagyn-service` |
| Domínio: usar `*.vercel.app` no piloto ou um domínio próprio | decidido; HTTPS vem do provedor |
| Dados cadastrais da Megagyn (Q2): razão social, CNPJ, endereço, telefone, site, responsável técnico, CREA | confirmados com o cliente; o logotipo oficial já está no sistema |

### E1 — Supabase na nuvem (Davi cria, assistente configura)

| Tarefa | Critério de conclusão |
|---|---|
| Criar o projeto (região São Paulo), guardar as chaves fora do repositório | `.env.production` local, nunca commitado |
| `supabase link` e `supabase db push` | as 13 migrações aplicadas; buckets `evidence`, `receipts`, `branding`, `reports` e `quotes` privados |
| Auth: desligar auto-cadastro, Site URL do app, URLs de retorno `/auth/callback` e `/auth/confirm`, modelos de e-mail `recovery.html` e `invite.html`, senha mínima 8 | teste de recuperação de senha recebido no e-mail |
| SMTP próprio (ex.: Resend ou Brevo, níveis gratuitos) e limite de e-mails por hora | convite chega em menos de 1 minuto |
| Primeiro administrador e seed fictício (`npm run seed` apontando para a nuvem) | login do admin de demonstração funciona |

### E2 — Adaptações no código (assistente; feita em 29/10/2026 após o OK)

| Tarefa | Arquivos | Critério |
|---|---|---|
| Rota de saúde `GET /api/health`: confere banco e renderizador, sem dados sensíveis | `src/app/api/health/route.ts` | responde 200 com `{ok:true}`; teste de integração |
| Rota de fila `/api/jobs/reports` protegida por segredo, que roda uma passada do worker | `src/server/reports/queue.ts` (extraído de `worker/index.ts`), `src/app/api/jobs/reports/route.ts`, `.env.example` (`CRON_SECRET`, nome que o cron da Vercel envia sozinho) | sem segredo responde 401; com segredo processa PDFs pendentes; worker local continua funcionando |
| Tempo máximo das ações que geram PDF | `maxDuration = 300` nas páginas de fechamento, chamado, orçamento, diário, despesas e relatórios; a geração espera o Gotenberg acordar (`waitForService`) | PDF de 37 páginas conclui na Vercel mesmo com Gotenberg frio |
| Agendamento | `vercel.json` (cron diário para a fila) e `.github/workflows/despertador.yml` (ping diário de reserva). O ping a cada 5 min fica num monitor externo gratuito, UptimeRobot ou cron-job.org, porque no GitHub Actions ele consumiria os minutos gratuitos do mês | monitor ativo; workflow verde |
| Documentação | `docs/08-operacao.md` seção Vercel + Render; `README.md` | passo a passo reproduzível |

Opção A troca as duas últimas linhas por: `PDF_RENDERER=playwright`, serviço Cloud Run com 2 GiB e "CPU sempre alocada", Cloud Scheduler chamando `/api/jobs/reports` a cada 10 minutos, Artifact Registry para a imagem. O `Dockerfile` já respeita a variável `PORT`.

### E3 — Gotenberg no Render (opção B)

| Tarefa | Critério |
|---|---|
| Web Service Docker a partir da imagem `gotenberg/gotenberg:8`, instância Free, região mais próxima | `GET /health` responde 200 |
| Restringir acesso: variável `GOTENBERG_URL` no app e, se o Render permitir, cabeçalho de autenticação básica do Gotenberg | só o app chama o serviço |

### E4 — App na Vercel (opção B)

| Tarefa | Critério |
|---|---|
| Importar o repositório, branch `main` após o merge do PR | build verde na Vercel |
| Variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL` (https), `APP_TIMEZONE`, `PDF_RENDERER=gotenberg`, `GOTENBERG_URL`, `CRON_SECRET` | login, foto e PDF funcionam na URL pública |
| Atualizar Site URL e URLs de retorno no Supabase com a URL final | link de convite abre no app certo |

### E5 — Verificação na URL pública (assistente)

| Critério de aceite | Como |
|---|---|
| Login, chamado com foto, validação, PDF da OS | roteiro de `tests/e2e/vertical-slice.spec.ts` apontando `E2E_BASE_URL` para a URL pública, com usuários do seed |
| Fechamento com PDF de 37 páginas pelo Gotenberg | `Relatorio_..._Agosto_2026.pdf` baixado |
| Convite por e-mail de ponta a ponta | caixa de e-mail real |
| Despertador | após 2 h sem uso, app e PDF respondem em menos de 5 s |
| Celular real (F6.4 pendente) | roteiro de `docs/09-manual-por-perfil.md` em um Android, com foto pela câmera |

### E6 — Entrega ao cliente (Davi)

| Tarefa | Critério |
|---|---|
| Preencher Configurações com os dados reais e conferir a logo nos PDFs | PDF de teste aprovado pela Megagyn |
| Criar os usuários reais por convite e vincular aos locais | 2 funcionários e 1 encarregado entram pelo celular |
| Entregar URL, manual por perfil e lista do que fica fora do piloto (portal do cliente, 2FA, backup externo) | aceite por escrito |

## 5. Limites a vigiar durante o piloto

- **Render:** 750 h/mês e 100 GB de banda por workspace; o Gotenberg é o único serviço gratuito desse workspace.
- **Vercel Hobby:** uso pessoal e não comercial nos termos do plano; se a Megagyn passar a operar de verdade, migrar para plano pago ou para a opção A/Oracle.
- **Supabase Free:** 500 MB de banco e 1 GB de arquivos; fotos de 2560 px gastam ~1 MB cada, então ~800 fotos enchem o espaço. Conferir no painel a cada mês.
- **GitHub Actions:** agendamentos param após 60 dias sem commits no repositório; um commit mensal ou o UptimeRobot (gratuito, checagem a cada 5 min) resolve.

## 6. Fora deste plano

Portal do cliente (Q1), autenticação em dois fatores, backup automático externo (o script `npm run backup` continua manual), domínio próprio e e-mail corporativo.

## Fontes consultadas em 29/10/2026

- Render: [Deploy for Free](https://render.com/docs/free), [Compute plans](https://render.com/docs/compute-plans), [Free instance type](https://community.render.com/t/the-free-instance-type-e-g-512mb-ram-0-1-cpu/39044)
- Google Cloud: [Free cloud features](https://docs.cloud.google.com/free/docs/free-cloud-features)
- Oracle: [Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- Supabase: [Pricing](https://supabase.com/pricing)
- Comparativos: [Railway vs Render](https://northflank.com/blog/railway-vs-render), [Fly.io free tier 2026](https://www.saaspricepulse.com/blog/flyio-free-tier-2026), [Koyeb free tier](https://www.srvrlss.io/provider/koyeb/), [Platforms with a real free tier](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)
