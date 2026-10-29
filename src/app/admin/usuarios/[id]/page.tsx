import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateBR, formatDateTimeBR, todayIso } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { MIN_PASSWORD_LENGTH } from "@/domain/registry";
import { ROLE_LABEL, requireProfile } from "@/server/auth";
import {
  sendPasswordLinkAction,
  setTemporaryPasswordAction,
  setUserActiveAction,
  updateUserAction,
} from "@/server/actions/registry";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { createSupabaseServer } from "@/server/supabase/server";
import { ActionForm, SelectField, TextField } from "@/ui/form";
import { DescriptionList, Notice, PageHeader, Panel } from "@/ui/page";
import { Badge } from "@/ui/status";
import { ActiveBadge } from "../../clientes/_shared/fields";
import { RowAction } from "../../clientes/_shared/row-action";
import { ROLE_OPTIONS } from "../_shared/role-options";
import { rowOrNotFound } from "@/server/query";

export const metadata: Metadata = { title: "Usuário" };

const DONE: Record<string, string> = {
  criado: "Usuário cadastrado. Se for da equipe de campo, dê acesso aos locais em que vai trabalhar.",
  ativado: "Acesso reativado. A pessoa já pode entrar de novo.",
  desativado: "Acesso desativado. A pessoa não entra mais no sistema; tudo o que ela registrou continua no histórico.",
};

export default async function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feito?: string }>;
}) {
  const { id } = await params;
  const { feito } = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const me = await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  const user = rowOrNotFound(await db.from("profiles").select("*").eq("id", id).maybeSingle());
  // Último login vem do serviço de autenticação (página só da administração, consulta no servidor).
  const { data: authUser } = await createSupabaseAdmin().auth.admin.getUserById(id);
  const neverSignedIn = !!authUser.user && !authUser.user.last_sign_in_at;
  const { data: memberships } = await db
    .from("site_memberships")
    .select("id, active_from, active_to, site:sites(id, name, code, client:clients(display_name))")
    .eq("profile_id", id)
    .order("active_from", { ascending: false });

  const self = me.id === user.id;
  const today = todayIso();
  const isField = user.role === "worker" || user.role === "foreman";
  const list = memberships ?? [];

  return (
    <>
      <PageHeader
        back={{ href: "/admin/usuarios", label: "Usuários" }}
        eyebrow={ROLE_LABEL[user.role]}
        title={user.full_name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ActiveBadge active={user.is_active} inactiveLabel="Acesso desativado" />
            <span className="break-all">{user.email}</span>
            {self && <Badge tone="info">Você</Badge>}
            {neverSignedIn && user.is_active && <Badge tone="alerta">Primeiro acesso ainda não feito</Badge>}
          </span>
        }
      />

      {feito === "convidado" && (
        <div className="mb-4">
          <Notice tone="ok">
            Convite enviado para {user.email}. O link vale por 1 hora; se expirar, use “Enviar link para criar nova senha”. Se for da equipe
            de campo, dê acesso aos locais em que vai trabalhar.
          </Notice>
        </div>
      )}
      {feito && DONE[feito] && (
        <div className="mb-4">
          <Notice tone="ok">{DONE[feito]}</Notice>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Panel title="Locais com acesso">
            {user.role === "admin" && <p className="mb-3 text-sm text-muted">A administração vê todos os locais, com ou sem vínculo.</p>}
            {isField && (
              <p className="mb-3 text-sm text-muted">
                Funcionários e encarregados só veem os locais listados aqui. Para incluir ou encerrar um acesso, abra o local em “Equipe
                com acesso”.
              </p>
            )}
            {list.length === 0 ? (
              <p className="text-muted">Nenhum vínculo com locais.</p>
            ) : (
              <ul className="divide-y divide-linha rounded-panel border border-linha">
                {list.map((m) => {
                  const ended = !!m.active_to && m.active_to < today;
                  return (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <div className="min-w-0">
                        <Link href={`/admin/locais/${m.site?.id}`} className="font-semibold hover:underline">
                          {m.site?.name}
                        </Link>{" "}
                        <span className="tipo-placa text-sm text-laranja-escuro">{m.site?.code}</span>
                        <p className="text-sm text-muted">
                          {m.site?.client?.display_name} · {formatDateBR(m.active_from)}
                          {m.active_to ? ` a ${formatDateBR(m.active_to)}` : " até hoje"}
                        </p>
                      </div>
                      {ended ? <Badge tone="neutral">Encerrado</Badge> : m.active_to ? <Badge tone="alerta">Até {formatDateBR(m.active_to)}</Badge> : <Badge tone="ok">Ativo</Badge>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Senha">
            {user.is_active ? (
              <div className="space-y-5">
                <ActionForm action={sendPasswordLinkAction} submitLabel="Enviar link para criar nova senha" submitVariant="secondary" pendingLabel="Enviando…">
                  <input type="hidden" name="profile_id" value={user.id} />
                  <p className="text-sm text-muted">A pessoa recebe no e-mail {user.email} um link para criar a própria senha.</p>
                </ActionForm>
                <div className="border-t border-linha pt-5">
                  <h3 className="mb-3 font-semibold">Definir nova senha provisória</h3>
                  <ActionForm action={setTemporaryPasswordAction} submitLabel="Definir senha provisória" submitVariant="dark" resetOnSuccess>
                    <input type="hidden" name="profile_id" value={user.id} />
                    <TextField
                      label="Senha provisória"
                      name="password"
                      type="password"
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                      autoComplete="new-password"
                      hint={`Ao menos ${MIN_PASSWORD_LENGTH} caracteres. Use quando a pessoa não consegue abrir o e-mail.`}
                    />
                    <TextField label="Repita a senha" name="confirm" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" />
                  </ActionForm>
                </div>
              </div>
            ) : (
              <p className="text-muted">Reative o acesso para enviar link ou definir senha.</p>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel title="Dados do usuário">
            <ActionForm action={updateUserAction} submitLabel="Salvar dados">
              <input type="hidden" name="profile_id" value={user.id} />
              <TextField label="Nome completo" name="full_name" required maxLength={160} defaultValue={user.full_name} />
              <TextField label="Telefone" name="phone" type="tel" inputMode="tel" maxLength={40} defaultValue={user.phone ?? ""} />
              {self ? (
                <>
                  <input type="hidden" name="role" value={user.role} />
                  <p className="text-sm text-muted">Papel: {ROLE_LABEL[user.role]}. Você não pode alterar o próprio papel.</p>
                </>
              ) : (
                <SelectField label="Papel" name="role" required placeholder="" options={ROLE_OPTIONS} defaultValue={user.role} />
              )}
              <p className="text-sm text-muted">O e-mail de acesso ({user.email}) não muda por aqui.</p>
            </ActionForm>
          </Panel>

          <Panel title="Acesso ao sistema">
            <div className="mb-4">
              <DescriptionList
                items={[
                  { label: "Cadastrado em", value: formatDateTimeBR(user.created_at) },
                  { label: "Desativado em", value: formatDateTimeBR(user.deactivated_at), hidden: !user.deactivated_at },
                ]}
              />
            </div>
            {self ? (
              <p className="text-sm text-muted">Este é o seu usuário. Só outro administrador pode desativar o seu acesso.</p>
            ) : user.is_active ? (
              <RowAction
                action={setUserActiveAction}
                hidden={{ profile_id: user.id, active: "0" }}
                label="Desativar acesso"
                variant="danger"
                confirm={{
                  intro: `${user.full_name} deixa de entrar no sistema na hora. Chamados, fotos, despesas e registros feitos por esta pessoa continuam no histórico com o nome dela.`,
                  label: "Confirmar desativação",
                  variant: "danger",
                }}
              />
            ) : (
              <RowAction action={setUserActiveAction} hidden={{ profile_id: user.id, active: "1" }} label="Reativar acesso" variant="primary" />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
