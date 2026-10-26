import { expect, test } from "@playwright/test";
import { USERS, login } from "./helpers";

test.setTimeout(240_000);

/** F5.6 (E-dashboard-drilldown): o número de cada cartão é o total da lista que ele abre. */
test("painel: cada cartão de chamados abre a lista com o mesmo número", async ({ page }) => {
  await login(page, USERS.admin);
  const cards = ["Aguardando triagem", "Aguardando validação", "Com prazo vencido", "Novos hoje", "Por situação", "Pendências por motivo"];
  for (const title of cards) {
    await page.goto("/admin");
    const link = page.getByRole("link", { name: title, exact: true });
    const card = page.locator("div.relative").filter({ has: link });
    const value = Number((await card.locator(".tipo-placa").first().innerText()).trim());
    await link.click();
    await page.waitForURL(/\/admin\/chamados/);
    const summary = await page.getByText(/chamado\(s\) encontrado\(s\)/).innerText();
    expect(Number(/^(\d+)/.exec(summary.trim())?.[1]), `cartão "${title}"`).toBe(value);
  }
});
