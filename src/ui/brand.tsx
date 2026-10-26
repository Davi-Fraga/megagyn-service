/** Marca do sistema (texto). O logotipo oficial é enviado em Configurações e usado nos PDFs. */
export function Brand({ inverted = false, compact = false }: { inverted?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg aria-hidden viewBox="0 0 64 64" className={compact ? "size-7" : "size-9"}>
        <rect width="64" height="64" rx="12" fill={inverted ? "#ffffff" : "#1e2326"} />
        <path d="M10 30 32 12l22 18" fill="none" stroke="#f28c28" strokeWidth="6" strokeLinejoin="round" />
        <path
          d="M18 50V32l7 10 7-10 7 10 7-10v18"
          fill="none"
          stroke={inverted ? "#1e2326" : "#ffffff"}
          strokeWidth="5"
          strokeLinejoin="round"
        />
      </svg>
      <span className={inverted ? "text-white" : "text-grafite"}>
        <span className="tipo-placa block text-[1.05rem] leading-none">Megagyn</span>
        {!compact && <span className="block text-xs leading-tight opacity-80">Service</span>}
      </span>
    </span>
  );
}
