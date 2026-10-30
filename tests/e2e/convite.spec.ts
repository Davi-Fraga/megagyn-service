import { expect, test, type Page } from "@playwright/test";
import { USERS, login, mobilePage } from "./helpers";

test.setTimeout(240_000);

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:49124";

function panel(page: Page, title: string) {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

/** Busca no Mailpit (caixa de e-mail do Supabase local) o link do e-mail enviado para `to`. */
async function inviteLink(to: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const found = (await search.json()) as { messages: Array<{ ID: string }> };
    if (found.messages.length) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${found.messages[0]!.ID}`)).json()) as { HTML: string; Subject: string };
      expect(message.Subject).toContain("convite");
      const href = /href="([^"]*\/auth\/confirm[^"]*)"/.exec(message.HTML)?.[1];
      if (href) return href.replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Nenhum convite chegou para ${to}`);
}

/** F1.7 — administração cadastra sem senha; a pessoa recebe o convite e cria a própria senha. */
test("convite por e-mail: a pessoa cria a própria senha e entra no campo", async ({ page, browser }) => {
  const stamp = Date.now();
  const email = `convite.${stamp}@demo.megagyn.local`;
  const name = `Funcionário Convidado ${stamp}`;

  await login(page, USERS.admin);
  await page.goto("/admin/usuarios");
  const form = panel(page, "Novo usuário");
  await form.getByLabel("Nome completo").fill(name);
  await form.getByLabel("E-mail de acesso").fill(email);
  await form.getByLabel("Papel").selectOption({ label: "Funcionário" });
  await form.getByRole("button", { name: "Cadastrar usuário" }).click();
  await page.waitForURL(/\/admin\/usuarios\/[0-9a-f-]{36}/, { timeout: 120_000 });
  await expect(page.getByText(`Convite enviado para ${email}`)).toBeVisible();
  await expect(page.getByText("Primeiro acesso ainda não feito")).toBeVisible();

  // A pessoa abre o link no celular, cria a senha e cai na tela do campo.
  // O domínio do link vem do site_url do Supabase; abre-se o mesmo caminho no servidor testado.
  const link = new URL(await inviteLink(email));
  const phone = await mobilePage(browser);
  await phone.goto(link.pathname + link.search);
  await expect(phone.getByRole("heading", { name: "Crie sua senha de acesso" })).toBeVisible({ timeout: 60_000 });
  await phone.getByLabel("Nova senha").fill("Convite@2026");
  await phone.getByLabel("Repita a senha").fill("Convite@2026");
  await phone.getByRole("button", { name: "Salvar nova senha" }).click();
  await phone.waitForURL(/\/campo/, { timeout: 60_000 });
  await phone.context().close();

  // Login normal com a senha criada.
  const again = await mobilePage(browser);
  await again.goto("/login");
  await again.getByLabel("E-mail").fill(email);
  await again.getByLabel("Senha").fill("Convite@2026");
  await again.getByRole("button", { name: "Entrar" }).click();
  await again.waitForURL(/\/campo/, { timeout: 60_000 });
  await again.context().close();

  // A ficha mostra que o primeiro acesso aconteceu.
  await page.reload();
  await expect(page.getByText("Primeiro acesso ainda não feito")).toHaveCount(0);
});
