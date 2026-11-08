import { expect, test, type Page } from "@playwright/test";
import { PHOTO_A, PHOTO_B, USERS, login } from "./helpers";

test.setTimeout(180_000);

const UPLOADS = "**/api/uploads";

async function failUploads(page: Page) {
  await page.route(UPLOADS, (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Falha simulada" }) }),
  );
}

/** A-06: foto que falhou segura o envio até reenviar ou retirar; o registro não sai sem ela. */
test("foto com falha bloqueia o envio até reenviar ou retirar", async ({ page }) => {
  await login(page, USERS.admin);
  await page.goto("/admin/chamados/novo");
  // O campo de fotos aparece depois de escolher o local.
  await page.locator('select[name="client_id"]').selectOption({ label: "Condomínio Jardim Exemplo" });
  await page.locator('select[name="site_id"]').selectOption({ label: "Torre A" });
  const submit = page.getByRole("button", { name: "Abrir chamado" });
  const warning = page.getByText("Uma foto não foi enviada.", { exact: false });
  const fileInput = page.locator('input[type="file"][multiple]').first();

  await failUploads(page);
  await fileInput.setInputFiles([PHOTO_A]);
  await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible({ timeout: 60_000 });
  await expect(submit).toBeDisabled();
  await expect(warning).toBeVisible();

  // Reenvio que dá certo libera o envio.
  await page.unroute(UPLOADS);
  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(page.getByText("1 de 1 recebido(s).")).toBeVisible({ timeout: 60_000 });
  await expect(submit).toBeEnabled();
  await expect(warning).toHaveCount(0);

  // Retirar a foto que falhou também libera.
  await failUploads(page);
  await fileInput.setInputFiles([PHOTO_B]);
  await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible({ timeout: 60_000 });
  await expect(submit).toBeDisabled();
  await page.getByRole("button", { name: "Remover este arquivo do envio" }).last().click();
  await expect(submit).toBeEnabled();
  await expect(warning).toHaveCount(0);
});
