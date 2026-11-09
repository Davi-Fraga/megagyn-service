import { expect, test, type Locator, type Page } from "@playwright/test";
import { USERS, login } from "./helpers";

/**
 * B-23: ao escolher o cliente, a lista de locais mostra só os locais dele. Na O.S. e no
 * orçamento, um local de outro cliente enviado à mão é recusado pelo servidor. Na tarefa, o
 * cliente é só um filtro: a tarefa pode ter locais de vários clientes (decisão de 08/11/2026).
 */

const CONDO = "Condomínio Jardim Exemplo";
const INDUSTRIA = "Indústria Modelo";

const optionLabels = (select: Locator) => select.locator("option").allInnerTexts();

/** Valor (id) da opção de um local, lido da lista quando o cliente dele está escolhido. */
async function siteValue(page: Page, client: Locator, site: Locator, clientName: string, siteLabel: RegExp) {
  await client.selectOption({ label: clientName });
  return site.locator("option").filter({ hasText: siteLabel }).first().getAttribute("value");
}

/** Escolhe o cliente e força, como faria uma requisição montada à mão, um local de outro cliente. */
async function forceSite(site: Locator, value: string) {
  await site.evaluate((el, v) => {
    const select = el as HTMLSelectElement;
    const option = document.createElement("option");
    option.value = v;
    option.textContent = "Local de outro cliente";
    select.appendChild(option);
    select.value = v;
  }, value);
}

test("O.S.: os locais mudam com o cliente, e local de outro cliente é recusado", async ({ page }) => {
  await login(page, USERS.admin);
  await page.goto("/admin/chamados/novo");
  const client = page.locator('select[name="client_id"]');
  const site = page.locator('select[name="site_id"]');

  await client.selectOption({ label: CONDO });
  expect(await optionLabels(site)).toEqual(expect.arrayContaining(["Torre A"]));
  expect(await optionLabels(site)).not.toContain("Galpão de montagem");
  await client.selectOption({ label: INDUSTRIA });
  expect(await optionLabels(site)).toContain("Galpão de montagem");
  expect(await optionLabels(site)).not.toContain("Torre A");

  const galpao = (await siteValue(page, client, site, INDUSTRIA, /Galpão de montagem/))!;
  await client.selectOption({ label: CONDO });
  await forceSite(site, galpao);
  await page.getByLabel("Título").fill(`Cascata E2E ${Date.now()}`);
  await page.getByLabel("Descrição do problema").fill("Local de outro cliente enviado à mão.");
  await page.getByRole("button", { name: "Abrir chamado" }).click();
  await expect(page.getByText("Escolha uma obra ou unidade deste cliente.").first()).toBeVisible({ timeout: 120_000 });
  await expect(page).toHaveURL(/\/admin\/chamados\/novo/);
});

test("orçamento: os locais mudam com o cliente, e local de outro cliente é recusado", async ({ page }) => {
  await login(page, USERS.admin);
  await page.goto("/admin/orcamentos/novo");
  const client = page.locator('select[name="client_id"]');
  const site = page.locator('select[name="site_id"]');

  await client.selectOption({ label: CONDO });
  expect((await optionLabels(site)).some((l) => l.startsWith("Torre A"))).toBe(true);
  expect((await optionLabels(site)).some((l) => l.startsWith("Galpão"))).toBe(false);

  const galpao = (await siteValue(page, client, site, INDUSTRIA, /Galpão de montagem/))!;
  await client.selectOption({ label: CONDO });
  await forceSite(site, galpao);
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText("Escolha uma obra ou unidade deste cliente.").first()).toBeVisible({ timeout: 120_000 });
});

test("tarefa: o cliente filtra os locais, e o local já marcado de outro cliente continua marcado", async ({ page }) => {
  await login(page, USERS.admin);
  await page.goto("/admin/agenda/nova");
  const filter = page.locator('select[name="client_filter"]');
  const torreA = page.getByRole("checkbox", { name: `${CONDO} — Torre A` });
  const galpao = page.getByRole("checkbox", { name: `${INDUSTRIA} — Galpão de montagem` });

  await expect(torreA).toBeVisible();
  await expect(galpao).toBeVisible();
  await filter.selectOption({ label: INDUSTRIA });
  await expect(galpao).toBeVisible();
  await expect(torreA).toBeHidden();

  await galpao.check();
  await filter.selectOption({ label: CONDO });
  await expect(torreA).toBeVisible();
  await expect(galpao).toBeVisible();
  await expect(galpao).toBeChecked();
});

test("regra de cobrança: unidade de outro cliente é recusada com o erro no campo (B-22)", async ({ page }) => {
  await login(page, USERS.admin);
  await page.goto("/admin/horas");
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Criar regra" }) });
  await form.locator('select[name="client_id"]').selectOption({ label: CONDO });
  await form.locator('select[name="site_id"]').selectOption({ label: `${INDUSTRIA} — Galpão de montagem` });
  await form.locator('input[name="unit_price"]').fill("333,00");
  await form.getByRole("button", { name: "Criar regra" }).click();
  await expect(form.getByText("Escolha uma unidade deste cliente.").first()).toBeVisible({ timeout: 120_000 });
});
