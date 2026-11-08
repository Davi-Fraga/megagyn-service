"use client";

import { useState } from "react";
import { CheckboxGroup, SelectField } from "@/ui/form";

type Site = { id: string; name: string; clientId: string; clientName: string };

/**
 * Locais da tarefa com filtro por cliente (B-23). O cliente só filtra a lista: a tarefa pode
 * ter locais de vários clientes, e o local já marcado de outro cliente continua à vista.
 */
export function TaskSitePicker({ sites }: { sites: Site[] }) {
  const [clientId, setClientId] = useState("");
  const clients = [...new Map(sites.map((s) => [s.clientId, s.clientName])).entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  const clientOf = new Map(sites.map((s) => [s.id, s.clientId]));

  return (
    <div className="space-y-4">
      <SelectField
        label="Cliente"
        name="client_filter"
        placeholder="Todos os clientes"
        options={clients}
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        hint="Filtra a lista de locais. A tarefa pode ter locais de mais de um cliente."
      />
      <CheckboxGroup
        label="Locais"
        name="site_ids"
        required
        options={sites.map((s) => ({ value: s.id, label: `${s.clientName} — ${s.name}` }))}
        isHidden={(siteId) => clientId !== "" && clientOf.get(siteId) !== clientId}
      />
    </div>
  );
}
