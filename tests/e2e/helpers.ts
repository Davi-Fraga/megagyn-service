import { expect, type Browser, type Page } from "@playwright/test";
import { devices } from "@playwright/test";

export const PASSWORD = "Demo@Megagyn2026";
export const USERS = {
  admin: "admin@demo.megagyn.local",
  foreman: "encarregado@demo.megagyn.local",
  joao: "joao@demo.megagyn.local",
  pedro: "pedro@demo.megagyn.local",
};
export const PHOTO_A = "tests/e2e/.fixtures/foto-a.jpg";
export const PHOTO_B = "tests/e2e/.fixtures/foto-b.jpg";

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** Contexto com tela de celular (equipe de campo). */
export async function mobilePage(browser: Browser) {
  const context = await browser.newContext({ ...devices["Pixel 7"], locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  return context.newPage();
}

export async function uploadPhotos(page: Page, files: string[], scope = page.locator("body")) {
  await scope.locator('input[type="file"][multiple]').first().setInputFiles(files);
  await expect(scope.getByText(`${files.length} de ${files.length} recebido(s).`)).toBeVisible({ timeout: 60_000 });
}
