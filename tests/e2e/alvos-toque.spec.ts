import { expect, test, type Page } from "@playwright/test";
import { PHOTO_A, USERS, login, mobilePage } from "./helpers";

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

/** F6.4: telas do campo no celular, com alvos de toque de pelo menos 44 px e sem rolagem lateral. */
test("campo no celular: alvos de toque de 44 px e sem rolagem lateral", async ({ browser }) => {
  const page = await mobilePage(browser);
  await login(page, USERS.joao);
  const screens: Array<[string, () => Promise<unknown>]> = [
    ["Hoje", () => page.goto("/campo")],
    ["Chamados", () => page.goto("/campo/chamados")],
    ["Detalhe do chamado", async () => {
      await page.goto("/campo/chamados");
      const first = page.locator('a[href^="/campo/chamados/"]').first();
      if (await first.count()) await first.click();
      await page.waitForLoadState("networkidle");
    }],
    ["Registrar com foto", async () => {
      await page.goto("/campo/registrar");
      await page.locator('input[type="file"][multiple]').first().setInputFiles([PHOTO_A]);
      await expect(page.getByText("1 de 1 recebido(s).")).toBeVisible({ timeout: 60_000 });
    }],
    ["Agenda", () => page.goto("/campo/tarefas")],
    ["Minhas atividades", () => page.goto("/campo/atividades")],
  ];
  for (const [name, open] of screens) {
    await open();
    expect(await smallTargets(page), `alvos pequenos em "${name}"`).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `rolagem lateral em "${name}"`).toBe(false);
  }
  await page.context().close();
});
