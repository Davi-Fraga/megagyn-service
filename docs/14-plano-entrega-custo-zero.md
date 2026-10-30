# 14 — Plano de entrega sem custo: do piloto à operação real

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development ou superpowers:executing-plans, tarefa por tarefa. Os passos usam caixas de seleção (`- [ ]`).

**Objetivo:** levar o sistema publicado em https://megagyn-service.vercel.app até a operação real da Megagyn, sem gasto mensal e sem o portal do cliente.

**Arquitetura:** Fase A corrige o que já está no ar. Fase B liga e-mail e backup. Fase C troca Vercel + Render por um servidor Oracle Always Free com o `Dockerfile` existente. Fase D valida com a equipe e entrega com base limpa. O Supabase Free continua como banco e arquivos.

**Stack:** Next.js 16.4, Supabase, Playwright/Chromium, Gotenberg 8 (só até a Fase C), Docker Compose, Caddy, GitHub Actions, rclone, Brevo.

**Base:** `docs/02-requisitos-rastreabilidade.md`, `docs/06-plano-por-fases.md`, `docs/08-operacao.md`, `docs/13-plano-implantacao-piloto.md`.

## Decisões pendentes

| # | Decisão | Quem decide | Padrão deste plano | Afeta |
|---|---|---|---|---|
| D1 | Guardar só foto de 1600 px, sem o original de 2560 px | Davi | Sim. Foi a recomendação; ganha ~3× em espaço e perde o original em alta | Task 8 |
| D2 | Cadastrar cartão na Oracle (verificação, sem cobrança nos limites gratuitos) | Davi | Sim. Sem isso, Fase C não acontece e a Vercel Hobby fica só para demonstração | Tasks 11 e 12 |
| D3 | Endereço final: subdomínio da Megagyn, se ela tiver domínio, ou `<ip>.sslip.io` gratuito | Davi + Megagyn | Subdomínio `sistema.` | Tasks 9 e 12 |
| D4 | Dono das contas e manutenção depois da entrega | Davi + Megagyn | Contas seguem com Davi até o contrato dizer o contrário | Task 14 |
| D5 | Login do cliente (Q1) e dados oficiais (Q2) | Megagyn | Q1 fica fora; Q2 é obrigatória na Task 14 | Task 14 |

## Restrições globais

- Custo mensal: US$ 0. Qualquer item pago vira decisão de Davi antes de ser feito.
- Código e nomes em inglês; textos da tela, mensagens de commit e docs em português do Brasil.
- Sem dependência nova no `package.json`. Sem Prettier: formatação à mão, seguindo o estilo vizinho.
- Nunca commitar na `main`; cada grupo de tarefas vai por branch e PR. Commit, push e merge só com o pedido de Davi.
- Senhas, chaves e tokens nunca aparecem em conversa, log ou commit. Valores gerados ficam em `.env.production`.
- Digitar senha ou chave em painel web e criar contas é sempre com Davi.
- Migração, `DELETE`/`UPDATE` em produção e reset de banco: mostrar a query e o impacto, e esperar confirmação de Davi.
- Verificação ao fim de cada fase: `npm run lint && npm run typecheck && npm test && npm run test:db && npm run build`, depois `E2E_BASE_URL=http://localhost:3100 npx playwright test` contra `next start -p 3100`.
- Bug sempre com teste que falha antes da correção.

## Revisão: onde prestar atenção

Situações que o plano original não descreve e que mais podem pegar quem usa o sistema. Cada uma tem teste na tarefa dona.

1. Foto removida depois de um fechamento emitido: some das novas prévias, e a versão emitida fica igual (Task 3).
2. Credencial do Gotenberg errada: o PDF falha com "Tentar de novo", sem ficar girando para sempre (Task 2).
3. Foto de celular na vertical: a versão única mantém a orientação correta, sem EXIF (Task 8).
4. Filtro com data invertida, local inválido ou local de outra obra: a tela abre e não vaza nada (Task 6).
5. Setor de um local que não foi marcado na tarefa: erro claro no campo, em vez de gravar setor errado (Task 4).

---

## Fase A — Sem conta nova e sem custo

### Task 1: Publicar o que já está pronto e tratar arquivo grande

**Arquivos:**
- Modificar: `src/domain/upload.ts`, `src/domain/upload.test.ts`, `src/ui/media-uploader.tsx:97-99`

**Interfaces:**
- Produz: `uploadErrorMessage(status: number, serverError?: string): string`

- [ ] **Passo 1: Escrever o teste** `uploadErrorMessage` em `upload.test.ts`: `413` devolve "Arquivo grande demais. Reduza o PDF ou envie uma foto do comprovante."; `400` com `serverError` devolve o próprio `serverError`; sem mensagem devolve "Falha no envio. Toque em tentar de novo."
- [ ] **Passo 2: Rodar** `npx vitest run --project unit src/domain/upload.test.ts`. Esperado: falha, função inexistente.
- [ ] **Passo 3: Implementar** a função e usá-la no `throw` do uploader, porque a Vercel responde 413 sem JSON.
- [ ] **Passo 4: Rodar o mesmo comando.** Esperado: verde.
- [ ] **Passo 5: Commit** `fix(upload): mensagem clara para arquivo acima do limite da hospedagem`.
- [ ] **Passo 6: Push de `fix/piloto-nuvem`, PR e merge.** Esperado: a Vercel publica; na URL pública, o botão de PDF vem desabilitado com JavaScript desligado.
- [ ] **Passo 7: Mostrar e, com OK, rodar** `update public.company_settings set max_pdf_mb = 4 where id = 1;` no Supabase da nuvem. Impacto: 1 linha. Vale até a Task 12, que volta para 20.

### Task 2: Proteger o Gotenberg e testar o PDF longo nele

**Arquivos:**
- Criar: `src/server/reports/gotenberg-auth.ts`, `src/server/reports/gotenberg-auth.test.ts`
- Modificar: `src/server/env.ts`, `src/server/reports/wait-for-service.ts`, `src/server/reports/wait-for-service.test.ts`, `src/server/reports/render.ts`, `src/app/api/health/route.ts`, `.env.example`, `docs/08-operacao.md` (§2a)

**Interfaces:**
- Produz: `gotenbergAuthHeaders(user: string, password: string): Record<string, string>`; opção `headers` em `waitForService`; `env.gotenbergUser` (`GOTENBERG_USER`) e `env.gotenbergPassword` (`GOTENBERG_PASSWORD`)

- [ ] **Passo 1: Escrever os testes:** `gotenbergAuthHeaders("u","p")` devolve `{ Authorization: "Basic dTpw" }`; com usuário ou senha vazios devolve `{}`; `waitForService` repassa `headers` ao `fetch`.
- [ ] **Passo 2: Rodar** `npx vitest run --project unit src/server/reports`. Esperado: falha.
- [ ] **Passo 3: Implementar** e enviar o cabeçalho nas três chamadas: `/health` da espera, `convert/html` e `/health` da rota de saúde.
- [ ] **Passo 4: Rodar o mesmo comando.** Esperado: verde.
- [ ] **Passo 5: Teste de credencial errada** em `tests/db/report-queue.test.ts`: `renderPdf` com `GOTENBERG_URL` apontando para um servidor local que responde 401 lança `Gotenberg respondeu 401`, e `processReport` marca o pedido como `falhou`.
- [ ] **Passo 6: Commit, push e merge** de `feat(pdf): autenticação básica no Gotenberg`. O app sobe primeiro; como o serviço ainda aceita tudo, nada para.
- [ ] **Passo 7: Gerar** `GOTENBERG_USER` e `GOTENBERG_PASSWORD` no `.env.production`, sem exibir.
- [ ] **Passo 8 (Davi): cadastrar as variáveis.** Vercel: `GOTENBERG_USER`, `GOTENBERG_PASSWORD`, depois redeploy. Render: `API_ENABLE_BASIC_AUTH=true`, `GOTENBERG_API_BASIC_AUTH_USERNAME`, `GOTENBERG_API_BASIC_AUTH_PASSWORD`.
- [ ] **Passo 9: Conferir.** `POST /forms/chromium/convert/html` sem credencial responde 401; `/api/health` traz `rendererUp: true`; prévia do fechamento gera PDF na URL pública.
- [ ] **Passo 10: PDF longo no Gotenberg do Render.** `PDF_RENDERER=gotenberg` com URL e credenciais do Render, `npx vitest run --project db tests/db/pdf-long.test.ts`, usando o banco local. Esperado: 37 páginas. Se faltar memória nos 512 MB, registrar: a Fase C passa a ser obrigatória para relatórios longos.

### Task 3: Remover foto errada (R-20)

**Arquivos:**
- Criar: `tests/db/attachment-revoke.test.ts`, `tests/e2e/fotos.spec.ts`
- Modificar: `src/ui/photo-grid.tsx`, `src/app/admin/chamados/[id]/page.tsx`, `src/app/admin/atividades/[id]/page.tsx`

**Interfaces:**
- Consome: `revokeAttachmentAction(_, fd)` com `attachment_id` e `reason`; `ReasonAction`
- Produz: prop opcional `revokeAction?: ActionFn` em `PhotoGrid`

Fora: comprovantes de compra, porque uma compra aprovada não pode ficar sem nota.

- [ ] **Passo 1: Escrever os testes de banco:** "admin remove foto com motivo: grava evento anexo_revogado e mantém o arquivo"; "funcionário não remove foto" (`42501`); "motivo vazio é recusado" (hint `reason`); "segunda remoção avisa que já foi removido"; "prévia do fechamento deixa de trazer a foto removida e a versão emitida não muda".
- [ ] **Passo 2: Rodar** `npx vitest run --project db tests/db/attachment-revoke.test.ts`. Esperado: verde, pois o banco já faz isso; é a cobertura que faltava. Falha aqui é defeito a corrigir antes de seguir.
- [ ] **Passo 3: Escrever o E2E:** admin abre chamado do seed, clica "Remover foto", informa o motivo e vê "Removida". Rodar e ver falhar: botão inexistente.
- [ ] **Passo 4: Implementar.** Com `revokeAction`, cada foto não removida ganha `ReasonAction` abaixo do cartão, com `hidden={{ attachment_id }}`, `label="Remover foto"`, `confirmLabel="Remover foto"`, `reasonLabel="Por que remover?"`, `variant="danger"`. Só as duas páginas da administração passam a prop.
- [ ] **Passo 5: Rodar o E2E.** Esperado: verde.
- [ ] **Passo 6: Commit** `feat(fotos): administração remove foto com motivo`.

### Task 4: Setor na criação de tarefa (R-25)

**Arquivos:**
- Criar: `src/domain/task-form.ts`, `src/domain/task-form.test.ts`
- Modificar: `src/app/admin/agenda/nova/page.tsx`, `src/server/actions/tasks.ts:24-40`, `tests/e2e/campo.spec.ts`

**Interfaces:**
- Produz: `buildOccurrences(siteIds: string[], date: string | null, areaChoice: string | null): { occurrences: Array<{ site_id: string; scheduled_date: string | null; site_area_id?: string }>; error?: string }`, em que `areaChoice` tem o formato `<siteId>:<areaId>`

O banco não confere se o setor é do local, então a checagem fica nessa função.

- [ ] **Passo 1: Escrever os testes:** sem setor, nenhuma ocorrência leva `site_area_id`; com dois locais, só a ocorrência do local do setor leva `site_area_id`; setor de local não marcado devolve `error: "Esse setor é de um local que não foi marcado."`.
- [ ] **Passo 2: Rodar** `npx vitest run --project unit src/domain/task-form.test.ts`. Esperado: falha.
- [ ] **Passo 3: Implementar** a função, o `SelectField` "Setor" (`name="site_area"`, rótulo `Local — Setor`, opcional) e o uso na ação, com `invalid({ site_area: error })`.
- [ ] **Passo 4: Rodar o teste.** Esperado: verde.
- [ ] **Passo 5: Estender o E2E:** tarefa criada com setor mostra o setor na tela da tarefa do campo.
- [ ] **Passo 6: Commit** `feat(agenda): escolher setor ao criar tarefa`.

### Task 5: Autor e hora da foto (R-40)

**Arquivos:**
- Criar: `tests/db/photo-meta.test.ts`
- Modificar: `src/server/data.ts` (`loadPhotos`), `src/ui/photo-grid.tsx`

**Interfaces:**
- Produz: `GridPhoto.meta` preenchido com `<nome> · <dd/mm/aaaa hh:mm>`

Fora: diário e PDFs para o cliente continuam sem autor, porque o diário monta a própria lista de fotos.

- [ ] **Passo 1: Escrever os testes:** "loadPhotos traz autor e hora do envio"; "pessoa sem nome legível mostra só a data".
- [ ] **Passo 2: Rodar** `npx vitest run --project db tests/db/photo-meta.test.ts`. Esperado: falha, `meta` indefinido.
- [ ] **Passo 3: Implementar.** Selecionar `uploaded_by, uploaded_at`, buscar nomes em `profiles` por lote de ids, formatar com `formatDateTimeBR` e exibir `meta` no cartão, além do diálogo.
- [ ] **Passo 4: Rodar o teste e `tests/db/closings.test.ts`.** Esperado: verde, com o payload do cliente inalterado.
- [ ] **Passo 5: Commit** `feat(fotos): mostrar autor e hora do envio`.

### Task 6: Filtros em "Minhas atividades" (F3.7)

**Arquivos:**
- Criar: `src/domain/activity-filters.ts`, `src/domain/activity-filters.test.ts`
- Modificar: `src/app/campo/atividades/page.tsx`, `tests/e2e/campo.spec.ts`

**Interfaces:**
- Produz: `parseActivityFilters(params: { local?: string; de?: string; ate?: string }, today: string): { siteId: string | null; from: string; to: string }`

- [ ] **Passo 1: Escrever os testes:** sem parâmetros, últimos 30 dias até hoje; `de` depois de `ate` troca os dois; data inválida usa o padrão; `local` que não é UUID vira `null`.
- [ ] **Passo 2: Rodar** `npx vitest run --project unit src/domain/activity-filters.test.ts`. Esperado: falha.
- [ ] **Passo 3: Implementar** e aplicar na página: formulário `method="get"` no padrão de `admin/atividades`, opções vindas de `loadFieldContext`, consulta com `fetchAll`, `.eq("entry.site_id", ...)` e `.lte("entry.activity_date", to)`.
- [ ] **Passo 4: Rodar o teste.** Esperado: verde.
- [ ] **Passo 5: Estender o E2E:** filtro por período esconde atividade fora dele; `?local=` de outra obra mostra lista vazia, sem erro. `alvos-toque.spec.ts` segue verde.
- [ ] **Passo 6: Commit** `feat(campo): filtrar minhas atividades por local e período`.

### Task 7: Justificar dia sem execução pela administração (F3.2)

**Arquivos:**
- Criar: `tests/e2e/agenda.spec.ts`
- Modificar: `src/server/actions/tasks.ts`, `src/app/admin/agenda/page.tsx:171-185`

**Interfaces:**
- Produz: `markOccurrenceNotDoneAction(_: ActionState, fd: FormData): Promise<ActionState>`, só para admin, chamando a RPC `task_occurrence_not_done` e devolvendo mensagem em vez de redirecionar para o campo

- [ ] **Passo 1: Escrever o E2E:** admin cria tarefa, abre a ocorrência na agenda, clica "Não foi realizada", informa "Chuva forte" e vê "Não realizada: Chuva forte". Rodar e ver falhar.
- [ ] **Passo 2: Implementar** a ação e um `ReasonAction` (`reasonLabel="Por que não foi feito?"`) para ocorrências `prevista` e `iniciada`.
- [ ] **Passo 3: Rodar o E2E.** Esperado: verde.
- [ ] **Passo 4: Commit** `feat(agenda): administração justifica dia sem execução`.

### Task 8: Foto em arquivo único de 1600 px (depende de D1)

**Arquivos:**
- Criar: `supabase/migrations/20261030000100_single_image_file.sql`, `src/server/images.test.ts`
- Modificar: `src/server/images.ts`, `src/domain/upload.ts`, `src/domain/file-serving.ts`, `src/domain/file-serving.test.ts`, `src/app/api/uploads/route.ts`, `src/ui/media-uploader.tsx:21`, `tests/db/review-fixes.test.ts`, `docs/02-requisitos-rastreabilidade.md` (D-11), `docs/08-operacao.md`, `docs/12-revisao-ux-mobile.md`

**Interfaces:**
- Produz: `MAX_IMAGE_SIDE: Record<UploadPurpose, number> = { photo: 1600, quote: 1600, receipt: 2000, logo: 1600 }`; `storedImage(bytes: Buffer, maxSide: number): Promise<{ main: Buffer; thumb: Buffer; width: number; height: number }>`

Logotipo e PDFs não mudam. Fotos antigas ficam como estão, sem conversão.

- [ ] **Passo 1: Escrever os testes de `storedImage`**, com imagens geradas pelo sharp: "remove EXIF e GPS" (`metadata().exif` indefinido no resultado); "respeita a orientação" (entrada 400×300 com orientação 6 sai 300×400); "limita o maior lado a 1600"; "não amplia foto pequena".
- [ ] **Passo 2: Escrever o teste de entrega** em `file-serving.test.ts`: com `derivatives: { thumb }`, `original` e `medium` devolvem `storageKey` para qualquer pessoa, e `thumb` devolve a miniatura. O caso `derivatives: {}` para não administrador continua `null`.
- [ ] **Passo 3: Escrever o teste de banco:** "aceita anexo só com miniatura" e "recusa miniatura com nome fora do padrão".
- [ ] **Passo 4: Rodar os três.** Esperado: falha.
- [ ] **Passo 5: Mostrar a migração e esperar OK.** Troca `attachments_derivatives_format` para exigir `thumb` no padrão e aceitar `medium` ausente, mantendo `not valid`. Não altera linhas existentes.
- [ ] **Passo 6: Implementar.** `storedImage` com `.rotate()`, `fit: "inside"`, `withoutEnlargement`, JPEG qualidade 84 e `mozjpeg`. Na rota, para quem não é `logo`: gravar `<id>.jpg` e `<id>_thumb.jpg`, com `mime_type` JPEG e `derivatives: { thumb }`. Em `planFileResponse`, usar `d.medium ?? (d.thumb ? storageKey : null)`.
- [ ] **Passo 7: Rodar a verificação completa da fase, com E2E.** Esperado: verde; upload, PDF e `alvos-toque` passam.
- [ ] **Passo 8: Medir** com 5 fotos reais de celular: tamanho por foto e tempo no 3G. Registrar em `docs/12-revisao-ux-mobile.md`.
- [ ] **Passo 9: Commit, PR e merge** de `feat(fotos): guardar uma versão de 1600 px e miniatura`, depois `supabase db push` na nuvem, com OK.

---

## Fase B — Contas gratuitas

### Task 9: E-mail de convite e recuperação

**Davi:** criar a conta no Brevo, verificar o remetente, gerar a chave SMTP e preencher Host, Porta, Usuário e Senha em Supabase → Authentication → Emails → SMTP Settings.

**Assistente:** colar os modelos de `supabase/templates/invite.html` e `recovery.html` nos dois modelos do painel, com os assuntos de `supabase/config.toml`, e ajustar Auth → Rate Limits para 30 e-mails por hora.

- [ ] **Passo 1:** convidar `fragakdev+convite@gmail.com`. Esperado: e-mail na caixa de entrada em menos de 1 minuto, e o link abre em outro aparelho em "Crie sua senha de acesso".
- [ ] **Passo 2:** "Esqueci minha senha" nessa conta. Esperado: link leva a "Criar nova senha", e a nova senha entra.
- [ ] **Passo 3:** repetir com um e-mail fora do Gmail. Esperado: chega fora do spam. Remetente `@gmail.com` por serviço externo tende a falhar nessa checagem; nesse caso, usar o domínio de D3.
- [ ] **Passo 4:** registrar remetente e resultado em `docs/08-operacao.md`.

### Task 10: Backup diário com cópia externa

**Arquivos:**
- Criar: `.github/workflows/backup.yml`
- Modificar: `docs/08-operacao.md` (§4 e §5)

**Davi:** autorizar o Google Drive uma vez com `rclone config` e entregar o conteúdo do arquivo de configuração como segredo. **Segredos do repositório:** `BACKUP_DATABASE_URL` (Session pooler, porque o runner só tem IPv4), `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_PASSPHRASE`, `RCLONE_CONFIG`.

Workflow: agendado para `0 6 * * *` e `workflow_dispatch`; instala `postgresql-client-17` do repositório PGDG e rclone; roda `npm ci` e `npm run backup`; compacta `backups/`; cifra com `gpg --symmetric`; envia para `gdrive:megagyn-backups`; apaga cópias com mais de 30 dias usando `rclone delete --min-age 30d`.

- [ ] **Passo 1: Disparar manualmente.** Esperado: verde e arquivo `.gpg` no Drive.
- [ ] **Passo 2: Restaurar.** Baixar, decifrar e rodar `npm run restore:test -- <pasta>`. Esperado: contagens iguais e hashes idênticos.
- [ ] **Passo 3: Documentar** como restaurar e a rotina mensal de teste.
- [ ] **Passo 4: Commit** `ci(backup): backup diário cifrado no Google Drive`.

---

## Fase C — Servidor próprio (depende de D2)

### Task 11: Validar a imagem Docker e criar o Compose

A imagem nunca foi construída neste projeto. Esta tarefa vem antes de qualquer conta na Oracle.

**Arquivos:**
- Criar: `docker-compose.prod.yml`, `deploy/Caddyfile`
- Modificar: `Dockerfile` (se a validação pedir), `docs/08-operacao.md` (nova §2b)

Serviços: `app` (`npm run start`, `restart: unless-stopped`), `worker` (`npm run worker`, mesma imagem), `caddy` (portas 80 e 443, volume para certificados). `PDF_RENDERER=playwright` no Compose, e `env_file: .env.production`.

- [ ] **Passo 1:** `docker buildx imagetools inspect mcr.microsoft.com/playwright:v1.64.1-noble`. Esperado: `linux/arm64` listado. Se não houver, escolher a versão mais próxima que tenha, igual ao `playwright` do `package.json`.
- [ ] **Passo 2:** `docker build -t megagyn .`. Esperado: sucesso, sem segredo na imagem.
- [ ] **Passo 3:** subir com variáveis do Supabase local só em tempo de execução. Esperado: login funciona e um PDF é gerado pelo Chromium dentro do container.
- [ ] **Passo 4:** parar o `app` no meio de um PDF e subir de novo. Esperado: o `worker` retoma em até 11 minutos.
- [ ] **Passo 5:** `docker buildx build --platform linux/arm64 -t megagyn:arm .`. Esperado: sucesso, inclusive `sharp` e fontes.
- [ ] **Passo 6: Commit** `feat(deploy): Compose com app, worker e Caddy`.

### Task 12: Servidor Oracle e troca de endereço

**Davi:** criar a conta. A região de origem não muda depois; escolher São Paulo, ou Vinhedo como alternativa. Após o login, o assistente pode conduzir a criação da máquina pelo navegador.

Máquina: `VM.Standard.A1.Flex`, Ubuntu 24.04 Arm, **2 OCPU e 6 GB**. A Oracle considera ociosa a máquina com CPU, rede e memória abaixo de 20% por 7 dias; com 6 GB, o sistema tende a ficar acima de 20% de memória. Se aparecer "Out of capacity", tentar por alguns dias e, em último caso, avaliar Pay As You Go, que não cobra dentro dos limites gratuitos.

- [ ] **Passo 1: Preparar.** Acesso SSH só por chave, portas 80 e 443 abertas na Security List e no `iptables`, Docker, `unattended-upgrades`.
- [ ] **Passo 2: Implantar.** Clonar com deploy key somente leitura, copiar `.env.production` por `scp`, `PDF_RENDERER=playwright`, `APP_URL` novo e `docker compose -f docker-compose.prod.yml up -d --build`.
- [ ] **Passo 3: DNS e HTTPS** conforme D3. Esperado: certificado válido emitido pelo Caddy.
- [ ] **Passo 4: Verificar no novo endereço:** roteiro da E5 de `docs/13`, PDF de 37 páginas, comprovante PDF de 10 MB e convite por e-mail.
- [ ] **Passo 5: Reiniciar a máquina.** Esperado: tudo volta sozinho em até 3 minutos.
- [ ] **Passo 6: Trocar.** Site URL e URLs de retorno no Supabase; monitor do UptimeRobot; variável `APP_URL` no GitHub; `update public.company_settings set max_pdf_mb = 20 where id = 1;` com OK.
- [ ] **Passo 7: Medir por 7 dias.** Esperado: memória acima de 20% nas métricas da Oracle e nenhum alerta do monitor.
- [ ] **Passo 8: Desativar** Vercel e Render depois dos 7 dias. Até lá, servem de retorno.

---

## Fase D — Validação e entrega

### Task 13: Piloto com a equipe em celular real

**Davi:** reunir 2 funcionários e o encarregado, cada um com seu Android ou iPhone.

- [ ] **Passo 1:** percorrer `docs/09-manual-por-perfil.md`: chamado, foto pela câmera, pendência, conclusão, compra com rateio e agenda multiobra.
- [ ] **Passo 2:** anotar teclado cobrindo campo, leitura ao sol, tempo de envio e pontos sem sinal nas obras. Offline está fora do escopo; se faltar sinal, vira decisão à parte.
- [ ] **Passo 3:** registrar em `docs/12-revisao-ux-mobile.md`. Defeito vira tarefa com teste antes do item seguinte.

### Task 14: Base limpa, dados reais e entrega

Pré-requisitos: Tasks 9, 10 e 13 concluídas e Q2 respondida.

- [ ] **Passo 1:** rodar o backup e confirmar a cópia no Drive.
- [ ] **Passo 2 (Davi, com a query e o impacto à vista):** `supabase db reset --linked`. Apaga todos os dados de demonstração e os usuários, inclusive a conta de Davi. Conferir depois: 0 perfis, 0 anexos e buckets vazios; o que restar é apagado pelo painel.
- [ ] **Passo 3 (Davi):** criar o primeiro administrador conforme `docs/08-operacao.md`, passo 5.
- [ ] **Passo 4:** preencher Configurações com os dados oficiais e enviar logo e assinatura. Emitir um PDF de teste para a Megagyn aprovar.
- [ ] **Passo 5:** cadastrar clientes, locais e equipe, com usuários reais por convite.
- [ ] **Passo 6:** revisar `docs/08-operacao.md` §7 (LGPD) com a Megagyn: quem é responsável pelos dados, retenção e aviso à equipe sobre fotos e registros.
- [ ] **Passo 7:** registrar D4 no contrato e entregar URL, manual e a lista do que ficou fora.
- [ ] **Passo 8:** atualizar `docs/10-checklist-aceite.md` e a verificação final.

---

## Ordem e esforço

| Fase | Tarefas | Quem | Tamanho | Bloqueia |
|---|---|---|---|---|
| A | 1 a 2 | Assistente, com 2 cadastros de Davi | P | Dado real na nuvem |
| A | 3 a 7 | Assistente | M | Uso diário |
| A | 8 | Assistente, com D1 | M | Fase D, para não migrar formato depois |
| B | 9 e 10 | Davi cria contas; assistente configura | P | Fase D |
| C | 11 e 12 | Assistente, com conta e cartão de Davi | G | Operação comercial |
| D | 13 e 14 | Davi conduz; assistente apoia | M | Entrega |

Se D2 for "não", a Fase C sai e o sistema fica como demonstração na Vercel. Nesse caso, operação real exige plano pago, ou outro caminho a decidir.

## Fora deste plano

Portal do cliente (Q1), autenticação em dois fatores, limite de requisições no app, testes da trilha de auditoria e do limite retroativo, modo offline, notificações por e-mail ou push, e migração das fotos já existentes.
