"use client";

import { ChevronLeft, ChevronRight, FileText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";
import type { ActionFn } from "./form";
import { ReasonAction } from "./reason-action";

export type GridPhoto = {
  id: string;
  caption?: string | null;
  role?: string | null;
  mime?: string | null;
  meta?: string | null;
  revoked?: boolean;
  bucket?: string;
  visibility?: string;
};

const ROLE_LABEL: Record<string, string> = {
  inicial: "Situação inicial",
  intermediaria: "Durante o serviço",
  resultado: "Resultado",
  comprovante: "Comprovante",
  local: "Foto do local",
  referencia: "Serviço semelhante",
};

/** `meta` chega como "Autor · 24/10/2026 14:02" (loadPhotos): separa autor e data/hora para a legenda. */
function splitMeta(meta: string | null | undefined): { author: string | null; when: string | null } {
  if (!meta) return { author: null, when: null };
  const parts = meta.split(" · ");
  const when = parts.find((p) => /^\d{2}\/\d{2}\/\d{4}/.test(p)) ?? null;
  return { author: parts.filter((p) => p !== when).join(" ") || null, when };
}

/**
 * Grade de fotos com ampliação. Os arquivos vêm de /api/files (acesso conferido no servidor).
 * Com `revokeAction`, cada foto ganha "Remover foto" com motivo (só páginas da administração).
 */
export function PhotoGrid({
  photos,
  emptyText = "Nenhuma foto.",
  revokeAction,
}: {
  photos: GridPhoto[];
  emptyText?: string;
  revokeAction?: ActionFn;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open !== null && !d.open) d.showModal();
    if (open === null && d.open) d.close();
  }, [open]);

  if (photos.length === 0) return <p className="text-sm text-muted">{emptyText}</p>;
  const current = open !== null ? photos[open] : null;

  return (
    <>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-7">
        {photos.map((p, index) => {
          const { author, when } = splitMeta(p.meta);
          return (
            <li key={p.id} className="min-w-0">
              <button
                type="button"
                onClick={() => setOpen(index)}
                className="block w-full text-left"
                aria-label={`Ampliar ${p.caption ?? ROLE_LABEL[p.role ?? ""] ?? "foto"}`}
              >
                <div className={cn("aspect-[4/3] overflow-hidden rounded-[2px] bg-concreto-2", p.revoked && "opacity-40")}>
                  {p.mime === "application/pdf" ? (
                    <div className="flex size-full items-center justify-center text-muted">
                      <FileText aria-hidden className="size-10" />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/files/${p.id}?v=thumb`} alt="" loading="lazy" className="size-full object-cover" />
                  )}
                </div>
                <div className="mt-2 space-y-0.5 text-[0.8125rem] leading-snug">
                  {(when || author) && (
                    <span className="tipo-condensada flex flex-wrap justify-between gap-x-3">
                      {when && <span>{when}</span>}
                      {author && <span className="font-medium text-muted">{author}</span>}
                    </span>
                  )}
                  {p.role && <span className="tipo-condensada block">{ROLE_LABEL[p.role] ?? p.role}</span>}
                  {p.caption && <span className="block text-muted">{p.caption}</span>}
                  {p.revoked && <span className="tipo-condensada block text-erro">Removida</span>}
                </div>
              </button>
              {revokeAction && !p.revoked && (
                <div className="mt-2">
                  <ReasonAction
                    action={revokeAction}
                    hidden={{ attachment_id: p.id }}
                    label="Remover foto"
                    confirmLabel="Confirmar remoção"
                    reasonLabel="Por que remover?"
                    variant="danger"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(null)}
        className="m-auto max-h-[95vh] w-[min(100vw-1rem,72rem)] bg-grafite p-0 text-white backdrop:bg-black/80"
      >
        {current && (
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-2 px-3 py-1">
              <p className="tipo-condensada flex min-w-0 flex-wrap gap-x-3 text-[0.9375rem]">
                {[ROLE_LABEL[current.role ?? ""], current.caption, splitMeta(current.meta).when, splitMeta(current.meta).author]
                  .filter(Boolean)
                  .map((part, i) => (
                    <span key={i} className={cn("truncate", i > 0 && "font-medium text-white/80")}>
                      {part}
                    </span>
                  ))}
              </p>
              <button type="button" onClick={() => setOpen(null)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-ctl hover:bg-white/10" aria-label="Fechar">
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <div className="flex min-h-0 items-center justify-center bg-black">
              {current.mime === "application/pdf" ? (
                <iframe title="Documento" src={`/api/files/${current.id}?v=original`} className="h-[80vh] w-full bg-white" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${current.id}?v=medium`} alt={current.caption ?? ""} className="max-h-[80vh] w-auto object-contain" />
              )}
            </div>
            <div className="flex items-center justify-between px-2 py-2">
              <button
                type="button"
                disabled={open === 0}
                onClick={() => setOpen((i) => (i === null ? i : Math.max(0, i - 1)))}
                className="inline-flex min-h-11 items-center gap-1 rounded-ctl px-3 disabled:opacity-40"
              >
                <ChevronLeft aria-hidden className="size-5" /> Anterior
              </button>
              <a href={`/api/files/${current.id}?v=original`} target="_blank" rel="noreferrer" className="text-sm underline">
                Abrir em nova aba
              </a>
              <button
                type="button"
                disabled={open === photos.length - 1}
                onClick={() => setOpen((i) => (i === null ? i : Math.min(photos.length - 1, i + 1)))}
                className="inline-flex min-h-11 items-center gap-1 rounded-ctl px-3 disabled:opacity-40"
              >
                Próxima <ChevronRight aria-hidden className="size-5" />
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
