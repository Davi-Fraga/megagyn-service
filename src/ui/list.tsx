import type { ReactNode } from "react";
import { cn } from "./cn";

const VARIANT = {
  /** Lista com moldura das telas da administração. */
  boxed: "divide-y divide-linha overflow-hidden rounded-panel border border-linha bg-papel",
  /** Lista de ponta a ponta no celular do campo (anula o respiro lateral da página). */
  bleed: "-mx-4 divide-y divide-linha border-y border-linha",
} as const;

export type ListProps ={ variant: keyof typeof VARIANT; className?: string; children: ReactNode };

/** Lista de registros separados por linha. Os itens são `<li>` montados pela tela. */
export function List({ variant, className, children }: ListProps) {
  return <ul className={cn(VARIANT[variant], className)}>{children}</ul>;
}
