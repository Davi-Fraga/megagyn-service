import type { Metadata } from "next";
import { todayIso } from "@/domain/dates";
import { requireProfile } from "@/server/auth";
import { createSupabaseServer } from "@/server/supabase/server";
import { EmptyState, PageHeader } from "@/ui/page";
import { ExpenseForm } from "../expense-form";
import { loadExpenseFormOptions } from "../options";

export const metadata: Metadata = { title: "Registrar compra" };

export default async function NewPurchasePage() {
  await requireProfile(["foreman", "admin"]);
  const db = await createSupabaseServer();
  const options = await loadExpenseFormOptions(db);

  return (
    <>
      <PageHeader
        back={{ href: "/campo/compras", label: "Minhas compras" }}
        title="Registrar compra"
        description="Foto da nota, valor e para quais obras foi. A administração confere depois."
      />
      {options.siteGroups.length === 0 ? (
        <EmptyState title="Você não está vinculado a nenhuma obra ativa." text="Peça à administração para vincular você às obras." />
      ) : (
        <ExpenseForm {...options} today={todayIso()} />
      )}
    </>
  );
}
