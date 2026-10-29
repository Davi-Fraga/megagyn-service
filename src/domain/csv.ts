/**
 * CSV compatível com Excel pt-BR: BOM UTF-8, ";" como separador, CRLF,
 * valores monetários "1.000,00". A mesma consulta da tela gera o CSV,
 * por isso os totais conciliam com os indicadores.
 */
import { formatCentsPlain } from "./money";

export type CsvColumn<T> = { header: string; value: (row: T) => string | number | null | undefined };

const NEEDS_QUOTES = /[";\r\n]/;
const FORMULA_START = /^[=+\-@\t\r]/;
/** "-2,50", "-1.000,00" e "-3" são números, não fórmulas. */
const PLAIN_NUMBER = /^-?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/;

function cell(raw: string): string {
  let v = raw;
  if (FORMULA_START.test(v) && !PLAIN_NUMBER.test(v)) v = `'${v}`;
  return NEEDS_QUOTES.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[], options: { money?: string[] } = {}): string {
  const money = new Set(options.money ?? []);
  const lines = [columns.map((c) => cell(c.header)).join(";")];
  for (const row of rows) {
    lines.push(
      columns
        .map((c) => {
          const v = c.value(row);
          if (v === null || v === undefined) return "";
          if (typeof v === "number") return money.has(c.header) ? formatCentsPlain(v) : String(v).replace(".", ",");
          return cell(v);
        })
        .join(";"),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
