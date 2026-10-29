import { Clock, PencilLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { addDaysIso, formatDateBR, longDatePt, todayIso } from "@/domain/dates";
import { requireProfile } from "@/server/auth";
import { loadPhotos } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { ButtonLink } from "@/ui/button";
import { EmptyState } from "@/ui/page";
import { PhotoGrid } from "@/ui/photo-grid";
import { Badge } from "@/ui/status";

export const metadata: Metadata = { title: "Minhas atividades" };

export default async function MyActivitiesPage() {
  const profile = await requireProfile(["worker", "foreman", "admin"]);
  const db = await createSupabaseServer();
  const from = addDaysIso(todayIso(), -30);
  const { data } = await db
    .from("work_entry_participants")
    .select("entry:work_entries!inner(id, activity_date, description, outcome, review_status, site:sites(name), request:service_requests(id, number))")
    .eq("profile_id", profile.id)
    .gte("entry.activity_date", from);
  type Entry = { id: string; activity_date: string; description: string; outcome: string; review_status: string; site: { name: string } | null; request: { id: string; number: string } | null };
  const entries = ((data ?? []) as unknown as Array<{ entry: Entry }>).map((x) => x.entry).sort((a, b) => b.activity_date.localeCompare(a.activity_date));
  const photos = await loadPhotos(db, "work_entry", entries.map((e) => e.id));
  const dates = [...new Set(entries.map((e) => e.activity_date))];

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">O que eu fiz</h1>
        <Link href="/campo/horas" className="inline-flex min-h-11 items-center gap-1 font-semibold text-info underline">
          <Clock aria-hidden className="size-4" /> Minhas horas
        </Link>
      </div>
      <p className="mb-4 text-muted">Últimos 30 dias, incluindo registros em que você foi participante.</p>
      {entries.length === 0 ? (
        <EmptyState title="Nenhum registro nos últimos 30 dias." action={<ButtonLink href="/campo/registrar" icon={<PencilLine aria-hidden className="size-4" />}>Registrar o que foi feito</ButtonLink>} />
      ) : (
        dates.map((d) => (
          <section key={d} className="mb-6">
            <h2 className="mb-2 font-bold">{longDatePt(d)}</h2>
            <ul className="space-y-3">
              {entries
                .filter((e) => e.activity_date === d)
                .map((e) => (
                  <li key={e.id} className="space-y-2 rounded-panel border border-linha bg-papel p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{e.description}</p>
                      {e.review_status === "ajustado" && <Badge tone="info">Ajustado</Badge>}
                    </div>
                    <p className="text-sm text-muted">
                      {e.site?.name} · {formatDateBR(e.activity_date)}
                      {e.request && (
                        <>
                          {" · "}
                          <Link href={`/campo/chamados/${e.request.id}`} className="text-info underline">
                            chamado {e.request.number}
                          </Link>
                        </>
                      )}
                      {e.outcome !== "executado" ? (e.outcome === "parcial" ? " · feito em parte" : " · não realizado") : ""}
                    </p>
                    <PhotoGrid photos={photos.get(e.id) ?? []} emptyText="Sem fotos." />
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
