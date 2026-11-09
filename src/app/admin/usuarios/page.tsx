import type { Metadata } from "next";
import Link from "next/link";
import { MIN_PASSWORD_LENGTH } from "@/domain/registry";
import { createUserAction } from "@/server/actions/registry";
import { ROLE_LABEL } from "@/server/auth";
import { fetchAll } from "@/server/paginate";
import { createSupabaseServer } from "@/server/supabase/server";
import { ActionForm, SelectField, TextField } from "@/ui/form";
import { EmptyState, PageHeader, Panel } from "@/ui/page";
import { DataTable } from "@/ui/data-table";
import { ActiveBadge } from "../clientes/_shared/fields";
import { ROLE_OPTIONS } from "./_shared/role-options";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsersPage() {
  const db = await createSupabaseServer();
  // E-mail e telefone só pela view profile_contacts (B-16): a tabela não os entrega pela API.
  // As duas leituras vão em páginas: a API devolve no máximo 1000 linhas por consulta.
  const [data, contacts] = await Promise.all([
    fetchAll((from, to) =>
      db
        .from("profiles")
        .select("id, full_name, role, is_active")
        .order("is_active", { ascending: false })
        .order("full_name")
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) => db.from("profile_contacts").select("id, email, phone").order("id").range(from, to)),
  ]);
  const contactOf = new Map(contacts.map((c) => [c.id, c]));
  const users = data.map((u) => ({ ...u, email: contactOf.get(u.id)?.email ?? "", phone: contactOf.get(u.id)?.phone ?? null }));

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Cada pessoa entra com o próprio e-mail e senha. Desativar corta o acesso na hora e mantém tudo o que ela registrou."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {users.length === 0 ? (
            <EmptyState title="Nenhum usuário cadastrado." />
          ) : (
            <DataTable
              variant="ruler"
              minWidth="min-w-[40rem]"
              rows={users}
              rowKey={(u) => u.id}
              columns={[
                {
                  header: "Nome",
                  cell: (u) => (
                    <>
                      <Link href={`/admin/usuarios/${u.id}`} className="text-[1.0625rem] font-semibold leading-snug hover:underline">
                        {u.full_name}
                      </Link>
                      {u.phone && <p className="tipo-condensada mt-0.5 text-[0.9375rem] text-muted">{u.phone}</p>}
                    </>
                  ),
                },
                { header: "E-mail", className: "text-[0.9375rem] break-all", cell: (u) => u.email },
                { header: "Papel", className: "text-[0.9375rem]", cell: (u) => ROLE_LABEL[u.role] },
                { header: "Situação", cell: (u) => <ActiveBadge active={u.is_active} /> },
              ]}
            />
          )}
        </div>

        <Panel title="Novo usuário" className="h-fit">
          <ActionForm action={createUserAction} submitLabel="Cadastrar usuário" pendingLabel="Cadastrando…">
            <TextField label="Nome completo" name="full_name" required maxLength={160} autoComplete="off" />
            <TextField label="E-mail de acesso" name="email" type="email" inputMode="email" required maxLength={200} autoComplete="off" />
            <TextField label="Telefone" name="phone" type="tel" inputMode="tel" maxLength={40} autoComplete="off" />
            <SelectField
              label="Papel"
              name="role"
              required
              options={ROLE_OPTIONS}
              hint="Responsáveis do cliente ainda não têm login: aguarda decisão da Megagyn."
            />
            <TextField
              label="Senha inicial"
              name="password"
              type="password"
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              hint={`Deixe em branco para enviar um convite por e-mail: a pessoa cria a própria senha. Preencha (ao menos ${MIN_PASSWORD_LENGTH} caracteres) só se ela não puder usar o e-mail agora, e entregue a senha por um canal seguro.`}
            />
          </ActionForm>
          <p className="mt-4 text-sm text-muted">
            Depois de cadastrar funcionários e encarregados, dê acesso aos locais em que vão trabalhar (página do local, “Equipe com
            acesso”).
          </p>
        </Panel>
      </div>
    </>
  );
}
