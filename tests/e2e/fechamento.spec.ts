import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { USERS, login } from "./helpers";

/** T-A9 (UI), T-A11 e T-A12: fechamento de setembro/2026 com snapshot, PDF com mês/ano e versões. */
test("fechamento mensal: apurar, emitir v1, exportar PDF e emitir v2 preservando v1", async ({ page }) => {
  test.setTimeout(720_000);
  await login(page, USERS.admin);
  await page.goto("/admin/fechamentos");
  await page.getByLabel("Cliente e unidade").selectOption({ label: "Condomínio Jardim Exemplo — Torre A" });
  await page.getByRole("combobox", { name: "Mês", exact: true }).selectOption("9");
  await page.getByRole("spinbutton", { name: "Ano", exact: true }).fill("2026");
  await page.getByRole("button", { name: "Apurar" }).click();

  await expect(page.getByText("SETEMBRO / 2026").first()).toBeVisible();
  // Chamado resolvido em outubro continua pendente no fechamento de setembro.
  await expect(page.getByText("Vazamento no cano do subsolo").first()).toBeVisible();
  await expect(page.getByText(/Falta de material/).first()).toBeVisible();
  // Antigo (julho) concluído em setembro aparece nas conclusões.
  await expect(page.getByText("Troca de luminárias dos elevadores").first()).toBeVisible();

  await page.getByRole("link", { name: "Incluir demonstrativo de diárias" }).click();
  await page.waitForURL(/diarias=1/, { timeout: 120_000 });
  await expect(page.getByText("Demonstrativo de diárias/horas (valor de serviço)")).toBeVisible({ timeout: 120_000 });

  // Emite a versão 1 (ou nova versão, se o teste já rodou antes).
  const issueFirst = page.getByRole("button", { name: "Fechar mês e emitir versão 1" });
  if (await issueFirst.isVisible()) {
    await issueFirst.click();
  } else {
    await page.getByLabel("Motivo da nova versão").fill("Reemissão pelo teste automatizado");
    await page.getByRole("button", { name: "Emitir nova versão" }).click();
  }
  await expect(page.getByText("Versão emitida.")).toBeVisible({ timeout: 150_000 });
  const firstVersionLabel = (await page.locator("main").getByText(/^Mostrando a versão \d+/).innerText()).match(/versão (\d+)/)![1]!;
  const n = Number(firstVersionLabel);

  // Exportar PDF: nome com cliente, unidade, mês por extenso e ano.
  await page.getByRole("button", { name: "Exportar PDF", exact: true }).click();
  const expected = n === 1 ? "Relatorio_Condominio_Jardim_Exemplo_Torre_A_Setembro_2026.pdf" : `Relatorio_Condominio_Jardim_Exemplo_Torre_A_Setembro_2026_v${n}.pdf`;
  const link = page.getByRole("link", { name: `Baixar ${expected}` });
  await expect(link).toBeVisible({ timeout: 240_000 });
  const [file] = await Promise.all([page.waitForEvent("download"), link.click()]);
  expect(file.suggestedFilename()).toBe(expected);
  const pdf = readFileSync(await file.path());
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.length).toBeGreaterThan(50_000); // contém fotos

  // Nova versão com motivo; a anterior continua listada.
  await page.getByLabel("Motivo da nova versão").fill("Correção de texto de um dia");
  await page.getByRole("button", { name: "Emitir nova versão" }).click();
  await expect(page.getByText("Versão emitida.")).toBeVisible({ timeout: 150_000 });
  await expect(page.getByRole("link", { name: new RegExp(`^Versão ${n + 1}`) })).toBeVisible();
  const previous = page.getByRole("link", { name: new RegExp(`^Versão ${n}(?![0-9])`) });
  await expect(previous).toBeVisible();
  await previous.first().click();
  await expect(page.getByText(`Mostrando a versão ${n},`)).toBeVisible();
});
