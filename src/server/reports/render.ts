import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Browser } from "playwright";
import { PDF_MARGINS } from "@/reports/layout";
import { env } from "@/server/env";
import { waitForService } from "./wait-for-service";

export type RenderInput = {
  html: string;
  assets: Map<string, Buffer>;
  headerHtml: string;
  footerHtml: string;
};

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright");
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b?.isConnected()) return b;
  }
  browserPromise = chromium.launch();
  return browserPromise;
}

export async function closeRenderer() {
  if (!browserPromise) return;
  const b = await browserPromise.catch(() => null);
  browserPromise = null;
  await b?.close();
}

/** HTML + imagens locais → PDF A4 com cabeçalho/rodapé e numeração de páginas. */
export async function renderPdf(input: RenderInput): Promise<Buffer> {
  if (env.pdfRenderer === "gotenberg") return renderWithGotenberg(input);

  const dir = await mkdtemp(path.join(tmpdir(), "megagyn-pdf-"));
  try {
    for (const [name, buffer] of input.assets) await writeFile(path.join(dir, name), buffer);
    const index = path.join(dir, "index.html");
    await writeFile(index, input.html, "utf8");

    const browser = await getBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(180_000);
    try {
      await page.goto(pathToFileURL(index).href, { waitUntil: "load", timeout: 120_000 });
      await page.evaluate(() =>
        Promise.all(
          Array.from(document.images).map((img) =>
            img.complete ? null : new Promise((resolve) => ((img.onload = resolve), (img.onerror = resolve))),
          ),
        ),
      );
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: input.headerHtml,
        footerTemplate: input.footerHtml,
        margin: PDF_MARGINS,
      });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Alternativa para hospedagem sem Chromium local (ex.: Vercel). Verificada em 29/10/2026 com gotenberg/gotenberg:8 (mesmo PDF de 37 páginas do teste pdf-long). */
async function renderWithGotenberg(input: RenderInput): Promise<Buffer> {
  if (!env.gotenbergUrl) throw new Error("GOTENBERG_URL não configurada.");
  const base = env.gotenbergUrl.replace(/\/$/, "");
  // Em plano gratuito o Gotenberg dorme; espera-se ele acordar em vez de falhar.
  await waitForService(`${base}/health`);
  const form = new FormData();
  const wrap = (body: string) => `<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`;
  form.append("files", new Blob([input.html], { type: "text/html" }), "index.html");
  form.append("files", new Blob([wrap(input.headerHtml)], { type: "text/html" }), "header.html");
  form.append("files", new Blob([wrap(input.footerHtml)], { type: "text/html" }), "footer.html");
  for (const [name, buffer] of input.assets) form.append("files", new Blob([new Uint8Array(buffer)]), name);
  const mm = (v: string) => String(Number.parseFloat(v) / 25.4);
  form.append("paperWidth", "8.27");
  form.append("paperHeight", "11.7");
  form.append("marginTop", mm(PDF_MARGINS.top));
  form.append("marginBottom", mm(PDF_MARGINS.bottom));
  form.append("marginLeft", mm(PDF_MARGINS.left));
  form.append("marginRight", mm(PDF_MARGINS.right));
  form.append("printBackground", "true");
  const res = await fetch(`${base}/forms/chromium/convert/html`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Gotenberg respondeu ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Quantidade de páginas (objetos /Type /Page do PDF gerado pelo Chromium). */
export function countPdfPages(pdf: Buffer): number | null {
  const text = pdf.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page(?!s)/g);
  return matches ? matches.length : null;
}
