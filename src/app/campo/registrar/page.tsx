import type { Metadata } from "next";
import { requireProfile } from "@/server/auth";
import { loadFieldContext } from "@/server/field";
import { createSupabaseServer } from "@/server/supabase/server";
import { EmptyState, PageHeader } from "@/ui/page";
import { WorkEntryForm } from "../forms";

export const metadata: Metadata = { title: "Registrar o que foi feito" };

/** Atividade direta, sem chamado (vistoria, visita, serviço do dia). Entra no diário normalmente. */
export default async function RegisterPage() {
  await requireProfile(["worker", "foreman", "admin"]);
  const db = await createSupabaseServer();
  const ctx = await loadFieldContext(db);
  return (
    <>
      <PageHeader
        back={{ href: "/campo", label: "Hoje" }}
        title="Registrar o que foi feito"
        description="Use para serviços do dia sem chamado. Se o serviço é de um chamado, registre dentro do chamado."
      />
      {ctx.sites.length === 0 ? (
        <EmptyState title="Você ainda não está vinculado a nenhuma obra." text="Peça à administração para liberar seus locais de trabalho." />
      ) : (
        <WorkEntryForm sites={ctx.sites} returnTo="/campo" pendingReasons={ctx.pendingReasons} backdateDays={ctx.backdateDays} showKind />
      )}
    </>
  );
}
