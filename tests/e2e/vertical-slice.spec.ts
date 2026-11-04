import { expect, test } from "@playwright/test";
import { PHOTO_A, PHOTO_B, USERS, login, mobilePage, uploadPhotos } from "./helpers";

/**
 * Primeira fatia vertical (T-A1 e T-A2, cenário B — vale para ambos):
 * admin abre chamado com foto → atribui → funcionário relata e envia foto → admin valida → PDF/histórico.
 */
test("chamado de ponta a ponta com evidências e validação", async ({ page, browser }) => {
  const title = `Vazamento E2E ${Date.now()}`;

  // 1. Administração abre o chamado em nome do cliente, com foto, e já programa.
  await login(page, USERS.admin);
  await page.goto("/admin/chamados/novo");
  await page.getByLabel("Cliente e local").selectOption({ label: "Torre A" });
  await page.getByLabel("Nome do solicitante").fill("Síndica Demo (fictícia)");
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Descrição do problema").fill("Cano pingando próximo ao hidrômetro (teste automatizado).");
  await uploadPhotos(page, [PHOTO_A]);
  await page.getByText("Já definir responsável e data").click();
  await page.getByRole("checkbox", { name: "João Funcionário (demo)" }).check();
  await page.getByRole("button", { name: "Abrir chamado" }).click();

  await page.waitForURL(/\/admin\/chamados\/[0-9a-f-]{36}/);
  await expect(page.getByText("Chamado aberto.")).toBeVisible();
  // A régua mostra o nome das cinco etapas; a situação atual é o nome da lista da régua.
  await expect(page.getByRole("list", { name: "Situação: Programada", exact: true })).toBeVisible();
  const number = (await page.locator("main").getByText(/^\d{4}-\d{6}$/).first().innerText()).trim();
  expect(number).toMatch(/^\d{4}-\d{6}$/);
  const requestUrl = page.url();
  const requestId = requestUrl.split("/").pop()!.split("?")[0]!;

  // 2. Funcionário no celular encontra o chamado em "Hoje" e tenta concluir.
  const worker = await mobilePage(browser);
  await login(worker, USERS.joao);
  await expect(worker.getByText(title)).toBeVisible();
  await worker.getByText(title).click();
  await expect(worker.getByRole("heading", { name: title })).toBeVisible();
  await worker.getByRole("link", { name: "Concluí" }).click();

  // Sem foto do resultado: o servidor recusa (regra também imposta no banco).
  await worker.getByLabel("Solução aplicada").fill("Substituída a luva de 50 mm e refeita a vedação.");
  await worker.getByRole("button", { name: "Enviar para validação" }).click();
  await expect(worker.getByText("Envie ao menos 1 foto do resultado.").first()).toBeVisible();

  // Com foto: vai para "Executada".
  await uploadPhotos(worker, [PHOTO_B]);
  await worker.getByRole("button", { name: "Enviar para validação" }).click();
  await expect(worker.getByText("Execução enviada. Agora a Megagyn confere e valida.")).toBeVisible();
  await expect(worker.getByRole("list", { name: "Situação: Executada", exact: true })).toBeVisible();
  await worker.context().close();

  // 3. Administração valida.
  await page.goto(`/admin/chamados/${requestId}`);
  await page.getByRole("button", { name: "Validar e concluir" }).click();
  await expect(page.getByText("Execução validada. Chamado concluído.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("list", { name: "Situação: Concluída", exact: true })).toBeVisible();
  await expect(page.getByText("Execução informada — aguardando validação")).toBeVisible();
  await expect(page.getByText("Validado e concluído")).toBeVisible();

  // 4. PDF da OS com o número no nome do arquivo.
  await page.getByRole("button", { name: "PDF da OS" }).click();
  const download = page.getByRole("link", { name: `Baixar OS_${number}.pdf` });
  await expect(download).toBeVisible({ timeout: 120_000 });
  const [file] = await Promise.all([page.waitForEvent("download"), download.click()]);
  expect(file.suggestedFilename()).toBe(`OS_${number}.pdf`);
  const path = await file.path();
  const { readFileSync } = await import("node:fs");
  expect(readFileSync(path).subarray(0, 5).toString()).toBe("%PDF-");
});
