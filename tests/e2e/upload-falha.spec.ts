import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
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

/** Muda "Arquivos por envio" nas Configurações (o teste devolve o valor anterior no fim). */
async function setMaxFiles(page: Page, value: string) {
  await page.goto("/admin/configuracoes");
  await page.getByLabel("Arquivos por envio").fill(value);
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByText("Configurações salvas.")).toBeVisible({ timeout: 60_000 });
}

/** B-31: o limite aparece antes do envio; com limite 5, a sexta foto fica de fora na tela e é recusada no servidor. */
test("limite de arquivos por envio vale na tela e no servidor", async ({ page }) => {
  await login(page, USERS.admin);
  await page.goto("/admin/configuracoes");
  const previous = await page.getByLabel("Arquivos por envio").inputValue();
  try {
    await setMaxFiles(page, "5");
    await page.goto("/admin/chamados/novo");
    await page.locator('select[name="client_id"]').selectOption({ label: "Condomínio Jardim Exemplo" });
    await page.locator('select[name="site_id"]').selectOption({ label: "Torre A" });
    await expect(page.getByText(/^Foto JPG, PNG ou WEBP, até \d+ MB cada\. Até 5 arquivos por envio\.$/)).toBeVisible();

    const photo = readFileSync(PHOTO_A);
    const six = Array.from({ length: 6 }, (_, i) => ({ name: `limite-${i + 1}.jpg`, mimeType: "image/jpeg", buffer: photo }));
    await page.locator('input[type="file"][multiple]').first().setInputFiles(six);
    await expect(page.getByText("Até 5 arquivos por envio: 1 ficou de fora.")).toBeVisible();
    await expect(page.getByText("5 de 5 recebido(s).")).toBeVisible({ timeout: 60_000 });

    // No servidor: uma sexta foto acrescentada à mão no formulário é recusada, e nenhum chamado é aberto.
    await page.getByLabel("Nome do solicitante").fill("Síndica Demo (fictícia)");
    await page.getByLabel("Título").fill(`Limite de fotos E2E ${Date.now()}`);
    await page.getByLabel("Descrição do problema").fill("Seis fotos num envio com limite 5 (teste automatizado).");
    const submit = page.getByRole("button", { name: "Abrir chamado" });
    await page.locator("form").filter({ has: submit }).evaluate((form) => {
      const extra = document.createElement("input");
      extra.type = "hidden";
      extra.name = "photo_ids";
      extra.value = crypto.randomUUID();
      form.appendChild(extra);
    });
    await submit.click();
    await expect(page.getByText("Envie no máximo 5 arquivos por vez.").first()).toBeVisible({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/admin\/chamados\/novo/);
  } finally {
    await setMaxFiles(page, previous);
  }
});

/** Cenário 23: reenvio do mesmo arquivo (mesmo clientUploadId, como faz o "Tentar de novo") devolve o mesmo anexo. */
test("reenvio com o mesmo identificador devolve o mesmo anexo", async ({ page }) => {
  await login(page, USERS.admin);
  await page.goto("/admin/chamados/novo");
  await page.locator('select[name="client_id"]').selectOption({ label: "Condomínio Jardim Exemplo" });
  const site = page.locator('select[name="site_id"]');
  await site.selectOption({ label: "Torre A" });
  const siteId = await site.inputValue();
  const clientUploadId = randomUUID();
  const send = async () => {
    const res = await page.request.post("/api/uploads", {
      multipart: { file: { name: "reenvio.jpg", mimeType: "image/jpeg", buffer: readFileSync(PHOTO_A) }, purpose: "photo", clientUploadId, siteId },
    });
    expect(res.status()).toBe(200);
    return (await res.json()) as { id: string; duplicate?: boolean };
  };
  const first = await send();
  expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(await send()).toMatchObject({ id: first.id, duplicate: true });
});
