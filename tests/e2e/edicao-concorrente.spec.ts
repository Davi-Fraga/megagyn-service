import { expect, test, type Page } from "@playwright/test";
import { PHOTO_A, USERS, login, uploadPhotos } from "./helpers";

/**
 * B-26 (M-15): duas abas editando o mesmo registro. A aba que salva com dados lidos antes da outra
 * alteração recebe o aviso, e nada do que a primeira gravou é sobrescrito.
 */

const STALE = /foi alterado depois que você abriu a página/;

/** Abre a mesma página numa segunda aba, antes de qualquer alteração. */
async function secondTab(page: Page) {
  const other = await page.context().newPage();
  await other.goto(page.url());
  return other;
}

test("chamado: a segunda aba é avisada e não sobrescreve a primeira", async ({ page }) => {
  const title = `Concorrência E2E ${Date.now()}`;
  await login(page, USERS.admin);
  await page.goto("/admin/chamados/novo");
  await page.locator('select[name="client_id"]').selectOption({ label: "Condomínio Jardim Exemplo" });
  await page.locator('select[name="site_id"]').selectOption({ label: "Torre A" });
  await page.getByLabel("Nome do solicitante").fill("Síndica Demo (fictícia)");
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Descrição do problema").fill("Edição concorrente (teste automatizado).");
  await uploadPhotos(page, [PHOTO_A]);
  await page.getByRole("button", { name: "Abrir chamado" }).click();
  await page.waitForURL(/\/admin\/chamados\/[0-9a-f-]{36}/, { timeout: 120_000 });
  const other = await secondTab(page);

  await page.getByText("Editar dados do chamado").click();
  await page.locator('details input[name="title"]').fill(`${title} (aba 1)`);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Alterações salvas no histórico.")).toBeVisible({ timeout: 120_000 });

  await other.getByText("Editar dados do chamado").click();
  await other.locator('details input[name="title"]').fill(`${title} (aba 2)`);
  await other.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(other.getByText(STALE).first()).toBeVisible({ timeout: 120_000 });

  await other.reload();
  await other.getByText("Editar dados do chamado").click();
  await expect(other.locator('details input[name="title"]')).toHaveValue(`${title} (aba 1)`);

  // Depois de recarregar, a aba lê a versão nova e salva normalmente.
  await other.locator('details input[name="title"]').fill(`${title} (aba 2, recarregada)`);
  await other.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(other.getByText("Alterações salvas no histórico.")).toBeVisible({ timeout: 120_000 });
});

test("cliente: a segunda aba é avisada e não sobrescreve a primeira", async ({ page }) => {
  const name = `Concorrência E2E ${Date.now()}`;
  await login(page, USERS.admin);
  await page.goto("/admin/clientes");
  const form = page.locator("section").filter({ has: page.getByRole("heading", { name: "Novo cliente", exact: true }) });
  await form.getByLabel("Razão social ou nome completo").fill(`${name} Ltda (fictício)`);
  await form.getByLabel("Nome de exibição").fill(name);
  await form.getByRole("button", { name: "Cadastrar cliente" }).click();
  await page.waitForURL(/\/admin\/clientes\/[0-9a-f-]{36}/, { timeout: 120_000 });
  const other = await secondTab(page);

  await page.getByLabel("Nome de exibição").fill(`${name} (aba 1)`);
  await page.getByRole("button", { name: "Salvar dados" }).click();
  await expect(page.getByText("Dados do cliente salvos.")).toBeVisible({ timeout: 120_000 });

  await other.getByLabel("Nome de exibição").fill(`${name} (aba 2)`);
  await other.getByRole("button", { name: "Salvar dados" }).click();
  await expect(other.getByText(STALE).first()).toBeVisible({ timeout: 120_000 });

  await other.reload();
  await expect(other.getByLabel("Nome de exibição")).toHaveValue(`${name} (aba 1)`);
});
