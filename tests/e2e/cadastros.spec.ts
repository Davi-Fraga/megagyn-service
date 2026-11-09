import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { PASSWORD, PHOTO_A, USERS, login, mobilePage, uploadPhotos } from "./helpers";

/** Painel da página pelo título (cada Panel é uma <section> com <h2>). */
function panel(page: Page, title: string) {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

/**
 * Botões que só abrem a confirmação no navegador dependem da hidratação do React; com o
 * servidor de desenvolvimento ocupado, o primeiro clique pode chegar antes dela. Repete até abrir.
 */
async function openConfirm(button: Locator, confirmButton: Locator) {
  await expect(async () => {
    if (await button.isVisible()) await button.click();
    await expect(confirmButton).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });
}

/** Tenta entrar e devolve a página (o login de usuário desativado não sai de /login). */
async function tryLogin(browser: Browser, email: string) {
  const page = await mobilePage(browser);
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  return page;
}

async function setWorkerActive(page: Page, userUrl: string, active: boolean) {
  await page.goto(userUrl);
  if (active) {
    await page.getByRole("button", { name: "Reativar acesso" }).click();
    await expect(page.getByText("Acesso reativado.")).toBeVisible({ timeout: 60_000 });
  } else {
    // B-20: o desligamento pede o motivo e encerra os acessos aos locais.
    await page.getByLabel("Motivo do desligamento").fill("Desligamento de teste (fictício)");
    await page.getByRole("button", { name: "Desativar acesso" }).click();
    await expect(page.getByText("Acesso desativado. A pessoa não entra mais no sistema")).toBeVisible({ timeout: 60_000 });
  }
}

/**
 * Cadastros (ADM-02/03/04) e T-A15: admin cadastra cliente, local e setor; cria um funcionário
 * com senha; dá acesso ao local; o funcionário entra no campo; o admin desativa e o acesso cai.
 * Dados fictícios e únicos por execução.
 */
test.describe.serial("cadastros e usuário inativado", () => {
  const ts = Date.now();
  const workerName = `Funcionário E2E ${ts}`;
  const workerEmail = `func.e2e.${ts}@demo.megagyn.local`;

  test("cliente, local, setor, usuário, vínculo, desativação e reativação", async ({ page, browser }) => {
    test.setTimeout(480_000);
    const clientName = `Cliente E2E ${ts}`;
    const siteName = `Obra E2E ${ts}`;
    const siteCode = `E2E-${ts}`;
    const areaName = `Térreo ${ts}`;

    await login(page, USERS.admin);

    // 1. Cliente novo.
    await page.goto("/admin/clientes");
    const newClient = panel(page, "Novo cliente");
    await newClient.getByLabel("Razão social ou nome completo").fill(`${clientName} Ltda (fictício)`);
    await newClient.getByLabel("Nome de exibição").fill(clientName);
    await newClient.getByRole("button", { name: "Cadastrar cliente" }).click();
    await page.waitForURL(/\/admin\/clientes\/[0-9a-f-]{36}/, { timeout: 120_000 });
    await expect(page.getByText("Cliente cadastrado.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: clientName })).toBeVisible();

    // 2. Local do cliente (o código é normalizado em maiúsculas).
    const sites = panel(page, "Obras e unidades");
    await sites.getByLabel("Nome do local").fill(siteName);
    await sites.getByLabel("Código").fill(siteCode.toLowerCase());
    await sites.getByLabel("Tipo de local").selectOption({ label: "Obra temporária" });
    // B-21: acesso e responsável na Megagyn (o cliente novo ainda não tem contato).
    await sites.getByLabel("Horário de acesso").fill("Segunda a sexta, das 7h às 17h");
    await sites.getByLabel("Orientações de acesso").fill("Retirar a chave na portaria.");
    await sites.getByLabel("Responsável na Megagyn").selectOption({ label: "Carlos Encarregado (demo)" });
    await sites.getByRole("button", { name: "Cadastrar local" }).click();
    await page.waitForURL(/\/admin\/locais\/[0-9a-f-]{36}/, { timeout: 120_000 });
    await expect(page.getByText("Local cadastrado.")).toBeVisible();
    await expect(page.getByText(siteCode, { exact: true })).toBeVisible();
    await expect(page.getByLabel("Horário de acesso")).toHaveValue("Segunda a sexta, das 7h às 17h");
    await expect(page.getByLabel("Orientações de acesso")).toHaveValue("Retirar a chave na portaria.");
    await expect(page.getByLabel("Responsável na Megagyn").locator("option:checked")).toHaveText("Carlos Encarregado (demo)");
    const siteUrl = page.url().split("?")[0]!;

    // 3. Setor do local.
    const areas = panel(page, "Setores e ambientes");
    await areas.getByLabel("Nome do novo setor").fill(areaName);
    await areas.getByRole("button", { name: "Adicionar setor" }).click();
    await expect(areas.getByText(`Setor “${areaName}” adicionado.`)).toBeVisible();
    await expect(areas.getByRole("listitem").filter({ hasText: areaName })).toBeVisible();

    // 4. Funcionário com senha inicial; o e-mail repetido é recusado com mensagem clara.
    await page.goto("/admin/usuarios");
    const newUser = panel(page, "Novo usuário");
    await newUser.getByLabel("Nome completo").fill(workerName);
    await newUser.getByLabel("E-mail de acesso").fill(workerEmail);
    await newUser.getByLabel("Papel").selectOption({ label: "Funcionário" });
    await newUser.getByLabel("Senha inicial").fill(PASSWORD);
    await newUser.getByRole("button", { name: "Cadastrar usuário" }).click();
    await page.waitForURL(/\/admin\/usuarios\/[0-9a-f-]{36}/, { timeout: 120_000 });
    await expect(page.getByText("Usuário cadastrado.")).toBeVisible();
    const userUrl = page.url().split("?")[0]!;

    await page.goto("/admin/usuarios");
    const again = panel(page, "Novo usuário");
    await again.getByLabel("Nome completo").fill(`${workerName} (repetido)`);
    await again.getByLabel("E-mail de acesso").fill(workerEmail);
    await again.getByLabel("Papel").selectOption({ label: "Funcionário" });
    await again.getByLabel("Senha inicial").fill(PASSWORD);
    await again.getByRole("button", { name: "Cadastrar usuário" }).click();
    await expect(again.getByText("Já existe um usuário com este e-mail.").first()).toBeVisible({ timeout: 60_000 });

    // 5. Acesso ao local (vínculo).
    await page.goto(siteUrl);
    const team = panel(page, "Equipe com acesso");
    await team.getByLabel("Pessoa").selectOption({ label: `${workerName} — Funcionário` });
    await team.getByRole("button", { name: "Dar acesso" }).click();
    await expect(team.getByText(`${workerName} agora tem acesso a este local.`)).toBeVisible();
    await expect(team.getByRole("link", { name: workerName })).toBeVisible();

    // 5b. Exceção de permissão pela tela do usuário (B-25): registrada, visível na matriz e na trilha.
    await page.goto(userUrl);
    const perms = panel(page, "Permissões");
    const validar = perms.locator("tr").filter({ hasText: "O.S.: validar e encerrar" });
    await expect(validar).toContainText("Só administração");
    await perms.getByLabel("Permissão").selectOption({ label: "O.S.: validar e encerrar" });
    await perms.getByLabel("Liberar ou bloquear").selectOption({ label: "Liberar" });
    await perms.getByLabel("Motivo da exceção").fill("Cobertura de férias (E2E)");
    await perms.getByRole("button", { name: "Registrar exceção" }).click();
    await expect(perms.getByText("Exceção registrada na trilha.")).toBeVisible({ timeout: 60_000 });
    await expect(validar).toContainText("Liberada");
    await expect(validar).toContainText("Cobertura de férias (E2E)");
    await validar.getByRole("button", { name: "Remover exceção" }).click();
    await expect(validar).not.toContainText("Liberada", { timeout: 60_000 });
    await page.goto("/admin/auditoria?entidade=permission_overrides");
    await expect(page.locator("li").filter({ hasText: "Criou Exceção de permissão" }).first()).toBeVisible();
    await expect(page.locator("li").filter({ hasText: "Removeu Exceção de permissão" }).first()).toBeVisible();

    // 6. O funcionário entra pelo celular e chega ao campo.
    const worker = await mobilePage(browser);
    await login(worker, workerEmail);
    await worker.waitForURL(/\/campo/, { timeout: 120_000 });
    await expect(worker.getByText("Registrar o que foi feito").first()).toBeVisible();

    // 7. A administração vê as pendências (B-20) e desativa o acesso; o vínculo com o local é encerrado.
    await page.goto(userUrl);
    const pending = page.getByRole("region", { name: "Pendências desta pessoa" });
    await expect(pending).toContainText("Acessos a locais que serão encerrados (1)");
    await expect(pending).toContainText(siteName);
    await setWorkerActive(page, userUrl, false);
    await expect(page.getByRole("region", { name: "Pendências desta pessoa" })).toHaveCount(0);
    await page.goto(siteUrl);
    const teamRow = panel(page, "Equipe com acesso").locator("li").filter({ hasText: workerName });
    await expect(teamRow).toContainText("usuário desativado");
    await expect(teamRow).toContainText("Acesso até");

    // 8. A sessão que estava aberta perde o acesso na hora (sessão revogada no Auth).
    await worker.goto("/campo");
    await expect(worker).not.toHaveURL(/\/campo/, { timeout: 60_000 });
    await expect(worker.getByText("Registrar o que foi feito")).toHaveCount(0);
    await worker.context().close();

    // 9. Um novo login é recusado.
    const refused = await tryLogin(browser, workerEmail);
    await expect(refused.locator("form").getByRole("alert")).toBeVisible({ timeout: 60_000 });
    await expect(refused).toHaveURL(/\/login/);
    await refused.context().close();

    // 10. O cadastro continua (autorias preservadas), marcado como desativado.
    await page.goto("/admin/usuarios");
    await expect(page.getByRole("row").filter({ hasText: workerName }).first()).toContainText("Desativado");

    // 11. Reativado, volta a entrar; depois fica desativado para o próximo teste.
    await setWorkerActive(page, userUrl, true);
    const back = await mobilePage(browser);
    await login(back, workerEmail);
    await back.waitForURL(/\/campo/, { timeout: 120_000 });
    await back.context().close();
    await setWorkerActive(page, userUrl, false);
  });

  // T-A15: a mensagem depende de o login (src/app/(auth)/actions.ts) tratar o erro "user_banned" do Auth.
  test("login de usuário desativado mostra 'Seu acesso está desativado' (T-A15)", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await tryLogin(browser, workerEmail);
    await expect(page.getByText("Seu acesso está desativado")).toBeVisible({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/login/);
    await page.context().close();
  });
});

/** Responsáveis do cliente (sem login) com anonimização LGPD, configurações e listas de escolha. */
test("responsáveis do cliente, configurações e listas de escolha", async ({ page }) => {
  test.setTimeout(300_000);
  const ts = Date.now();
  const contactName = `Síndica E2E ${ts}`;
  const reason = `Chuva forte E2E ${ts}`;

  await login(page, USERS.admin);

  // Cliente próprio do teste.
  await page.goto("/admin/clientes");
  const newClient = panel(page, "Novo cliente");
  await newClient.getByLabel("Razão social ou nome completo").fill(`Condomínio E2E ${ts} (fictício)`);
  await newClient.getByRole("button", { name: "Cadastrar cliente" }).click();
  await page.waitForURL(/\/admin\/clientes\/[0-9a-f-]{36}/, { timeout: 120_000 });
  const clientUrl = page.url().split("?")[0]!;

  // A lista de clientes mostra o cliente novo (a contagem de locais falhava em silêncio depois do B-16).
  await page.goto(`/admin/clientes?q=${encodeURIComponent(`Condomínio E2E ${ts}`)}`);
  await expect(page.getByRole("link", { name: `Condomínio E2E ${ts} (fictício)` })).toBeVisible();
  await page.goto(clientUrl);

  // Responsável: cadastrar, editar e anonimizar.
  const contacts = panel(page, "Responsáveis do cliente");
  await contacts.getByLabel("Nome do responsável").fill(contactName);
  await contacts.getByLabel("E-mail do responsável").fill(`sindica.${ts}@exemplo.test`);
  await contacts.getByLabel("Telefone do responsável").fill("(00) 00000-0000");
  await contacts.getByRole("button", { name: "Adicionar responsável" }).click();
  await expect(contacts.getByText(`${contactName} cadastrado(a) como responsável do cliente.`)).toBeVisible({ timeout: 60_000 });
  const row = contacts.getByRole("listitem").filter({ hasText: `sindica.${ts}@exemplo.test` });
  await expect(row).toBeVisible();

  await row.getByText(`Editar ${contactName}`).click();
  await row.getByLabel("Cargo ou função").fill("Síndica");
  await row.getByRole("button", { name: "Salvar responsável" }).click();
  await expect(row.getByText("Responsável atualizado.")).toBeVisible({ timeout: 60_000 });

  await openConfirm(row.getByRole("button", { name: "Anonimizar (LGPD)" }), row.getByRole("button", { name: "Confirmar anonimização" }));
  await row.getByRole("button", { name: "Confirmar anonimização" }).click();
  await expect(contacts.getByRole("listitem").filter({ hasText: "Contato removido" }).first()).toBeVisible({ timeout: 60_000 });
  await expect(contacts.getByText(`sindica.${ts}@exemplo.test`)).toHaveCount(0);

  // B-18: foto do cadastro anexada ao cliente; desativar pede motivo, que aparece no histórico.
  const docs = panel(page, "Documentos e fotos");
  await docs.getByLabel("Tipo").selectOption({ label: "Foto do cadastro" });
  await docs.getByLabel("Categoria").fill(`Fachada ${ts}`);
  await uploadPhotos(page, [PHOTO_A], docs);
  await docs.getByRole("button", { name: "Anexar ao cliente" }).click();
  await expect(docs.getByText("Arquivo anexado ao cliente.")).toBeVisible({ timeout: 60_000 });
  await expect(docs.getByText(`Fachada ${ts}`)).toBeVisible();
  const status = panel(page, "Situação do cadastro");
  await status.getByLabel("Motivo da desativação").fill(`Contrato encerrado E2E ${ts}`);
  await status.getByRole("button", { name: "Desativar cliente" }).click();
  await expect(page.getByText("Cliente desativado. Locais, chamados e relatórios continuam no histórico.")).toBeVisible({ timeout: 60_000 });
  await expect(panel(page, "Histórico do cadastro")).toContainText(`Contrato encerrado E2E ${ts}`);

  // Configurações: aviso dos dados divergentes e salvamento sem alterar valores.
  await page.goto("/admin/configuracoes");
  await expect(page.getByText("Os documentos de referência trazem dados divergentes")).toBeVisible();
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByText("Configurações salvas.")).toBeVisible({ timeout: 60_000 });

  // Lista de escolha: adicionar, desativar (sem excluir) e o item continua listado.
  await page.getByRole("link", { name: /Motivos de pendência/ }).click();
  await page.waitForURL(/\/catalogos\/motivos-pendencia/, { timeout: 120_000 });
  const add = panel(page, "Adicionar motivo");
  await add.getByLabel("Nome do item").fill(reason);
  await add.getByRole("button", { name: "Adicionar" }).click();
  await expect(add.getByText(`“${reason}” adicionado(a)`)).toBeVisible({ timeout: 60_000 });
  const item = page.getByRole("listitem").filter({ hasText: reason });
  await item.getByRole("button", { name: "Desativar" }).click();
  await expect(item.getByText("Desativado", { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(item.getByRole("button", { name: "Reativar" })).toBeVisible();
});
