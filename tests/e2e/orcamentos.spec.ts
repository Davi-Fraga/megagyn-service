import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { PHOTO_A, USERS, login, uploadPhotos } from "./helpers";

/**
 * T-A14 — orçamento (COMPLEMENTO M7): item global "Cobertura" R$ 7.600,00 com subitens + item
 * detalhado; total e valor por extenso corretos; foto do local; envio; aceite manual; PDF.
 */
test("orçamento com valor global e detalhado, foto, envio, aprovação e PDF", async ({ page }) => {
  test.setTimeout(900_000);
  const title = `Reforma da cobertura E2E ${Date.now()}`;

  await login(page, USERS.admin);
  await page.goto("/admin/orcamentos/novo");
  await page.getByLabel("Cliente").selectOption({ label: "Condomínio Jardim Exemplo" });
  await page.locator('select[name="client_contact_id"]').selectOption({ label: "Síndica Demo (fictícia) (Síndica)" });
  await page.locator('select[name="site_id"]').selectOption({ label: "Torre A (JEX-TA)" });
  await page.locator('input[name="title"]').fill(title);
  await page.locator('input[name="execution_deadline_text"]').fill("30 dias úteis");
  await page.locator('textarea[name="payment_terms"]').fill("50% na aprovação e 50% na entrega (teste)");
  await page.locator('textarea[name="inclusions_text"]').fill("Acompanhamento técnico incluso\nMaterial e mão de obra inclusos");

  // Item 1: valor global por local, com subitens (um por linha).
  const item1 = page.getByRole("group", { name: "Item 1" });
  await item1.locator('input[name="items.0.locationLabel"]').fill("Cobertura");
  await item1.locator('textarea[name="items.0.linesText"]').fill("Reparo e troca de rufos e calhas\nAplicação de manta líquida (fictício)");
  await item1.locator('input[name="items.0.value"]').fill("7.600,00");
  await item1.locator('input[name="items.0.notes"]').fill("Garantia de 01 ano");
  await expect(page.getByTestId("quote-total")).toHaveText("R$ 7.600,00");
  await expect(page.getByTestId("quote-total-words")).toHaveText("sete mil e seiscentos reais");

  // Item 2: quantidade × preço unitário (10 m² × R$ 50,00 = R$ 500,00).
  await page.getByRole("button", { name: "Adicionar item" }).click();
  const item2 = page.getByRole("group", { name: "Item 2" });
  await item2.locator('input[name="items.1.locationLabel"]').fill("Fachada");
  await item2.getByLabel("Quantidade × preço unitário").check();
  await item2.locator('input[name="items.1.quantity"]').fill("10");
  await item2.locator('input[name="items.1.unit"]').fill("m²");
  await item2.locator('input[name="items.1.unitPrice"]').fill("50,00");
  await expect(item2.getByText("R$ 500,00")).toBeVisible();
  await expect(page.getByTestId("quote-total")).toHaveText("R$ 8.100,00");
  await expect(page.getByTestId("quote-total-words")).toHaveText("oito mil e cem reais");

  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await page.waitForURL(/\/admin\/orcamentos\/[0-9a-f-]{36}\?feito=criado/, { timeout: 120_000 });
  await expect(page.getByText("Orçamento criado como rascunho.")).toBeVisible();
  const number = (await page.locator("main").getByText(/^ORC-\d{4}-\d{4}$/).first().innerText()).trim();
  expect(number).toMatch(/^ORC-\d{4}-\d{4}$/);
  const quoteUrl = page.url().split("?")[0]!;

  // Duas edições seguidas na mesma tela (B-08): a segunda só passa se a versão escondida do
  // formulário (updated_at) tiver sido atualizada depois da primeira.
  for (const title of ["Reforma da cobertura (revisada)", "Reforma da cobertura e calhas"]) {
    await page.locator('input[name="title"]').fill(title);
    const saved = page.waitForResponse((r) => r.request().method() === "POST" && r.url().startsWith(quoteUrl), { timeout: 120_000 });
    await page.getByRole("button", { name: "Salvar orçamento" }).click();
    await saved;
    await expect(page.getByText("Orçamento salvo.")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText("alterado depois que você abriu")).toHaveCount(0);
  }
  await page.goto(quoteUrl);
  await expect(page.locator('input[name="title"]')).toHaveValue("Reforma da cobertura e calhas");
  await expect(page.getByTestId("quote-total")).toHaveText("R$ 8.100,00");

  // Foto do local (bucket próprio de orçamentos, vínculo pela RPC).
  const localPhotos = page.locator("#fotos-local");
  await uploadPhotos(page, [PHOTO_A], localPhotos);
  await localPhotos.getByRole("button", { name: "Adicionar fotos" }).click();
  await expect(localPhotos.locator('img[src^="/api/files/"]:visible')).toHaveCount(1, { timeout: 60_000 });

  // Enviar: congela a versão 1.
  // (Asserções sobre o estado salvo, não sobre o aviso: o dev server compartilhado pode recarregar a página.)
  await page.getByRole("button", { name: "Marcar como enviado" }).click();
  await expect(page.getByRole("button", { name: "Registrar aprovação do cliente" })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole("listitem").filter({ hasText: "Versão 1" })).toContainText("R$ 8.100,00");
  await expect(page.getByText("Proposta enviada", { exact: true })).toBeVisible();
  await expect(page.getByText("oito mil e cem reais")).toBeVisible();

  // Aceite manual/administrativo (sem assinatura eletrônica).
  await page.getByLabel("Quem aprovou e como").fill("Síndica Demo (fictícia), por e-mail em resposta à proposta.");
  await page.getByRole("button", { name: "Registrar aprovação do cliente" }).click();
  await expect(page.getByRole("button", { name: "Criar obra a partir deste orçamento" })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole("list", { name: "Situação: Aprovado" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Versão 2" })).toContainText("R$ 8.100,00");
  await expect(page.getByText("Aprovação do cliente registrada", { exact: true })).toBeVisible();

  // PDF A4 com o número e o cliente no nome do arquivo.
  await page.getByRole("button", { name: "Gerar PDF" }).click();
  const download = page.getByRole("link", { name: /^Baixar Orcamento_ORC-/ });
  await expect(download).toBeVisible({ timeout: 180_000 });
  const [file] = await Promise.all([page.waitForEvent("download"), download.click()]);
  expect(file.suggestedFilename()).toMatch(new RegExp(`^Orcamento_${number}_Condominio_Jardim_Exemplo\\.pdf$`));
  expect(file.suggestedFilename().startsWith("Orcamento_ORC-")).toBe(true);
  expect(readFileSync(await file.path()).subarray(0, 5).toString()).toBe("%PDF-");

  // R-68: obra criada a partir do orçamento aprovado (só o cadastro do local; nada de despesas).
  const code = `E2E-${Date.now().toString(36).toUpperCase()}`;
  await page.locator('input[name="name"]').fill(`Obra ${title}`);
  await page.locator('input[name="code"]').fill(code);
  // Espera a resposta da server action (o redirect para /admin/locais/<id> pode ser perdido num recarregamento do dev server).
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.url().startsWith(quoteUrl), { timeout: 120_000 }),
    page.getByRole("button", { name: "Criar obra a partir deste orçamento" }).click(),
  ]);
  await page.goto(quoteUrl);
  await expect(page.getByRole("link", { name: `Obra ${title} (${code})` })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Criar obra a partir deste orçamento" })).toHaveCount(0);

  // Lista com filtro de situação ("Expirado" é derivado da validade).
  await page.goto("/admin/orcamentos?status=aprovado");
  await expect(page.getByRole("link", { name: number })).toBeVisible({ timeout: 60_000 });
  await page.goto("/admin/orcamentos?status=expirado");
  await expect(page.getByRole("heading", { name: "Orçamentos" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("link", { name: number })).toHaveCount(0);
});
