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

export default async function RegisterOnTaskPage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfile(["worker", "foreman", "admin"]);
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const db = await createSupabaseServer();
  const [oRes, ctx] = await Promise.all([
    db.from("task_occurrences").select("id, site_id, site:sites(name), task:tasks(title)").eq("id", id).maybeSingle(),
    loadFieldContext(db),
  ]);
  const o = rowOrNotFound(oRes);
  return (
    <>
      <PageHeader back={{ href: `/campo/tarefas/${o.id}`, label: "Tarefa" }} title="Registrar o que foi feito" description={`${o.task?.title ?? ""} — ${o.site?.name ?? ""}`} />
      <WorkEntryForm
        sites={ctx.sites}
        fixedSiteId={o.site_id}
        occurrenceId={o.id}
        returnTo={`/campo/tarefas/${o.id}`}
        pendingReasons={ctx.pendingReasons}
        backdateDays={ctx.backdateDays}
        showKind
      />
    </>
  );
}
