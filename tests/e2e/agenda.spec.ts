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

/** B-39 — a remarcação fica no histórico da tarefa, com quem fez, quando e o motivo. */
test("administração remarca e vê a mudança no histórico da tarefa", async ({ page }) => {
  const title = `Histórico E2E ${Date.now()}`;
  await login(page, USERS.admin);
  await page.goto("/admin/agenda/nova");
  await page.getByLabel("O que fazer").fill(title);
  await page.getByRole("checkbox", { name: "Condomínio Jardim Exemplo — Torre A" }).check();
  await page.getByRole("checkbox", { name: "Carlos Encarregado (demo) (encarregado)" }).check();
  await page.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(page.getByText("Tarefa criada.")).toBeVisible({ timeout: 120_000 });

  const item = page.getByRole("listitem").filter({ hasText: title }).first();
  await item.getByText("Remarcar ou cancelar").click();
  await item.getByLabel("Motivo").fill("Material atrasou");
  await item.getByRole("button", { name: "Remarcar" }).click();
  // A tarefa muda de dia na lista e volta com o formulário fechado (com erro, ele continuaria aberto).
  await expect(item.getByLabel("Motivo")).toBeHidden({ timeout: 60_000 });

  await page.getByRole("link", { name: title }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible({ timeout: 60_000 });
  const history = page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: "Histórico" }) });
  await expect(history.getByText("Responsável incluído: Carlos Encarregado (demo)")).toBeVisible();
  const moved = history.getByRole("listitem").filter({ hasText: /Remarcada em Torre A: de \d{2}\/\d{2}\/\d{4} para \d{2}\/\d{2}\/\d{4}/ });
  await expect(moved).toContainText("Ana Administração (demo)");
  await expect(moved).toContainText("Motivo: Material atrasou");
});
