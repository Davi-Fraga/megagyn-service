import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATALOGS, catalogBySlug, type CatalogDef } from "@/domain/registry";
import { createCatalogItemAction, setCatalogItemActiveAction, updateCatalogItemAction } from "@/server/actions/registry";
import { createSupabaseServer } from "@/server/supabase/server";
import { ActionForm, TextAreaField, TextField } from "@/ui/form";
import { EmptyState, PageHeader, Panel } from "@/ui/page";
import { ActiveBadge } from "../../../clientes/_shared/fields";
import { RowAction } from "../../../clientes/_shared/row-action";

export const metadata: Metadata = { title: "Listas de escolha" };

/** Linha genérica dos catálogos (campos extras só existem em prioridades e fornecedores). */
type CatalogRow = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  level?: number;
  sla_days?: number | null;
  document?: string | null;
  phone?: string | null;
  notes?: string | null;
};

function ItemFields({ def, item }: { def: CatalogDef; item?: CatalogRow }) {
  return (
    <>
      <TextField label="Nome do item" name="name" required maxLength={120} defaultValue={item?.name} />
      <TextField
        label="Ordem na lista"
        name="sort_order"
        type="number"
        min={0}
        max={9999}
        defaultValue={item?.sort_order}
        hint={item ? undefined : "Em branco, vai para o fim da lista."}
      />
      {def.extra === "priority" && (
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Nível" name="level" type="number" min={0} max={99} defaultValue={item?.level ?? ""} hint="Maior = mais urgente." />
          <TextField
            label="Prazo padrão (dias)"
            name="sla_days"
            type="number"
            min={0}
            max={365}
            defaultValue={item?.sla_days ?? ""}
            hint="Em branco: prazo definido em cada chamado."
          />
        </div>
      )}
      {def.extra === "supplier" && (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="CPF ou CNPJ" name="document" maxLength={30} defaultValue={item?.document ?? ""} />
            <TextField label="Telefone" name="phone" type="tel" maxLength={40} defaultValue={item?.phone ?? ""} />
          </div>
          <TextAreaField label="Observações" name="notes" rows={2} maxLength={1000} defaultValue={item?.notes ?? ""} />
        </>
      )}
    </>
  );
}

function extraText(def: CatalogDef, item: CatalogRow): string | null {
  if (def.extra === "priority") return `Nível ${item.level ?? 0}${item.sla_days != null ? `, prazo padrão ${item.sla_days} dia(s)` : ""}`;
  if (def.extra === "supplier") return [item.document, item.phone].filter(Boolean).join(", ") || null;
  return null;
}

export default async function CatalogPage({ params }: { params: Promise<{ catalogo: string }> }) {
  const { catalogo } = await params;
  const def = catalogBySlug(catalogo);
  if (!def) notFound();
  const db = await createSupabaseServer();
  const { data } = await db
    .from(def.table as "service_categories")
    .select("*")
    .order("is_active", { ascending: false })
    .order("sort_order")
    .order("name");
  const items = (data ?? []) as CatalogRow[];

  return (
    <>
      <PageHeader back={{ href: "/admin/configuracoes", label: "Configurações" }} eyebrow="Lista de escolha" title={def.title} description={def.description} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <p className="text-sm text-muted">
            Itens não são excluídos. Desativado, o item some das listas de escolha, mas continua nos registros antigos.
          </p>
          {items.length === 0 ? (
            <EmptyState title="Nenhum item cadastrado." />
          ) : (
            <ul className="divide-y divide-linha border-y border-linha">
              {items.map((item) => {
                const extra = extraText(def, item);
                return (
                  <li key={item.id} className="space-y-2 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {item.name} <span className="tipo-condensada ml-2 text-[0.9375rem] font-normal text-muted">ordem {item.sort_order}</span>
                        </p>
                        {extra && <p className="text-sm text-muted">{extra}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {!item.is_active && <ActiveBadge active={false} />}
                        <RowAction
                          action={setCatalogItemActiveAction}
                          hidden={{ catalog: def.slug, item_id: item.id, active: item.is_active ? "0" : "1" }}
                          label={item.is_active ? "Desativar" : "Reativar"}
                        />
                      </div>
                    </div>
                    <details className="rounded-ctl border border-linha">
                      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Editar {item.name}</summary>
                      <div className="border-t border-linha p-3">
                        <ActionForm action={updateCatalogItemAction} submitLabel="Salvar item">
                          <input type="hidden" name="catalog" value={def.slug} />
                          <input type="hidden" name="item_id" value={item.id} />
                          <ItemFields def={def} item={item} />
                        </ActionForm>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="min-w-0 space-y-5">
          <Panel title={`Adicionar ${def.singular}`}>
            <ActionForm action={createCatalogItemAction} submitLabel="Adicionar" resetOnSuccess>
              <input type="hidden" name="catalog" value={def.slug} />
              <ItemFields def={def} />
            </ActionForm>
          </Panel>

          <Panel title="Outras listas">
            <ul className="space-y-1">
              {CATALOGS.filter((c) => c.slug !== def.slug).map((c) => (
                <li key={c.slug}>
                  <Link href={`/admin/configuracoes/catalogos/${c.slug}`} className="font-semibold text-info underline">
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
