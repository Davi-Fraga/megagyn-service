import { expect, test } from "@playwright/test";
import { PHOTO_A, USERS, login, mobilePage, uploadPhotos } from "./helpers";

test.setTimeout(300_000);

/** T-A6 — encarregado com tarefas em duas obras no mesmo dia, registrando cada uma no local certo. */
test("encarregado: agenda multiobra e registro por local", async ({ page, browser }) => {
  const title = `Vistoria E2E ${Date.now()}`;
  await login(page, USERS.admin);
  await page.goto("/admin/agenda/nova");
  await page.getByLabel("O que fazer").fill(title);
  await page.getByRole("checkbox", { name: "Condomínio Jardim Exemplo — Torre A" }).check();
  await page.getByRole("checkbox", { name: "Indústria Modelo — Galpão de montagem" }).check();
  await page.getByRole("checkbox", { name: "Carlos Encarregado (demo) (encarregado)" }).check();
  await page.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(page.getByText("Tarefa criada.")).toBeVisible({ timeout: 120_000 });

  const foreman = await mobilePage(browser);
  await login(foreman, USERS.foreman);
  await foreman.goto("/campo/tarefas");
  // As duas ocorrências aparecem no mesmo dia, separadas por obra.
  const items = foreman.getByRole("link", { name: new RegExp(title) });
  await expect(items).toHaveCount(2, { timeout: 60_000 });

  // Registra na Torre A, com foto.
  await foreman.getByText("Torre A", { exact: true }).locator("xpath=..").getByRole("link", { name: new RegExp(title) }).click();
  await foreman.getByRole("link", { name: "Registrar o que foi feito" }).click();
  await foreman.getByLabel("O que foi feito").fill("Vistoria da cobertura da Torre A");
  await uploadPhotos(foreman, [PHOTO_A]);
  await foreman.getByRole("button", { name: "Salvar registro" }).click();
  await expect(foreman.getByText("Atividade registrada neste local.")).toBeVisible({ timeout: 120_000 });
  await expect(foreman.getByText("Vistoria da cobertura da Torre A")).toBeVisible();
  await foreman.getByRole("button", { name: "Finalizar neste local" }).click();
  await expect(foreman.getByText("Tarefa finalizada neste local.")).toBeVisible();

  // No Galpão, informa que não deu para fazer, com motivo.
  await foreman.goto("/campo/tarefas");
  await foreman.getByText("Galpão de montagem", { exact: true }).locator("xpath=..").getByRole("link", { name: new RegExp(title) }).click();
  await foreman.getByRole("button", { name: "Não deu para fazer" }).click();
  await foreman.getByLabel("Por que não foi feito?").fill("Portão fechado, sem acesso");
  await foreman.getByRole("button", { name: "Registrar motivo" }).click();
  await expect(foreman.getByText("Registrado que a tarefa não foi realizada")).toBeVisible();
  await foreman.context().close();

  // O diário da Torre A mostra o registro; o do Galpão não.
  await page.goto("/admin/agenda");
  await expect(page.getByText("Não realizada: Portão fechado, sem acesso").first()).toBeVisible();
});

/** T-A3 — pendência por falta de material e retomada pela tela, sem perder histórico. */
test("funcionário: pendência e retomada", async ({ page, browser }) => {
  const title = `Pendência E2E ${Date.now()}`;
  await login(page, USERS.admin);
  await page.goto("/admin/chamados/novo");
  await page.locator('select[name="client_id"]').selectOption({ label: "Condomínio Jardim Exemplo" });
  await page.locator('select[name="site_id"]').selectOption({ label: "Torre A" });
  await page.getByLabel("Nome do solicitante").fill("Síndica Demo (fictícia)");
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Descrição do problema").fill("Teste de pendência.");
  await page.getByText("Já definir responsável e data").click();
  await page.getByRole("checkbox", { name: "João Funcionário (demo)" }).check();
  await page.getByRole("button", { name: "Abrir chamado" }).click();
  await page.waitForURL(/\/admin\/chamados\/[0-9a-f-]{36}/, { timeout: 120_000 });
  const id = page.url().split("/").pop()!.split("?")[0]!;

  const worker = await mobilePage(browser);
  await login(worker, USERS.joao);
  await worker.goto(`/campo/chamados/${id}`);
  await worker.getByRole("link", { name: "Não consegui concluir" }).click();
  await worker.getByLabel("Por que não deu para concluir?").selectOption({ label: "Falta de material" });
  await worker.getByLabel("Explique o que aconteceu").fill("Faltou luva de 50 mm.");
  await worker.getByLabel("O que precisa ser feito").fill("Comprar 2 luvas de 50 mm.");
  await worker.getByLabel("Quem faz a próxima ação").selectOption({ label: "Carlos Encarregado (demo) (encarregado)" });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  await worker.getByLabel("Previsão de retorno").fill(today);
  await worker.getByRole("button", { name: "Registrar pendência" }).click();
  await expect(worker.getByText("Pendência registrada.")).toBeVisible({ timeout: 120_000 });
  await expect(worker.getByText("Pendente: Falta de material")).toBeVisible();

  // Aparece no filtro de pendentes da administração.
  await page.goto("/admin/chamados?status=pendente");
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  await worker.getByRole("button", { name: "Retomar serviço" }).click();
  await expect(worker.getByText("Serviço retomado.")).toBeVisible();
  await worker.reload();
  await expect(worker.getByText("Pendência informada", { exact: true })).toBeVisible();
  await expect(worker.getByText("Serviço retomado", { exact: true })).toBeVisible();
  await worker.context().close();
});

/** T-A10 (equipe de campo) — sem acesso a chamados e fotos de outra obra, nem por link direto. */
test("isolamento: funcionário da Torre B não abre chamado nem foto da Torre A", async ({ page, browser }) => {
  await login(page, USERS.admin);
  await page.goto("/admin/chamados?q=Vazamento no cano do subsolo");
  await page.getByRole("link", { name: "Vazamento no cano do subsolo" }).first().click();
  await page.waitForURL(/\/admin\/chamados\/[0-9a-f-]{36}/);
  const requestId = page.url().split("/").pop()!.split("?")[0]!;

  await page.goto("/admin/diario");
  await page.getByLabel("Obra ou unidade").selectOption({ label: "Condomínio Jardim Exemplo — Torre A" });
  await page.getByLabel("De", { exact: true }).fill("2026-09-01");
  await page.getByLabel("Até", { exact: true }).fill("2026-09-30");
  await page.getByRole("button", { name: "Ver diário" }).click();
  const img = page.locator('img[src^="/api/files/"]').first();
  await expect(img).toBeVisible({ timeout: 120_000 });
  const src = (await img.getAttribute("src"))!;
  expect((await page.request.get(src)).status()).toBe(200);

  const pedro = await mobilePage(browser);
  await login(pedro, USERS.pedro);
  // Chamado de outra obra: 404 (não revela se existe).
  const detail = await pedro.goto(`/campo/chamados/${requestId}`);
  expect(detail?.status()).toBe(404);
  // Área administrativa: acesso negado.
  await pedro.goto(`/admin/chamados/${requestId}`);
  await expect(pedro).toHaveURL(/acesso-negado/);
  // Foto da Torre A pelo endpoint direto: 404.
  expect((await pedro.request.get(src)).status()).toBe(404);
  // CSV e relatórios internos: bloqueados.
  expect((await pedro.request.get("/api/csv/chamados")).status()).toBe(403);
  await pedro.context().close();
});

/** R-25 — tarefa com setor: o encarregado vê onde fazer. */
test("tarefa criada com setor mostra o setor na tela do campo", async ({ page, browser }) => {
  const title = `Setor E2E ${Date.now()}`;
  await login(page, USERS.admin);
  await page.goto("/admin/agenda/nova");
  await page.getByLabel("O que fazer").fill(title);
  await page.getByRole("checkbox", { name: "Condomínio Jardim Exemplo — Torre A" }).check();
  await page.getByLabel("Setor").selectOption({ label: "Torre A — Salão de festas" });
  await page.getByRole("checkbox", { name: "Carlos Encarregado (demo) (encarregado)" }).check();
  await page.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(page.getByText("Tarefa criada.")).toBeVisible({ timeout: 120_000 });

  const foreman = await mobilePage(browser);
  await login(foreman, USERS.foreman);
  await foreman.goto("/campo/tarefas");
  await foreman.getByRole("link", { name: new RegExp(title) }).first().click();
  await expect(foreman.getByText("Torre A · Salão de festas")).toBeVisible({ timeout: 60_000 });
  await foreman.context().close();
});

/** F3.7 — filtros de "Minhas atividades": período, valores inválidos e local sem registros. */
test("minhas atividades: filtro por período e entrada inválida", async ({ browser }) => {
  const text = `Filtro E2E ${Date.now()}`;
  const worker = await mobilePage(browser);
  await login(worker, USERS.joao);
  await worker.goto("/campo/registrar");
  await worker.getByLabel("Onde foi feito").selectOption({ label: "Torre A — Condomínio Jardim Exemplo" });
  await worker.getByLabel("O que foi feito").fill(text);
  await uploadPhotos(worker, [PHOTO_A]);
  // B-32: a legenda é gravada antes do registro e aparece com a foto.
  await worker.getByLabel("Legenda da foto").fill(`Legenda ${text}`);
  await worker.getByRole("button", { name: "Salvar registro" }).click();
  // /\/campo/ já casaria com /campo/registrar e seguiria antes de o registro gravar.
  await worker.waitForURL(/feito=registro/, { timeout: 60_000 });

  await worker.goto("/campo/atividades");
  await expect(worker.getByText(text, { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(worker.getByText(`Legenda ${text}`)).toBeVisible();

  await worker.getByLabel("De", { exact: true }).fill("2000-01-01");
  await worker.getByLabel("Até", { exact: true }).fill("2000-01-31");
  await worker.getByRole("button", { name: "Filtrar" }).click();
  await worker.waitForURL(/de=2000-01-01/);
  await expect(worker.getByText("Nenhum registro neste período.")).toBeVisible();
  await expect(worker.getByText(text)).toHaveCount(0);

  // Data invertida e valores adulterados não quebram a tela.
  await worker.goto("/campo/atividades?de=2030-01-01&ate=2000-01-01&local=abc");
  await expect(worker.getByRole("heading", { name: "O que eu fiz" })).toBeVisible();
  await worker.goto("/campo/atividades?local=99999999-9999-4999-8999-999999999999");
  await expect(worker.getByText("Nenhum registro neste período.")).toBeVisible();
  await worker.context().close();
});
