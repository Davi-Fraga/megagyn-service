import { formatDateBR, todayIso } from "@/domain/dates";
import { grantPermissionAction, revokePermissionAction } from "@/server/actions/registry";
import type { Database } from "@/server/db/database.types";
import { DataTable } from "@/ui/data-table";
import { ActionForm, SelectField, TextAreaField, TextField } from "@/ui/form";
import { Panel } from "@/ui/page";
import { Badge } from "@/ui/status";
import { RowAction } from "../../clientes/_shared/row-action";

type Role = Database["public"]["Enums"]["user_role"];
export type CatalogRow = { module: string; action: string; label: string; admin_floor: boolean; client_never: boolean };
export type RoleRow = { module: string; action: string; allowed: boolean };
export type OverrideRow = {
  id: string;
  module: string;
  action: string;
  allowed: boolean;
  reason: string;
  expires_at: string | null;
  site: { name: string } | null;
};

const keyOf = (r: { module: string; action: string }) => `${r.module}.${r.action}`;

/** Último dia em que a exceção vale: ela vence à meia-noite seguinte (horário de São Paulo). */
const lastDay = (expiresAt: string) => todayIso(new Date(Date.parse(expiresAt) - 1000));

/**
 * B-25: a matriz da pessoa. O papel define o padrão (B-24); a exceção vale só para esta pessoa, com
 * motivo, e fica na trilha. Os pisos são do banco; a tela só não oferece o que ele recusaria.
 */
export function PermissionsPanel({
  profileId,
  role,
  self,
  catalog,
  roleRows,
  overrides,
  sites,
}: {
  profileId: string;
  role: Role;
  self: boolean;
  catalog: CatalogRow[];
  roleRows: RoleRow[];
  overrides: OverrideRow[];
  sites: Array<{ id: string; name: string }>;
}) {
  if (role === "admin") {
    return (
      <Panel title="Permissões">
        <p className="text-sm text-muted">A administração pode tudo. Exceções individuais não se aplicam a ela.</p>
      </Panel>
    );
  }
  const byRole = new Map(roleRows.map((r) => [keyOf(r), r.allowed]));
  const today = todayIso();
  const visible = catalog.filter((c) => !(role === "client" && c.client_never));

  return (
    <Panel title="Permissões">
      <p className="mb-3 text-sm text-muted">
        O papel define o padrão. Uma exceção vale só para esta pessoa e fica na trilha; com local, vale só onde ela tem acesso.
      </p>
      <DataTable
        variant="ruler"
        minWidth="min-w-[36rem]"
        rows={visible}
        rowKey={keyOf}
        columns={[
          { header: "Permissão", className: "text-sm", cell: (c) => c.label },
          {
            header: "Pelo papel",
            cell: (c) =>
              c.admin_floor ? (
                <Badge tone="neutral">Só administração</Badge>
              ) : byRole.get(keyOf(c)) ? (
                <Badge tone="ok">Sim</Badge>
              ) : (
                <Badge tone="neutral">Não</Badge>
              ),
          },
          {
            header: "Exceção",
            cell: (c) => (
              <div className="space-y-2">
                {overrides
                  .filter((o) => keyOf(o) === keyOf(c))
                  .map((o) => {
                    const until = o.expires_at ? lastDay(o.expires_at) : null;
                    const expired = !!until && until < today;
                    return (
                      <div key={o.id} className="space-y-1">
                        <p className="flex flex-wrap items-center gap-1 text-sm">
                          <Badge tone={expired ? "neutral" : o.allowed ? "ok" : "alerta"}>{o.allowed ? "Liberada" : "Bloqueada"}</Badge>
                          {o.site?.name && <span>em {o.site.name}</span>}
                          {until && <span className="text-muted">{expired ? `venceu em ${formatDateBR(until)}` : `até ${formatDateBR(until)}`}</span>}
                        </p>
                        <p className="text-sm text-muted">{o.reason}</p>
                        {!self && <RowAction action={revokePermissionAction} hidden={{ override_id: o.id }} label="Remover exceção" />}
                      </div>
                    );
                  })}
              </div>
            ),
          },
        ]}
      />
      {self ? (
        <p className="mt-4 text-sm text-muted">Você não pode alterar a própria permissão. Peça a outro administrador.</p>
      ) : (
        <div className="mt-5 border-t border-linha pt-5">
          <h3 className="mb-3 font-semibold">Nova exceção</h3>
          <ActionForm action={grantPermissionAction} submitLabel="Registrar exceção" resetOnSuccess>
            <input type="hidden" name="profile_id" value={profileId} />
            <SelectField label="Permissão" name="permission" required options={visible.map((c) => ({ value: keyOf(c), label: c.label }))} />
            <SelectField
              label="Liberar ou bloquear"
              name="allowed"
              required
              options={[
                { value: "1", label: "Liberar" },
                { value: "0", label: "Bloquear" },
              ]}
            />
            <SelectField
              label="Local"
              name="site_id"
              placeholder="Todos os locais a que a pessoa tem acesso"
              options={sites.map((s) => ({ value: s.id, label: s.name }))}
            />
            <TextField label="Vale até" name="expires_on" type="date" min={today} hint="Em branco, vale até ser removida." />
            <TextAreaField label="Motivo da exceção" name="reason" required rows={2} maxLength={500} />
          </ActionForm>
        </div>
      )}
    </Panel>
  );
}
