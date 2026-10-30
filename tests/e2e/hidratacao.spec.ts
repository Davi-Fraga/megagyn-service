import { expect, test } from "@playwright/test";
import { USERS, login } from "./helpers";

test.setTimeout(120_000);

/**
 * Antes de o JavaScript carregar (rede fraca), um clique no botão de PDF se perdia sem aviso.
 * O HTML do servidor precisa trazer o botão desabilitado até a página ficar interativa.
 */
test("botão de PDF chega desabilitado no HTML do servidor", async ({ browser, page }) => {
  await login(page, USERS.admin);
  const state = await page.context().storageState();
  const noJs = await browser.newContext({ javaScriptEnabled: false, storageState: state });
  const ssr = await noJs.newPage();
  await ssr.goto("/admin/despesas");
  const buttons = ssr.getByRole("button", { name: /PDF/ });
  expect(await buttons.count()).toBeGreaterThan(0);
  for (const b of await buttons.all()) await expect(b).toBeDisabled();
  await noJs.close();

  // Com JavaScript, o mesmo botão fica disponível.
  await page.goto("/admin/despesas");
  await expect(page.getByRole("button", { name: /PDF/ }).first()).toBeEnabled();
});
