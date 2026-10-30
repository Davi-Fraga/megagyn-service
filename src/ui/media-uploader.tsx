"use client";

import { Camera, FileText, ImagePlus, RotateCcw, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { newId } from "@/domain/ids";
import { buttonClass } from "./button";
import { cn } from "./cn";
import { useFieldError, useFormBusy } from "./form";
import { MAX_IMAGE_SIDE, uploadErrorMessage } from "@/domain/upload";

type Purpose = "photo" | "receipt" | "logo" | "quote";
type Item = {
  key: string;
  clientUploadId: string;
  file: File;
  previewUrl: string | null;
  status: "enviando" | "concluido" | "falhou";
  id?: string;
  error?: string;
};


/**
 * Reduz fotos grandes antes do envio (rede móvel) mantendo legibilidade.
 * O canvas também descarta metadados EXIF, inclusive localização.
 */
async function prepare(file: File, purpose: Purpose): Promise<Blob> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const max = MAX_IMAGE_SIDE[purpose];
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 3 * 1024 * 1024) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function MediaUploader({
  name,
  label,
  purpose = "photo",
  siteId,
  hint,
  required,
  max = 20,
  errorName,
}: {
  name: string;
  label: string;
  purpose?: Purpose;
  siteId?: string;
  hint?: string;
  required?: boolean;
  max?: number;
  errorName?: string;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const setBusy = useFormBusy();
  const error = useFieldError(errorName ?? name);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const busyKey = useId();
  const accept = purpose === "receipt" ? "image/jpeg,image/png,image/webp,application/pdf" : "image/jpeg,image/png,image/webp";

  useEffect(() => {
    setBusy(busyKey, items.some((i) => i.status === "enviando"));
  }, [items, busyKey, setBusy]);

  useEffect(
    () => () => {
      setBusy(busyKey, false);
    },
    [busyKey, setBusy],
  );

  async function upload(item: Item) {
    setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, status: "enviando", error: undefined } : i)));
    try {
      const body = new FormData();
      const blob = await prepare(item.file, purpose);
      const fileName = blob === item.file ? item.file.name : item.file.name.replace(/\.[^.]+$/, "") + ".jpg";
      body.append("file", blob, fileName);
      body.append("purpose", purpose);
      body.append("clientUploadId", item.clientUploadId);
      if (siteId) body.append("siteId", siteId);
      const res = await fetch("/api/uploads", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !json.id) throw new Error(uploadErrorMessage(res.status, json.error));
      setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, status: "concluido", id: json.id } : i)));
    } catch (e) {
      const message =
        e instanceof TypeError ? "Sem conexão. Toque em tentar de novo." : e instanceof Error ? e.message : "Falha no envio.";
      setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, status: "falhou", error: message } : i)));
    }
  }

  function onFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const room = Math.max(0, max - items.length);
    const files = Array.from(list).slice(0, room);
    const next: Item[] = files.map((file) => ({
      key: newId(),
      clientUploadId: newId(),
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      status: "enviando",
    }));
    setItems((prev) => [...prev, ...next]);
    next.forEach((i) => void upload(i));
  }

  function remove(key: string) {
    setItems((prev) => {
      const item = prev.find((i) => i.key === key);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.key !== key);
    });
  }

  const sent = items.filter((i) => i.status === "concluido").length;

  return (
    <fieldset className="space-y-2">
      <legend className="text-[0.95rem] font-semibold">
        {label}
        {required ? <span className="text-erro"> *</span> : <span className="font-normal text-muted"> (opcional)</span>}
      </legend>
      {hint && <p className="text-sm text-muted">{hint}</p>}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => cameraRef.current?.click()} className={buttonClass("dark", "md", "w-full")}>
          <Camera aria-hidden className="size-5" />
          {purpose === "receipt" ? "Fotografar nota" : "Tirar foto"}
        </button>
        <button type="button" onClick={() => galleryRef.current?.click()} className={buttonClass("secondary", "md", "w-full")}>
          <ImagePlus aria-hidden className="size-5" />
          {purpose === "receipt" ? "Galeria ou PDF" : "Da galeria"}
        </button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={accept}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-live="polite">
          {items.map((item) => (
            <li key={item.key} className="overflow-hidden rounded-ctl border border-linha bg-papel">
              <div className="relative aspect-[4/3] bg-concreto-2">
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.previewUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-sm text-muted">
                    <FileText aria-hidden className="size-8" />
                    <span className="line-clamp-2 break-all">{item.file.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => remove(item.key)}
                  className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-bl-ctl bg-grafite/85 text-white"
                  aria-label="Remover este arquivo do envio"
                >
                  <X aria-hidden className="size-5" />
                </button>
              </div>
              <div
                className={cn(
                  "px-2 py-1.5 text-sm font-medium",
                  item.status === "concluido" && "text-ok",
                  item.status === "falhou" && "text-erro",
                  item.status === "enviando" && "text-muted",
                )}
              >
                {item.status === "enviando" && "Enviando…"}
                {item.status === "concluido" && "Recebido"}
                {item.status === "falhou" && (
                  <span className="flex flex-col gap-1">
                    <span>{item.error}</span>
                    <button type="button" onClick={() => void upload(item)} className="inline-flex items-center gap-1 font-semibold underline">
                      <RotateCcw aria-hidden className="size-4" />
                      Tentar de novo
                    </button>
                  </span>
                )}
              </div>
              {item.status === "concluido" && item.id && (
                <>
                  <input type="hidden" name={name} value={item.id} />
                  <label className="block border-t border-linha px-2">
                    <span className="sr-only">Legenda da foto</span>
                    <input
                      name={`caption:${item.id}`}
                      placeholder="Legenda (opcional)"
                      maxLength={200}
                      className="min-h-11 w-full bg-transparent text-sm outline-none"
                    />
                  </label>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && (
        <p className="text-sm text-muted">
          {sent} de {items.length} recebido(s).
        </p>
      )}
      {error && <p className="text-sm font-medium text-erro">{error}</p>}
    </fieldset>
  );
}
