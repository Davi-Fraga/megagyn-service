"use client";

import { Download, Eye, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { requestReport, retryReport, type ReportRequest } from "@/server/actions/reports";
import { buttonClass, type ButtonVariant } from "./button";
import { useHydrated } from "./use-hydrated";

type Status = { status: "na_fila" | "processando" | "pronto" | "falhou"; file_name: string; error_message: string | null; page_count: number | null };

const LABEL: Record<Status["status"], string> = {
  na_fila: "Na fila…",
  processando: "Gerando PDF…",
  pronto: "PDF pronto",
  falhou: "Falhou",
};

/**
 * Pede o PDF ao servidor e acompanha o processamento (relatórios longos não travam a tela).
 * Quando pronto, oferece abrir e baixar com o nome sugerido.
 */
export function GenerateReportButton({
  kind,
  sourceId,
  params,
  label,
  icon,
  variant = "secondary",
  existingId,
}: ReportRequest & { label: string; icon?: ReactNode; variant?: ButtonVariant; existingId?: string | null }) {
  const [artifactId, setArtifactId] = useState<string | null>(existingId ?? null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [nonce, setNonce] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useHydrated();

  useEffect(() => {
    if (!artifactId) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/reports/${artifactId}`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as Status;
        if (cancelled) return;
        setStatus(json);
        if (json.status === "na_fila" || json.status === "processando") timer.current = setTimeout(poll, 2000);
      } catch {
        if (!cancelled) timer.current = setTimeout(poll, 4000);
      }
    }
    void poll();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [artifactId, nonce]);

  async function start() {
    setError(null);
    setRequesting(true);
    setStatus(null);
    const result = await requestReport({ kind, sourceId, params }).catch(() => ({ ok: false as const, message: "Sem conexão. Tente de novo." }));
    setRequesting(false);
    if (result.ok) {
      setArtifactId(result.artifactId);
      setNonce((n) => n + 1);
    }
    else setError(result.message);
  }

  async function retry() {
    if (!artifactId) return;
    setStatus(null);
    const result = await retryReport(artifactId);
    if (!result.ok) setError(result.message);
    else setNonce((n) => n + 1);
  }

  const working = requesting || status?.status === "na_fila" || status?.status === "processando" || (artifactId !== null && status === null);

  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      {status?.status !== "pronto" && (
        <button type="button" onClick={start} disabled={!hydrated || working} className={buttonClass(variant)}>
          {working ? <Loader2 aria-hidden className="size-4 animate-spin" /> : icon}
          {working ? (status ? LABEL[status.status] : "Pedindo…") : label}
        </button>
      )}
      {status?.status === "pronto" && artifactId && (
        <>
          <a href={`/api/reports/${artifactId}/download?ver=1`} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
            <Eye aria-hidden className="size-4" /> Visualizar
          </a>
          <a href={`/api/reports/${artifactId}/download`} className={buttonClass("primary")}>
            <Download aria-hidden className="size-4" /> Baixar {status.file_name}
          </a>
          <button type="button" onClick={start} disabled={!hydrated} className="text-sm font-semibold text-info underline">
            Gerar de novo
          </button>
        </>
      )}
      {status?.status === "falhou" && (
        <span className="flex items-center gap-2 text-sm font-medium text-erro">
          {status.error_message}
          <button type="button" onClick={retry} disabled={!hydrated} className="inline-flex items-center gap-1 underline">
            <RotateCcw aria-hidden className="size-4" /> Tentar de novo
          </button>
        </span>
      )}
      {error && <span className="text-sm font-medium text-erro">{error}</span>}
    </div>
  );
}
