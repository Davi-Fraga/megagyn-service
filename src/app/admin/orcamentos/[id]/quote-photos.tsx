import { linkQuotePhotosAction, unlinkQuotePhotoAction } from "@/server/actions/quotes";
import { ActionForm } from "@/ui/form";
import { MediaUploader } from "@/ui/media-uploader";
import { Panel } from "@/ui/page";
import { PhotoGrid, type GridPhoto } from "@/ui/photo-grid";

/** Seção de fotos do orçamento ("local" ou "referencia"). Alterável só em rascunho. */
export function QuotePhotos({
  quoteId,
  role,
  title,
  hint,
  photos,
  editable,
}: {
  quoteId: string;
  role: "local" | "referencia";
  title: string;
  hint: string;
  photos: GridPhoto[];
  editable: boolean;
}) {
  const visible = photos.filter((p) => !p.revoked);
  return (
    <Panel title={title} id={`fotos-${role}`}>
      <div className="space-y-4">
        <p className="text-sm text-muted">{hint}</p>
        <PhotoGrid photos={visible.map((p) => ({ ...p, role: null }))} emptyText="Nenhuma foto nesta seção." />

        {editable && visible.length > 0 && (
          <details className="rounded-ctl border border-linha">
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Retirar fotos desta seção</summary>
            <ul className="divide-y divide-linha border-t border-linha">
              {visible.map((p, index) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/files/${p.id}?v=thumb`} alt="" className="size-12 rounded-ctl object-cover" />
                  <span className="min-w-0 flex-1 truncate text-sm">{p.caption || `Foto ${index + 1}`}</span>
                  <ActionForm action={unlinkQuotePhotoAction} submitLabel="Retirar" submitVariant="ghost" submitSize="sm" pendingLabel="Retirando…" className="space-y-1">
                    <input type="hidden" name="quote_id" value={quoteId} />
                    <input type="hidden" name="attachment_id" value={p.id} />
                  </ActionForm>
                </li>
              ))}
            </ul>
          </details>
        )}

        {editable && (
          <ActionForm action={linkQuotePhotosAction} submitLabel="Adicionar fotos" submitVariant="secondary" resetOnSuccess pendingLabel="Adicionando…">
            <input type="hidden" name="quote_id" value={quoteId} />
            <input type="hidden" name="role" value={role} />
            <MediaUploader name="photo_ids" label={`Enviar ${title.toLowerCase()}`} purpose="quote" />
          </ActionForm>
        )}
      </div>
    </Panel>
  );
}
