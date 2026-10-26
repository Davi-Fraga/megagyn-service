import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/domain/ids";
import { requireProfile } from "@/server/auth";
import { loadFieldContext } from "@/server/field";
import { createSupabaseServer } from "@/server/supabase/server";
import { PageHeader } from "@/ui/page";
import { WorkEntryForm } from "../../../forms";
import { rowOrNotFound } from "@/server/query";

export const metadata: Metadata = { title: "Registrar o que foi feito" };

export default async function RegisterOnRequestPage({ params }: { params: Promise<{ id: string }> }) {
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
      <PageHeader back={{ href: `/campo/chamados/${r.id}`, label: `Chamado ${r.number}` }} title="Registrar o que foi feito" description={r.title} />
      <WorkEntryForm
        sites={ctx.sites}
        fixedSiteId={r.site_id}
        requestId={r.id}
        returnTo={`/campo/chamados/${r.id}`}
        pendingReasons={ctx.pendingReasons}
        backdateDays={ctx.backdateDays}
      />
    </>
  );
}
