import { expect, test } from "@playwright/test";
import { USERS, login } from "./helpers";

test.setTimeout(180_000);

/** F3.2 — a administração justifica o dia sem execução pela agenda. */
test("administração registra que a tarefa não foi realizada", async ({ page }) => {
  const title = `Sem execução E2E ${Date.now()}`;
  await login(page, USERS.admin);
  await page.goto("/admin/agenda/nova");
  await page.getByLabel("O que fazer").fill(title);
  await page.getByRole("checkbox", { name: "Condomínio Jardim Exemplo — Torre A" }).check();
  await page.getByRole("checkbox", { name: "Carlos Encarregado (demo) (encarregado)" }).check();
  await page.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(page.getByText("Tarefa criada.")).toBeVisible({ timeout: 120_000 });

  const item = page.getByRole("listitem").filter({ hasText: title }).first();
  await item.getByRole("button", { name: "Não foi realizada" }).click();
  await item.getByLabel("Por que não foi feito?").fill("Chuva forte o dia todo");
  await item.getByRole("button", { name: "Registrar motivo" }).click();
  await expect(page.getByText("Não realizada: Chuva forte o dia todo").first()).toBeVisible({ timeout: 60_000 });
});
