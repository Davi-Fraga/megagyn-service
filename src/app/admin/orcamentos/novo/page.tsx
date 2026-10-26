import type { Metadata } from "next";
import { addDaysIso, todayIso } from "@/domain/dates";
import { createSupabaseServer } from "@/server/supabase/server";
import { ButtonLink } from "@/ui/button";
import { EmptyState, PageHeader } from "@/ui/page";
import { loadQuoteFormOptions } from "../load";
import { QuoteForm } from "../quote-form";

export const metadata: Metadata = { title: "Novo orçamento" };

export default async function NewQuotePage() {
  const db = await createSupabaseServer();
  const options = await loadQuoteFormOptions(db);
  const today = todayIso();

  return (
    <div className="max-w-4xl">
      <PageHeader
        back={{ href: "/admin/orcamentos", label: "Orçamentos" }}
        title="Novo orçamento"
        description="O número (ORC-AAAA-NNNN) é gerado ao salvar. Depois de salvar, adicione as fotos do local e de serviços semelhantes."
      />
      {options.clients.length === 0 ? (
        <EmptyState
          title="Nenhum cliente cadastrado."
          text="Cadastre o cliente antes de montar a proposta."
          action={<ButtonLink href="/admin/clientes">Cadastrar cliente</ButtonLink>}
        />
      ) : (
        <QuoteForm
          clients={options.clients}
          contactsByClient={options.contactsByClient}
          sitesByClient={options.sitesByClient}
          submitLabel="Salvar rascunho"
          items={[]}
          values={{
            client_id: "",
            client_contact_id: "",
            site_id: "",
            service_location_text: "",
            title: "",
            issued_at: today,
            valid_until: addDaysIso(today, 30),
            execution_deadline_text: "",
            payment_terms: "",
            warranty_text: "",
            inclusions_text: "",
            intro_text: options.introDefault,
            observations: "",
            technical_notes: "",
            declaration_text: options.declarationDefault,
          }}
        />
      )}
    </div>
  );
}
