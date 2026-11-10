import { expect, test } from "@playwright/test";
import { PHOTO_A, USERS, login, mobilePage, uploadPhotos } from "./helpers";

test.setTimeout(180_000);

/** R-20: a administração remove foto errada com motivo; ela fica marcada e o histórico registra. */
test("administração remove foto do chamado com motivo", async ({ page, browser }) => {
  const title = `Foto errada E2E ${Date.now()}`;
  await login(page, USERS.admin);
  await page.goto("/admin/chamados/novo");
  await page.locator('select[name="client_id"]').selectOption({ label: "Condomínio Jardim Exemplo" });
  await page.locator('select[name="site_id"]').selectOption({ label: "Torre A" });
  await page.getByLabel("Nome do solicitante").fill("Síndica Demo (fictícia)");
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Descrição do problema").fill("Teste automatizado de remoção de foto.");
  await uploadPhotos(page, [PHOTO_A]);
  await page.getByRole("button", { name: "Abrir chamado" }).click();
  await page.waitForURL(/\/admin\/chamados\/[0-9a-f-]{36}/);

  await page.getByRole("button", { name: "Remover foto" }).click();
  await page.getByLabel("Por que remover?").fill("Foto de outra obra");
  await page.getByRole("button", { name: "Confirmar remoção" }).click();
  // O formulário sai da tela com a foto já removida: o selo "Removida" é a confirmação.
  await expect(page.getByText("Removida", { exact: true })).toBeVisible({ timeout: 60_000 });
  await page.reload();
  await expect(page.getByText("Removida", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remover foto" })).toHaveCount(0);
  const src = await page.locator('img[src*="/api/files/"]').first().getAttribute("src");
  expect(src).toBeTruthy();
  // O motivo fica no histórico da O.S. (aba Histórico, B-37).
  await page.getByRole("navigation", { name: "Seções da O.S." }).getByRole("link", { name: /^Histórico/ }).click();
  await expect(page.getByText("Foto de outra obra").first()).toBeVisible();

  // A-02: pelo link direto, a administração ainda abre; a equipe do local recebe 404 sem cache.
  expect((await page.request.get(src!)).status()).toBe(200);
  const worker = await mobilePage(browser);
  await login(worker, USERS.joao);
  const denied = await worker.request.get(src!);
  expect(denied.status()).toBe(404);
  expect(denied.headers()["cache-control"]).toBe("no-store");
  await worker.context().close();
});
