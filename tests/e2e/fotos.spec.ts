import { expect, test } from "@playwright/test";
import { PHOTO_A, USERS, login, uploadPhotos } from "./helpers";

test.setTimeout(180_000);

/** R-20: a administração remove foto errada com motivo; ela fica marcada e o histórico registra. */
test("administração remove foto do chamado com motivo", async ({ page }) => {
  const title = `Foto errada E2E ${Date.now()}`;
  await login(page, USERS.admin);
  await page.goto("/admin/chamados/novo");
  await page.getByLabel("Cliente e local").selectOption({ label: "Torre A" });
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
  await expect(page.getByText("Foto de outra obra").first()).toBeVisible();
});
