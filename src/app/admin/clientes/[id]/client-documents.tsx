import { formatDateTimeBR } from "@/domain/dates";
import { attachClientDocumentsAction } from "@/server/actions/registry";
import { revokeAttachmentAction } from "@/server/actions/requests";
import { ActionForm, SelectField, TextField } from "@/ui/form";
import { MediaUploader } from "@/ui/media-uploader";
import { Panel } from "@/ui/page";
import { PhotoGrid, type GridPhoto } from "@/ui/photo-grid";

/** B-18: documentos e fotos cadastrais do cliente, no bucket privado de cadastros (só a administração). */
export function ClientDocuments({ clientId, files }: { clientId: string; files: GridPhoto[] }) {
  const visible = files.filter((f) => !f.revoked);
  const docs = visible.filter((f) => f.role === "documento").map((f) => ({ ...f, role: null }));
  const photos = visible.filter((f) => f.role === "foto_cadastral").map((f) => ({ ...f, role: null }));
  return (
    <Panel title="Documentos e fotos">
      <div className="space-y-5">
        <p className="text-sm text-muted">Só a administração vê e baixa estes arquivos. A equipe dos locais não tem acesso.</p>
        <div>
          <h3 className="mb-2 font-semibold">Documentos ({docs.length})</h3>
          <PhotoGrid photos={docs} emptyText="Nenhum documento anexado." revokeAction={revokeAttachmentAction} />
        </div>
        <div>
          <h3 className="mb-2 font-semibold">Fotos do cadastro ({photos.length})</h3>
          <PhotoGrid photos={photos} emptyText="Nenhuma foto do cadastro." revokeAction={revokeAttachmentAction} />
        </div>
        <ActionForm action={attachClientDocumentsAction} submitLabel="Anexar ao cliente" submitVariant="secondary" resetOnSuccess pendingLabel="Anexando…">
          <input type="hidden" name="client_id" value={clientId} />
          <SelectField
            label="Tipo"
            name="role"
            required
            options={[
              { value: "documento", label: "Documento" },
              { value: "foto_cadastral", label: "Foto do cadastro" },
            ]}
          />
          <TextField label="Categoria" name="category" maxLength={80} hint="Ex.: Contrato, Alvará, Fachada." />
          <MediaUploader name="attachment_ids" label="Arquivos" purpose="registry" required />
        </ActionForm>
      </div>
    </Panel>
  );
}

export type ClientHistoryRow = {
  id: number;
  action: string;
  actor_id: string | null;
  reason: string | null;
  created_at: string;
  before: unknown;
  after: unknown;
};

/** O que mudou numa linha da trilha do cliente, em palavras. */
function describe(row: ClientHistoryRow): string {
  if (row.action === "insert") return "Cadastrou o cliente";
  if (row.action === "delete") return "Excluiu o cliente";
  const before = (row.before ?? {}) as { is_active?: boolean };
  const after = (row.after ?? {}) as { is_active?: boolean };
  if (before.is_active === true && after.is_active === false) return "Desativou o cliente";
  if (before.is_active === false && after.is_active === true) return "Reativou o cliente";
  return "Alterou os dados";
}

/** B-18: a trilha do cadastro do cliente (auditoria), com o motivo de cada desativação. */
export function ClientHistory({ rows, name }: { rows: ClientHistoryRow[]; name: (id: string | null) => string }) {
  return (
    <Panel title="Histórico do cadastro">
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nada registrado ainda.</p>
      ) : (
        <ul className="divide-y divide-linha rounded-panel border border-linha">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 text-sm">
              <p>
                <span className="font-semibold">{describe(r)}</span> · {r.actor_id ? name(r.actor_id) : "Sistema"}
              </p>
              <p className="text-muted">{formatDateTimeBR(r.created_at)}</p>
              {r.reason && <p className="mt-1">Motivo: {r.reason}</p>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
