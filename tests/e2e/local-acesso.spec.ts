import { expect, test } from "@playwright/test";
import { USERS, login, mobilePage } from "./helpers";

/** B-21: horário e orientações de acesso do local aparecem para a equipe no chamado do campo. */
test("acesso ao local: a administração preenche e o funcionário vê no chamado", async ({ page, browser }) => {
  const hours = `Segunda a sexta, 7h às 17h (E2E ${Date.now()})`;
  await login(page, USERS.admin);
  await page.goto("/admin/locais");
  await page.getByRole("link", { name: /Torre A/ }).first().click();
  await page.waitForURL(/\/admin\/locais\/[0-9a-f-]{36}/, { timeout: 120_000 });
  await page.getByLabel("Horário de acesso").fill(hours);
  await page.getByLabel("Orientações de acesso").fill("Chave na portaria; avisar o zelador.");
  await page.getByLabel("Responsável na Megagyn").selectOption({ label: "Carlos Encarregado (demo)" });
  await page.getByRole("button", { name: "Salvar dados do local" }).click();
  await expect(page.getByText("Dados do local salvos.")).toBeVisible({ timeout: 120_000 });

  const worker = await mobilePage(browser);
  await login(worker, USERS.joao);
  await worker.goto("/campo/chamados");
  await worker.getByRole("link", { name: /Pintura da parede da sala dos hidrômetros/ }).first().click();
  await worker.waitForURL(/\/campo\/chamados\/[0-9a-f-]{36}/, { timeout: 120_000 });
  const access = worker.getByRole("region", { name: "Acesso ao local" });
  await expect(access).toBeVisible();
  await expect(access).toContainText(hours);
  await expect(access).toContainText("Chave na portaria; avisar o zelador.");
  await expect(access).toContainText("Carlos Encarregado (demo)");
});
