import { expect, test, type Page } from "@playwright/test";
import { PHOTO_A, USERS, login, mobilePage, uploadPhotos } from "./helpers";

// O painel lê todos os chamados (paginado); na base local, com milhares de chamados de testes, cada abertura leva cerca de 1 minuto.
test.setTimeout(1_200_000);

type Reader = (page: Page) => Promise<string>;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const NO_TOTAL = "(a lista não mostra o total)";

/** Total no resumo da lista ("N chamado(s) encontrado(s)", "N orçamento(s)"...). */
const countIn = (re: RegExp): Reader => async (page) => re.exec(await page.locator("#conteudo").innerText())?.[1] ?? NO_TOTAL;

/** Valor em R$ de um quadro de totais da lista de despesas. */
const moneyIn = (key: "approved" | "inReview"): Reader => async (page) => {
  const box = page.locator(`[data-total="${key}"]`);
  if ((await box.count()) === 0) return NO_TOTAL;
  return clean(/R\$\s*[\d.]+,\d{2}/.exec(await box.innerText())?.[0] ?? NO_TOTAL);
};

const REQUESTS = countIn(/(\d+) chamado\(s\) encontrado\(s\)/);

/** Todos os cartões do painel e como ler o total da lista que cada um abre. */
const CARDS: ReadonlyArray<readonly [string, Reader]> = [
  ["Aguardando triagem", REQUESTS],
  ["Aguardando validação", REQUESTS],
  ["Com prazo vencido", REQUESTS],
  ["Novos hoje", REQUESTS],
  ["Por situação", REQUESTS],
  ["Pendências por motivo", REQUESTS],
  ["Pendências por responsável", REQUESTS],
  ["Tarefas e visitas de hoje", countIn(/(\d+) tarefa\(s\)/)],
  ["Obras e unidades ativas", countIn(/(\d+) local\(is\) encontrado\(s\)/)],
  ["Atividades registradas", countIn(/(\d+) atividade\(s\) no período/)],
  ["Despesas aprovadas (custo interno)", moneyIn("approved")],
  ["Despesas em conferência (custo interno)", moneyIn("inReview")],
  ["Orçamentos em aberto (valor comercial)", countIn(/(\d+) orçamento\(s\)/)],
];

/**
 * Abre uma tela da administração. A base local é compartilhada com outros testes e uma
 * consulta pode estourar o tempo do banco: nesse caso a tela de erro aparece e o teste
 * faz o mesmo que a pessoa faria, abrir de novo (uma vez).
 */
async function openAdmin(page: Page, href: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(href);
    if ((await page.locator("#conteudo").count()) > 0) return;
  }
  throw new Error(`a tela ${href} não abriu`);
}

/**
 * Abre o painel com o filtro, lê o número de cada cartão e confere com o total da lista
 * que o cartão abre. Asserções "soft": uma execução mostra todas as divergências.
 */
async function expectCardsMatchLists(page: Page, filter: Record<string, string>) {
  const qs = new URLSearchParams(filter).toString();
  const label = qs || "sem filtro";
  await openAdmin(page, `/admin${qs ? `?${qs}` : ""}`);
  await expect(page.locator("#conteudo .tipo-placa"), "todos os cartões estão no teste").toHaveCount(CARDS.length);

  const cards: Array<{ title: string; read: Reader; value: string; href: string }> = [];
  for (const [title, read] of CARDS) {
    const link = page.getByRole("link", { name: title, exact: true });
    const card = page.locator("#conteudo div.relative").filter({ has: link });
    await expect(card).toHaveCount(1);
    const value = clean(await card.locator(".tipo-placa").innerText());
    cards.push({ title, read, value, href: (await link.getAttribute("href"))! });
  }
  for (const c of cards) {
    await openAdmin(page, c.href);
    expect.soft(await c.read(page), `cartão "${c.title}" (${label}) → ${c.href}`).toBe(c.value);
  }
  return Object.fromEntries(cards.map((c) => [c.title, c.value]));
}

/** Valor de uma opção pelo texto exato (ids dos dados de demonstração). */
async function optionValue(page: Page, select: string, text: string) {
  const value = await page.locator(`select[name="${select}"]`).evaluate((el, t) => [...(el as HTMLSelectElement).options].find((o) => o.text === t)?.value, text);
  expect(value, `opção "${text}" em ${select}`).toBeTruthy();
  return value!;
}

/**
 * B-11 (A-11; F5.6 E-dashboard-drilldown): para cada cartão do painel, o número é o total
 * da lista que ele abre, com os mesmos filtros (sem filtro, cliente, profissional, local e período).
 */
test("painel: cada cartão abre a lista com o mesmo número e os mesmos filtros", async ({ page, browser }) => {
  const tag = `painel${Date.now().toString(36)}`;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const weekAgo = new Date(Date.parse(`${today}T12:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10);

  await test.step("dados fictícios: duas pendências do mesmo responsável, tarefas, atividade e compra em dois clientes", async () => {
    await login(page, USERS.admin);
    const ids: string[] = [];
    for (const n of [1, 2]) {
      await page.goto("/admin/chamados/novo");
      await page.getByLabel("Cliente e local").selectOption({ label: "Torre A" });
      await page.getByLabel("Nome do solicitante").fill("Síndica Demo (fictícia)");
      await page.getByLabel("Título").fill(`Pendência ${tag} ${n}`);
      await page.getByLabel("Descrição do problema").fill("Teste do painel (fictício).");
      await page.getByText("Já definir responsável e data").click();
      await page.getByRole("checkbox", { name: "João Funcionário (demo)" }).check();
      await page.getByRole("button", { name: "Abrir chamado" }).click();
      await page.waitForURL(/\/admin\/chamados\/[0-9a-f-]{36}/, { timeout: 120_000 });
      ids.push(page.url().split("/").pop()!.split("?")[0]!);
    }

    // Duas pendências, as duas com Carlos na próxima ação: 2 pendências, 1 responsável.
    const worker = await mobilePage(browser);
    await login(worker, USERS.joao);
    for (const id of ids) {
      await worker.goto(`/campo/chamados/${id}`);
      await worker.getByRole("link", { name: "Não consegui concluir" }).click();
      await worker.getByLabel("Por que não deu para concluir?").selectOption({ label: "Falta de material" });
      await worker.getByLabel("Explique o que aconteceu").fill("Faltou material (fictício).");
      await worker.getByLabel("O que precisa ser feito").fill("Comprar o material.");
      await worker.getByLabel("Quem faz a próxima ação").selectOption({ label: "Carlos Encarregado (demo) (encarregado)" });
      await worker.getByLabel("Previsão de retorno").fill(today);
      await worker.getByRole("button", { name: "Registrar pendência" }).click();
      await expect(worker.getByText("Pendência registrada.")).toBeVisible({ timeout: 120_000 });
    }
    await worker.context().close();

    // Tarefas de hoje em dois clientes, com profissionais diferentes.
    const tasks = [
      ["Condomínio Jardim Exemplo — Torre A", "João Funcionário (demo)"],
      ["Indústria Modelo — Galpão de montagem", "Carlos Encarregado (demo) (encarregado)"],
    ] as const;
    for (const [site, person] of tasks) {
      await page.goto("/admin/agenda/nova");
      await page.getByLabel("O que fazer").fill(`Vistoria ${tag}`);
      await page.getByRole("checkbox", { name: site }).check();
      await page.getByRole("checkbox", { name: person }).check();
      await page.getByRole("button", { name: "Criar tarefa" }).click();
      await expect(page.getByText("Tarefa criada.")).toBeVisible({ timeout: 120_000 });
    }

    // Encarregado: atividade no Galpão (outro cliente) e compra rateada Torre A / Galpão, em conferência.
    const field = await mobilePage(browser);
    await login(field, USERS.foreman);
    await field.goto("/campo/registrar");
    await field.getByLabel("Onde foi feito").selectOption({ label: "Galpão de montagem — Indústria Modelo" });
    await field.getByLabel("O que foi feito").fill(`Limpeza do pátio ${tag}`);
    await field.getByRole("button", { name: "Salvar registro" }).click();
    await field.waitForURL(/feito=registro/, { timeout: 120_000 });

    await field.goto("/campo/compras/nova");
    await field.getByRole("textbox", { name: /fornecedor/i }).fill("Depósito Exemplo (fictício)");
    await field.getByLabel("O que foi comprado").fill(`Material ${tag}`);
    await field.getByLabel("Valor total (R$)").fill("1.000,00");
    await field.getByLabel("Eu mesmo").check();
    await uploadPhotos(field, [PHOTO_A]);
    await field.getByLabel("Obra da parcela 1").selectOption({ label: "Torre A" });
    await field.getByLabel("Valor da parcela 1 (R$)").fill("600,00");
    await field.getByLabel("Finalidade da parcela 1").fill("Reparo (fictício)");
    await field.getByRole("button", { name: "Adicionar obra" }).click();
    await field.getByLabel("Obra da parcela 2").selectOption({ label: "Galpão de montagem" });
    await field.getByLabel("Valor da parcela 2 (R$)").fill("400,00");
    await field.getByLabel("Finalidade da parcela 2").fill("Cobertura (fictícia)");
    await field.getByRole("button", { name: "Enviar para conferência" }).click();
    await field.waitForURL(/\/campo\/compras\/[0-9a-f-]{36}\?feito=enviada/, { timeout: 120_000 });
    await field.context().close();
  });

  // Ids pelos filtros da agenda (mesmas opções do painel, tela mais leve).
  await openAdmin(page, "/admin/agenda");
  const condo = await optionValue(page, "cliente", "Condomínio Jardim Exemplo");
  const torreA = await optionValue(page, "local", "Condomínio Jardim Exemplo — Torre A");
  const joao = await optionValue(page, "pessoa", "João Funcionário (demo)");
  const carlos = await optionValue(page, "pessoa", "Carlos Encarregado (demo)");

  await test.step("sem filtro", async () => {
    await expectCardsMatchLists(page, {});
  });

  await test.step("filtro de cliente", async () => {
    const v = await expectCardsMatchLists(page, { cliente: condo });
    expect(Number(v["Pendências por responsável"]), "as duas pendências do teste contam").toBeGreaterThanOrEqual(2);
    expect(Number(v["Tarefas e visitas de hoje"])).toBeGreaterThanOrEqual(1);
  });

  await test.step("filtro de profissional", async () => {
    const v = await expectCardsMatchLists(page, { pessoa: joao });
    expect(Number(v["Pendências por responsável"])).toBeGreaterThanOrEqual(2);
    expect(Number(v["Tarefas e visitas de hoje"])).toBeGreaterThanOrEqual(1);
  });

  await test.step("filtro de local, profissional e período", async () => {
    await expectCardsMatchLists(page, { local: torreA, pessoa: carlos, de: weekAgo, ate: today });
  });

  await test.step("filtro de cliente e profissional", async () => {
    await expectCardsMatchLists(page, { cliente: condo, pessoa: carlos });
  });
});
