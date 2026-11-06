import { expect, test, type Page } from "@playwright/test";
import { USERS, login } from "./helpers";

test.setTimeout(180_000);

async function openAdmin(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await login(page, USERS.admin);
  await page.goto("/admin/usuarios");
  const menu = page.getByRole("navigation", { name: "Menu da administração" });
  await expect(menu.getByRole("link", { name: "Usuários" })).toBeVisible();
  return menu;
}

/** Menu lateral da administração: "Sair" à vista sem rolar e todos os itens alcançáveis em tela baixa. */
test("menu lateral em tela de notebook: sair à vista e itens alcançáveis", async ({ page }) => {
  // Notebook de 1366 × 768 com a barra do navegador: sobram uns 650 px de altura útil.
  const menu = await openAdmin(page, { width: 1366, height: 650 });
  await expect(page.getByRole("button", { name: "Sair" })).toBeInViewport({ ratio: 1 });

  // O último item do menu chega à tela rolando só a lista, sem tirar o "Sair" de vista.
  const last = menu.getByRole("link", { name: "Auditoria" });
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("button", { name: "Sair" })).toBeInViewport({ ratio: 1 });
});

/** Em monitor Full HD o menu inteiro cabe: nenhum item escondido atrás de uma rolagem sem aviso. */
test("menu lateral em monitor Full HD: todos os itens à vista sem rolar", async ({ page }) => {
  // 1920 × 1080 com a barra do navegador: sobram uns 950 px de altura útil.
  const menu = await openAdmin(page, { width: 1920, height: 950 });
  await expect(menu.getByRole("link", { name: "Auditoria" })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("button", { name: "Sair" })).toBeInViewport({ ratio: 1 });
});
