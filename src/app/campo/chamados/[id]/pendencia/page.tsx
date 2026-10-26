import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/domain/ids";
import { requireProfile } from "@/server/auth";
import { loadFieldContext } from "@/server/field";
import { createSupabaseServer } from "@/server/supabase/server";
import { PageHeader } from "@/ui/page";
import { PendingForm } from "../../../forms";
import { rowOrNotFound } from "@/server/query";

export const metadata: Metadata = { title: "Não consegui concluir" };

export default async function PendingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfile(["worker", "foreman", "admin"]);
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const db = await createSupabaseServer();
  const [rRes, ctx] = await Promise.all([
    db.from("service_requests").select("id, number, title, site_id").eq("id", id).maybeSingle(),
    loadFieldContext(db),
  ]);
  const r = rowOrNotFound(rRes);
  return (
    <>
      <PageHeader
        back={{ href: `/campo/chamados/${r.id}`, label: `Chamado ${r.number}` }}
        title="Não consegui concluir"
        description="Conte o motivo e o que precisa acontecer para continuar. O chamado fica pendente até ser retomado."
      />
      <PendingForm requestId={r.id} siteId={r.site_id} base="/campo/chamados" pendingReasons={ctx.pendingReasons} owners={ctx.owners} />
    </>
  );
}
