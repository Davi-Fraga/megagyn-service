import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

/** Garante dados de demonstração e gera fotos de teste (fictícias). */
export default async function globalSetup() {
  execSync("npx tsx scripts/seed-demo.ts", { stdio: "inherit" });
  mkdirSync("tests/e2e/.fixtures", { recursive: true });
  for (const [name, color] of [["foto-a.jpg", "#7d8b6a"], ["foto-b.jpg", "#5b7083"]] as const) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="${color}"/><text x="800" y="620" font-size="90" font-family="Arial" fill="#fff" text-anchor="middle">FOTO DE TESTE E2E</text></svg>`;
    writeFileSync(`tests/e2e/.fixtures/${name}`, await sharp(Buffer.from(svg)).jpeg().toBuffer());
  }
}
