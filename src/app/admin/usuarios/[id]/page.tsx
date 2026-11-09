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
import { loadProfiles } from "@/server/data";
import { ActionForm, SelectField, TextAreaField, TextField } from "@/ui/form";
import { DescriptionList, Notice, PageHeader, Panel } from "@/ui/page";
import { Badge } from "@/ui/status";
import { ActiveBadge } from "../../clientes/_shared/fields";
import { RowAction } from "../../clientes/_shared/row-action";
import { ROLE_OPTIONS } from "../_shared/role-options";
import { rowOrNotFound } from "@/server/query";

export const metadata: Metadata = { title: "Usuário" };

const DONE: Record<string, string> = {
  criado: "Usuário cadastrado. Se for da equipe de campo, dê acesso aos locais em que vai trabalhar.",
  ativado: "Acesso reativado. A pessoa já pode entrar de novo. O desligamento encerra os acessos aos locais: confira a lista abaixo.",
  desativado: "Acesso desativado. A pessoa não entra mais no sistema; tudo o que ela registrou continua no histórico.",
};

/** B-20: o que a pessoa tem aberto, lido por profile_open_items (só a administração). */
type OpenItems = {
  requests: Array<{ id: string; number: string; title: string; site_name: string }>;
  tasks: Array<{ id: string; title: string; scheduled_date: string }>;
  memberships: Array<{ id: string; site_name: string }>;
};

function OpenItemsList({ items }: { items: OpenItems }) {
  if (items.requests.length + items.tasks.length + items.memberships.length === 0) {
    return <p className="text-sm text-muted">Nenhum chamado, tarefa ou acesso a local em aberto.</p>;
  }
  return (
    <section aria-labelledby="pendencias" className="space-y-3 rounded-panel border border-linha p-4">
      <h3 id="pendencias" className="font-semibold">
        Pendências desta pessoa
      </h3>
      {items.requests.length > 0 && (
        <div>
          <p className="text-sm font-semibold">Chamados não encerrados ({items.requests.length})</p>
          <ul className="mt-1 space-y-1 text-sm">
            {items.requests.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/chamados/${r.id}`} className="hover:underline">
                  {r.number} · {r.title}
                </Link>{" "}
                <span className="text-muted">({r.site_name})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {items.tasks.length > 0 && (
        <div>
          <p className="text-sm font-semibold">Tarefas abertas ({items.tasks.length})</p>
          <ul className="mt-1 space-y-1 text-sm">
            {items.tasks.map((t) => (
              <li key={t.id}>
                {t.title} <span className="text-muted">({formatDateBR(t.scheduled_date)})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {items.memberships.length > 0 && (
        <div>
          <p className="text-sm font-semibold">Acessos a locais que serão encerrados ({items.memberships.length})</p>
          <p className="mt-1 text-sm">{items.memberships.map((m) => m.site_name).join(", ")}</p>
        </div>
      )}
    </section>
  );
}

export default async function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feito?: string; pendentes?: string }>;
}) {
  const { id } = await params;
  const { feito, pendentes } = await searchParams;
  const leftOpen = Number(pendentes ?? 0);
  if (!UUID_RE.test(id)) notFound();
  const me = await requireProfile(["admin"]);
  const db = await createSupabaseServer();
  // E-mail e telefone só pela view profile_contacts (B-16): a tabela não os entrega pela API.
  const [profile, { data: contact }] = await Promise.all([
    db.from("profiles").select("id, full_name, role, is_active, deactivated_at, created_at, updated_at").eq("id", id).maybeSingle(),
    db.from("profile_contacts").select("email, phone").eq("id", id).maybeSingle(),
  ]);
  const user = { ...rowOrNotFound(profile), email: contact?.email ?? "", phone: contact?.phone ?? null };
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
  // B-20: prévia do desligamento e quem pode receber as pendências (equipe ativa, sem esta pessoa).
  const canDeactivate = user.is_active && !self;
  const [openItems, people] = canDeactivate
    ? await Promise.all([db.rpc("profile_open_items", { p_profile: id }).then((r) => r.data as unknown as OpenItems | null), loadProfiles(db)])
    : [null, null];
  const heirs = (people?.list ?? []).filter((p) => p.is_active && p.id !== id && p.role !== "client");
  const hasWork = !!openItems && openItems.requests.length + openItems.tasks.length > 0;

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
      {feito === "desativado" && leftOpen > 0 && (
        <div className="mb-4">
          <Notice tone="alerta">
            {leftOpen === 1 ? "1 chamado ou tarefa ficou sem responsável." : `${leftOpen} chamados ou tarefas ficaram sem responsável.`} Programe
            de novo em Chamados e na Agenda.
          </Notice>
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
                        <span className="tipo-condensada text-sm text-muted">{m.site?.code}</span>
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
              <div className="space-y-4">
                {openItems && <OpenItemsList items={openItems} />}
                <ActionForm action={setUserActiveAction} submitLabel="Desativar acesso" submitVariant="danger">
                  <input type="hidden" name="profile_id" value={user.id} />
                  <input type="hidden" name="active" value="0" />
                  {hasWork && (
                    <SelectField
                      label="Transferir chamados e tarefas para"
                      name="reassign_to"
                      placeholder="Não transferir: deixar sem responsável"
                      options={heirs.map((p) => ({ value: p.id, label: `${p.full_name} — ${ROLE_LABEL[p.role]}` }))}
                      hint="A pessoa escolhida só recebe o que for de um local em que ela trabalha. O resto fica sem responsável, à vista nas listas."
                    />
                  )}
                  <TextAreaField label="Motivo do desligamento" name="reason" required rows={2} maxLength={500} />
                  <p className="text-sm text-muted">
                    {user.full_name} deixa de entrar no sistema na hora, e os acessos aos locais são encerrados hoje. Chamados, fotos, despesas e
                    registros feitos por esta pessoa continuam no histórico com o nome dela.
                  </p>
                </ActionForm>
              </div>
            ) : (
              <RowAction action={setUserActiveAction} hidden={{ profile_id: user.id, active: "1" }} label="Reativar acesso" variant="primary" />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
