import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { USERS, login, mobilePage, uploadPhotos } from "./helpers";

// Comprovante fictício próprio (fora de test-results/, que outras execuções podem limpar).
const RECEIPT = path.join(tmpdir(), "megagyn-e2e-despesas", "nota-ficticia.jpg");

test.beforeAll(async () => {
  mkdirSync(path.dirname(RECEIPT), { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="#f4f1ea"/><text x="450" y="200" font-size="56" font-family="Arial" text-anchor="middle">NOTA FICTÍCIA E2E</text><text x="450" y="600" font-size="80" font-family="Arial" text-anchor="middle">R$ 1.000,00</text></svg>`;
  writeFileSync(RECEIPT, await sharp(Buffer.from(svg)).jpeg().toBuffer());
});

/**
 * F-04 (T-A7/T-A8): compra única rateada entre obras → conferência → alteração após
 * aprovação volta para conferência → reembolso registrado pela administração.
 */
test("compra rateada 600/400, conferência, alteração após aprovação e reembolso", async ({ page, browser }) => {
  test.setTimeout(600_000);
  const tag = `e2e${Date.now().toString(36)}`;
  const description = `Material hidráulico ${tag}`;

  // 1. Encarregado no celular registra a compra com comprovante e rateio.
  const field = await mobilePage(browser);
  await login(field, USERS.foreman);
  await field.goto("/campo/compras/nova");
  await field.getByRole("textbox", { name: /fornecedor/i }).fill("Casa do Construtor (fictícia)");
  await field.getByLabel("O que foi comprado").fill(description);
  await field.getByLabel("Valor total (R$)").fill("1.000,00");
  await field.getByLabel("Eu mesmo").check();
  await uploadPhotos(field, [RECEIPT]);

  await field.getByLabel("Obra da parcela 1").selectOption({ label: "Torre A" });
  await field.getByLabel("Valor da parcela 1 (R$)").fill("600,00");
  await field.getByLabel("Finalidade da parcela 1").fill("Reparo da cozinha do salão");
  await field.getByRole("button", { name: "Adicionar obra" }).click();
  await field.getByLabel("Obra da parcela 2").selectOption({ label: "Galpão de montagem" });
  await field.getByLabel("Valor da parcela 2 (R$)").fill("399,99");
  await field.getByLabel("Finalidade da parcela 2").fill("Cobertura");

  // Diferença de R$ 0,01: mensagem clara e envio bloqueado.
  await expect(field.getByText("Rateado R$ 999,99 de R$ 1.000,00 — diferença R$ 0,01")).toBeVisible();
  await expect(field.getByText("Faltam R$ 0,01 para completar o total da compra.").first()).toBeVisible();
  const send = field.getByRole("button", { name: "Enviar para conferência" });
  await expect(send).toBeDisabled();
  await expect(field.getByRole("button", { name: "Salvar rascunho" })).toBeDisabled();

  await field.getByLabel("Valor da parcela 2 (R$)").fill("400,00");
  await expect(field.getByText("Rateado R$ 1.000,00 de R$ 1.000,00 — diferença R$ 0,00")).toBeVisible();
  await expect(send).toBeEnabled();
  await send.click();
  await field.waitForURL(/\/campo\/compras\/[0-9a-f-]{36}\?feito=enviada/, { timeout: 120_000 });
  await expect(field.getByText("Compra enviada para conferência.")).toBeVisible();
  await expect(field.getByText("Em conferência").first()).toBeVisible();
  await expect(field.getByText("Reembolso pendente").first()).toBeVisible();
  const expenseId = new URL(field.url()).pathname.split("/").pop()!;

  // 2. Administração vê em "Em conferência" (total da empresa R$ 1.000,00, não R$ 2.000,00) e aprova.
  await login(page, USERS.admin);
  await page.goto(`/admin/despesas?q=${tag}`);
  await expect(page.getByRole("link", { name: description })).toBeVisible();
  await expect(page.locator('[data-total="inReview"]')).toContainText("R$ 1.000,00");
  await expect(page.locator('[data-total="approved"]')).toContainText("R$ 0,00");

  // Filtrando pela obra: só o valor atribuído a ela.
  const torreA = await page.locator('select[name="obra"] option', { hasText: "Torre A" }).first().getAttribute("value");
  await page.goto(`/admin/despesas?q=${tag}&obra=${torreA}`);
  await expect(page.getByRole("heading", { name: /Valor atribuído a Torre A/ })).toBeVisible();
  await expect(page.locator('[data-total="inReview"]')).toContainText("R$ 600,00");

  // CSV com os mesmos filtros: uma linha por parcela; somar o atribuído dá o total (sem duplicar).
  const csv = await page.request.get(`/api/csv/despesas?q=${tag}`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(csv.headers()["content-disposition"]).toMatch(/^attachment; filename="Despesas_internas_\d{2}-\d{2}-\d{4}\.csv"$/);
  const lines = (await csv.text()).replace(/^﻿/, "").trim().split("\r\n").map((l) => l.split(";"));
  const header = lines[0]!;
  const attributedCol = header.indexOf("Valor atribuído à obra (R$)");
  const totalCol = header.indexOf("Valor total da compra (R$)");
  expect(attributedCol).toBeGreaterThan(-1);
  expect(lines).toHaveLength(3);
  const cents = (v: string) => Number(v.replace(/\./g, "").replace(",", ""));
  expect(lines.slice(1).reduce((n, l) => n + cents(l[attributedCol]!), 0)).toBe(100000);
  expect(lines.slice(1).map((l) => l[totalCol])).toEqual(["1.000,00", "1.000,00"]);

  await page.goto(`/admin/despesas/${expenseId}`);
  await expect(page.getByText("Confere com o total da compra (R$ 1.000,00).")).toBeVisible();
  await page.getByRole("button", { name: "Aprovar compra" }).click();
  await page.waitForURL(/feito=aprovada/, { timeout: 120_000 });
  await expect(page.getByText("Compra aprovada.")).toBeVisible();
  await expect(page.getByText("Aprovada").first()).toBeVisible();

  // 3. Encarregado altera o valor e o rateio de uma compra aprovada → volta para conferência.
  await field.goto(`/campo/compras/${expenseId}`);
  await expect(field.getByText("Aprovada").first()).toBeVisible();
  await field.getByText("Corrigir dados da compra").click();
  await expect(field.getByText("Alterar valor ou rateio devolve a compra para conferência.")).toBeVisible();
  await field.getByLabel("Valor total (R$)").fill("1.100,00");
  await field.getByLabel("Valor da parcela 1 (R$)").fill("700,00");
  await expect(field.getByText("Rateado R$ 1.100,00 de R$ 1.100,00 — diferença R$ 0,00")).toBeVisible();
  await field.getByRole("button", { name: "Salvar alterações" }).click();
  await field.waitForURL(/feito=reenviada/, { timeout: 120_000 });
  await expect(field.getByText("Alteração salva. A compra voltou para conferência da administração.")).toBeVisible();
  await expect(field.getByText("Em conferência").first()).toBeVisible();
  await expect(field.getByText("Aprovação desfeita por alteração de valor, data, pagador ou rateio")).toBeVisible();
  await field.context().close();

  // 4. Administração registra o reembolso (independe da conferência): parcial e depois quitado.
  await page.goto("/admin/reembolsos");
  let row = page.locator(`li[data-reimbursement="${expenseId}"]`);
  await expect(row).toContainText("Saldo R$ 1.100,00");
  await row.getByLabel("Valor pago (R$)").fill("500,00");
  await row.getByRole("button", { name: "Registrar pagamento" }).click();
  await page.waitForURL(/feito=pago/, { timeout: 120_000 });
  await expect(page.getByText("Pagamento registrado. Ainda há saldo a reembolsar.")).toBeVisible();
  row = page.locator(`li[data-reimbursement="${expenseId}"]`);
  await expect(row).toContainText("Saldo R$ 600,00");
  await expect(row).toContainText("Reembolso parcial");
  await row.getByRole("button", { name: "Registrar pagamento" }).click();
  await page.waitForURL(/feito=quitado/, { timeout: 120_000 });
  await expect(page.locator(`li[data-reimbursement="${expenseId}"]`)).toContainText("Reembolso quitado");

  // 5. PDF de despesas internas com o nome do período.
  await page.goto(`/admin/despesas?q=${tag}`);
  const download = page.getByRole("link", { name: /^Baixar Despesas_internas_\d{2}-\d{2}-\d{4}_a_\d{2}-\d{2}-\d{4}\.pdf$/ });
  const pdfButton = page.getByRole("button", { name: "PDF de despesas internas" });
  const working = page.getByRole("button", { name: /Pedindo|Na fila|Gerando PDF/ });
  // Servidor de desenvolvimento compartilhado: um clique antes da hidratação não faz nada; tenta de novo.
  await expect(async () => {
    if (await pdfButton.isVisible()) await pdfButton.click();
    await expect(working.or(download)).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 120_000 });
  await expect(download).toBeVisible({ timeout: 180_000 });
  const [file] = await Promise.all([page.waitForEvent("download"), download.click()]);
  expect(file.suggestedFilename()).toMatch(/^Despesas_internas_01-\d{2}-\d{4}_a_\d{2}-\d{2}-\d{4}\.pdf$/);
  expect(readFileSync(await file.path()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("funcionário não vê compras", async ({ browser }) => {
  const worker = await mobilePage(browser);
  await login(worker, USERS.joao);
  await worker.goto("/campo/compras");
  await worker.waitForURL(/acesso-negado/);
  await worker.context().close();
});
