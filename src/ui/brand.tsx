import Image from "next/image";
import lockup from "@/assets/brand/lockup.png";
import mark from "@/assets/brand/mark.png";
import { cn } from "./cn";

/**
 * Marca oficial (arquivo CorelDRAW "Logo Megagyn Service", recebido em 29/10/2026).
 * Cabeçalhos usam a marca com telhado mais o nome em texto; o login usa o lockup completo.
 * O logotipo dos PDFs continua vindo de Configurações (o seed de demonstração já o carrega).
 */
export function Brand({ inverted = false, compact = false }: { inverted?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Image src={mark} alt="" priority sizes="40px" className={cn("rounded-[2px]", compact ? "size-8" : "size-9")} />
      <span className={inverted ? "text-white" : "text-grafite"}>
        <span className="block text-[1.0625rem] font-extrabold leading-none tracking-[-0.01em] [font-stretch:118%]">Megagyn</span>
        {!compact && <span className={cn("mt-0.5 block text-[0.8125rem] font-medium leading-tight", inverted ? "opacity-80" : "text-muted")}>Service</span>}
      </span>
    </span>
  );
}

/** Lockup completo (telhado, MEGAGYN e SERVICE) sobre o azul da marca. */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <Image
      src={lockup}
      alt="Megagyn Service"
      priority
      sizes="(max-width: 480px) 70vw, 288px"
      className={cn("h-auto w-full max-w-72 rounded-panel", className)}
    />
  );
}
