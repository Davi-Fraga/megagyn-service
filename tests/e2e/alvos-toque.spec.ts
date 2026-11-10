import { devices, expect, test, type Browser, type Page } from "@playwright/test";
import { PHOTO_A, USERS, login } from "./helpers";

test.setTimeout(180_000);

/** Elementos tocáveis visíveis menores que 44 × 44 px (recomendação WCAG 2.5.5 e guias de iOS/Android). */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const small: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("a, button, input, select, textarea, [role=button]")) {
      if (el instanceof HTMLInputElement && ["hidden", "file"].includes(el.type)) continue;
      // Link no meio de um texto conta como texto; rádio/caixa dentro de rótulo usa o rótulo como alvo.
      if (el.tagName === "A" && el.closest("p")) continue;
      const target = el instanceof HTMLInputElement && ["radio", "checkbox"].includes(el.type) && el.closest("label") ? el.closest("label")! : el;
      const r = target.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === "hidden") continue;
      if (r.width < 44 || r.height < 44) {
        small.push(`${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute("aria-label") || el.getAttribute("name") || "").trim().slice(0, 40)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return [...new Set(small)];
  });
}

/** Celular estreito: 360 px de largura (Android de entrada), com o toque e a escala do Pixel 7 (B-41). */
async function narrowPage(browser: Browser) {
  const context = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 360, height: 780 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  return context.newPage();
}

/** Palavras dos textos da régua de situação partidas em duas linhas (ex.: "Programad/a" a 360 px). */
async function brokenRulerWords(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const broken: string[] = [];
    for (const span of document.querySelectorAll("ol.regua-trena li > span.tipo-condensada")) {
      const node = span.firstChild;
      if (!node || node.nodeType !== Node.TEXT_NODE) continue;
      let at = 0;
      for (const word of (node.textContent ?? "").split(" ")) {
        if (word) {
          const range = document.createRange();
          range.setStart(node, at);
          range.setEnd(node, at + word.length);
          if (new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size > 1) broken.push(word);
        }
        at += word.length + 1;
      }
    }
    return broken;
  });
}

/** Abre cada tela e confere alvos de 44 px, ausência de rolagem lateral e a régua sem palavra partida. */
async function checkScreens(page: Page, screens: Array<[string, () => Promise<unknown>]>) {
  for (const [name, open] of screens) {
    await open();
    expect.soft(await smallTargets(page), `alvos pequenos em "${name}"`).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect.soft(overflow, `rolagem lateral em "${name}"`).toBe(false);
    expect.soft(await brokenRulerWords(page), `palavra partida na régua em "${name}"`).toEqual([]);
  }
}

/** F6.4 e B-41: telas do funcionário a 360 px, com alvos de toque de pelo menos 44 px e sem rolagem lateral. */
test("campo a 360 px: alvos de toque de 44 px e sem rolagem lateral", async ({ browser, page: admin }) => {
  const tag = `Toque E2E ${Date.now()}`;

  // Um chamado e uma tarefa de hoje para o João (fictícios), para abrir as telas de detalhe.
  await login(admin, USERS.admin);
  await admin.goto("/admin/chamados/novo");
  await admin.locator('select[name="client_id"]').selectOption({ label: "Condomínio Jardim Exemplo" });
  await admin.locator('select[name="site_id"]').selectOption({ label: "Torre A" });
  await admin.getByLabel("Nome do solicitante").fill("Síndica Demo (fictícia)");
  await admin.getByLabel("Título").fill(`${tag} chamado`);
  await admin.getByLabel("Descrição do problema").fill("Teste dos alvos de toque (fictício).");
  await admin.getByText("Já definir responsável e data").click();
  await admin.getByRole("checkbox", { name: "João Funcionário (demo)" }).check();
  await admin.getByRole("button", { name: "Abrir chamado" }).click();
  await admin.waitForURL(/\/admin\/chamados\/[0-9a-f-]{36}/, { timeout: 120_000 });
  const requestId = admin.url().split("/").pop()!.split("?")[0]!;
  await admin.goto("/admin/agenda/nova");
  await admin.getByLabel("O que fazer").fill(`${tag} tarefa`);
  await admin.getByRole("checkbox", { name: "Condomínio Jardim Exemplo — Torre A" }).check();
  await admin.getByRole("checkbox", { name: "João Funcionário (demo)" }).check();
  await admin.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(admin.getByText("Tarefa criada.")).toBeVisible({ timeout: 120_000 });

  const page = await narrowPage(browser);
  await login(page, USERS.joao);
  let taskUrl = "";
  await checkScreens(page, [
    ["Hoje", () => page.goto("/campo")],
    ["Chamados", () => page.goto("/campo/chamados")],
    ["Detalhe do chamado", () => page.goto(`/campo/chamados/${requestId}`)],
    ["Registrar no chamado", () => page.goto(`/campo/chamados/${requestId}/registrar`)],
    ["Concluir o chamado", () => page.goto(`/campo/chamados/${requestId}/concluir`)],
    ["Pendência", () => page.goto(`/campo/chamados/${requestId}/pendencia`)],
    ["Registrar com foto", async () => {
      await page.goto("/campo/registrar");
      await page.locator('input[type="file"][multiple]').first().setInputFiles([PHOTO_A]);
      await expect(page.getByText("1 de 1 recebido(s).")).toBeVisible({ timeout: 60_000 });
    }],
    ["Agenda", () => page.goto("/campo/tarefas")],
    ["Detalhe da tarefa", async () => {
      await page.goto("/campo/tarefas");
      await page.getByRole("link", { name: new RegExp(`${tag} tarefa`) }).first().click();
      await page.waitForURL(/\/campo\/tarefas\/[0-9a-f-]{36}$/);
      taskUrl = page.url();
    }],
    ["Registrar na tarefa", () => page.goto(`${taskUrl}/registrar`)],
    ["Minhas atividades", () => page.goto("/campo/atividades")],
    ["Horas", () => page.goto("/campo/horas")],
    ["Notificações", () => page.goto("/campo/notificacoes")],
  ]);
  await page.context().close();

  // A mesma régua com datas, no detalhe da O.S. da administração aberto no celular.
  const office = await narrowPage(browser);
  await login(office, USERS.admin);
  await office.goto(`/admin/chamados/${requestId}`);
  expect(await brokenRulerWords(office), "palavra partida na régua da O.S. (administração)").toEqual([]);
  await office.context().close();
});

/** B-41: compras do encarregado a 360 px (o funcionário não tem acesso a compras). */
test("compras do encarregado a 360 px: alvos de toque de 44 px e sem rolagem lateral", async ({ browser }) => {
  const page = await narrowPage(browser);
  await login(page, USERS.foreman);
  await checkScreens(page, [
    ["Compras", () => page.goto("/campo/compras")],
    ["Nova compra", () => page.goto("/campo/compras/nova")],
  ]);
  await page.context().close();
});
