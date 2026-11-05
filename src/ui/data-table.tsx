import type { ReactNode } from "react";
import { cn } from "./cn";

export type DataTableColumn<T> = {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Alinha à direita o cabeçalho e a célula (valores e contagens). */
  align?: "right";
  /** Classes extras da célula; uma função calcula por linha (ex.: texto apagado quando falta o dado). */
  className?: string | ((row: T) => string | false | null | undefined);
  /** Classes extras do cabeçalho. */
  headerClassName?: string;
  /** Troca o padding vertical padrão da célula (régua: py-4; caixa: py-2.5). */
  padY?: string;
};

type Variant = "ruler" | "boxed";

type Props<T> = {
  /** "ruler": régua de obra, sem moldura. "boxed": tabela com moldura. */
  variant: Variant;
  /** Classe literal de largura mínima (ex.: "min-w-[40rem]"), para o Tailwind gerar a regra. */
  minWidth: string;
  rows: T[];
  rowKey: (row: T) => string;
  /** Aceita `false`/`null` para coluna condicional. */
  columns: Array<DataTableColumn<T> | false | null | undefined>;
};

// O cn só junta strings: cada célula recebe exatamente o conjunto de classes que as telas usavam,
// sem duas classes disputando a mesma propriedade.
const STYLE = {
  ruler: {
    wrapper: "overflow-x-auto",
    table: "text-left",
    thead: undefined,
    headRow: "tipo-condensada text-[0.8125rem] text-muted",
    th: "border-b border-grafite pb-2 font-semibold",
    tbody: undefined,
    row: "align-top hover:bg-concreto/45 [&>td]:border-b [&>td]:border-linha",
    padY: "py-4",
  },
  boxed: {
    wrapper: "overflow-x-auto rounded-panel border border-linha bg-papel",
    table: "text-left text-[0.95rem]",
    thead: "border-b border-linha bg-concreto text-sm text-muted",
    headRow: undefined,
    th: "px-3 py-2 font-semibold",
    tbody: "divide-y divide-linha",
    row: "align-top hover:bg-concreto/60",
    padY: "py-2.5",
  },
} as const;

/** Padding horizontal: na régua depende da posição da coluna; na caixa é sempre px-3. */
function padX(variant: Variant, index: number, count: number): string {
  if (variant === "boxed") return "px-3";
  if (index === 0) return "pl-4 pr-5";
  return index === count - 1 ? "pr-1" : "pr-5";
}

export function DataTable<T>({ variant, minWidth, rows, rowKey, columns }: Props<T>) {
  const s = STYLE[variant];
  const cols = columns.filter((c): c is DataTableColumn<T> => Boolean(c));
  const right = (c: DataTableColumn<T>) => c.align === "right" && "text-right";
  return (
    <div className={s.wrapper}>
      <table className={cn("w-full", minWidth, s.table)}>
        <thead className={s.thead}>
          <tr className={s.headRow}>
            {cols.map((c, i) => (
              <th key={i} scope="col" className={cn(s.th, variant === "ruler" && padX(variant, i, cols.length), right(c), c.headerClassName)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={s.tbody}>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={s.row}>
              {cols.map((c, i) => (
                <td
                  key={i}
                  className={cn(c.padY ?? s.padY, padX(variant, i, cols.length), right(c), typeof c.className === "function" ? c.className(row) : c.className)}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
