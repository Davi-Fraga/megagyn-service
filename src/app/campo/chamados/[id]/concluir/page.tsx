import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/domain/ids";
import { requireProfile } from "@/server/auth";
import { loadFieldContext } from "@/server/field";
import { createSupabaseServer } from "@/server/supabase/server";
import { PageHeader } from "@/ui/page";
import { ExecutedForm } from "../../../forms";
import { rowOrNotFound } from "@/server/query";

export const metadata: Metadata = { title: "Concluí" };

export default async function ExecutedPage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfile(["worker", "foreman", "admin"]);
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const db = await createSupabaseServer();
  const [rRes, ctx] = await Promise.all([
    db.from("service_requests").select("id, number, title, site_id").eq("id", id).maybeSingle(),
    loadFieldContext(db),
  ]);
  const r = rowOrNotFound(rRes);
  const site = ctx.sites.find((s) => s.id === r.site_id);
  return (
    <>
      <PageHeader
        back={{ href: `/campo/chamados/${r.id}`, label: `Chamado ${r.number}` }}
        title="Concluí o serviço"
        description="Descreva a solução e tire ao menos 1 foto do resultado. A Megagyn confere antes de encerrar."
      />
      <ExecutedForm requestId={r.id} siteId={r.site_id} base="/campo/chamados" members={site?.members ?? []} backdateDays={ctx.backdateDays} />
    </>
  );
}
