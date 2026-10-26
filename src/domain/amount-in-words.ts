/**
 * Valor monetário por extenso em português do Brasil.
 * Regra do "e" entre grupos: usa-se "e" antes do último grupo quando ele é
 * menor que 100 ou é centena exata (1.100 → "mil e cem"; 1.250 → "mil duzentos e cinquenta").
 */

const UNITS = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos",
];
const SCALES: Array<[singular: string, plural: string]> = [
  ["", ""],
  ["mil", "mil"],
  ["milhão", "milhões"],
  ["bilhão", "bilhões"],
  ["trilhão", "trilhões"],
];

function below1000(n: number): string {
  if (n === 100) return "cem";
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) parts.push(HUNDREDS[h]!);
  if (r) {
    if (r < 20) parts.push(UNITS[r]!);
    else {
      const t = Math.floor(r / 10);
      const u = r % 10;
      parts.push(u ? `${TENS[t]} e ${UNITS[u]}` : TENS[t]!);
    }
  }
  return parts.join(" e ");
}

function integerToWords(n: number): string {
  if (n === 0) return "zero";
  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  if (groups.length > SCALES.length) throw new Error("Valor grande demais para escrever por extenso.");

  const chunks: Array<{ text: string; value: number }> = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const value = groups[i]!;
    if (!value) continue;
    const [singular, plural] = SCALES[i]!;
    let text: string;
    if (i === 0) text = below1000(value);
    else if (i === 1) text = value === 1 ? "mil" : `${below1000(value)} mil`;
    else text = `${below1000(value)} ${value === 1 ? singular : plural}`;
    chunks.push({ text, value });
  }

  return chunks.reduce((acc, chunk, idx) => {
    if (idx === 0) return chunk.text;
    const isLast = idx === chunks.length - 1;
    const joiner = isLast && (chunk.value < 100 || chunk.value % 100 === 0) ? " e " : " ";
    return acc + joiner + chunk.text;
  }, "");
}

export function centsToWords(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error("Informe um valor inteiro e não negativo em centavos.");
  }
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;

  if (reais === 0 && centavos === 0) return "zero real";

  let reaisText = "";
  if (reais === 1) reaisText = "um real";
  else if (reais > 1) {
    const exactMillions = reais >= 1_000_000 && reais % 1_000_000 === 0;
    reaisText = `${integerToWords(reais)}${exactMillions ? " de reais" : " reais"}`;
  }

  const centavosText = centavos === 0 ? "" : centavos === 1 ? "um centavo" : `${integerToWords(centavos)} centavos`;

  if (reaisText && centavosText) return `${reaisText} e ${centavosText}`;
  return reaisText || centavosText;
}
