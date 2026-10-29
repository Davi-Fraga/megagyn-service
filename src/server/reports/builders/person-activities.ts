import { addDaysIso, formatDateBR, formatDateTimeBR, isValidIsoDate } from "@/domain/dates";
import { fileSlug } from "@/domain/report-naming";
import { STATUS_LABEL, type RequestStatus } from "@/domain/request-status";
import { html, join } from "@/reports/html";
import { registerBuilder } from "../builders";
import { registerFileName } from "../file-names";
import { fetchAll } from "@/server/paginate";

type Params = { profileId: string; from: string; to: string };

function params(raw: unknown): Params {
  const p = (raw ?? {}) as Record<string, unknown>;
  const from = String(p.from ?? "");
  const to = String(p.to ?? "");
  if (typeof p.profileId !== "string" || !isValidIsoDate(from) || !isValidIsoDate(to) || to < from || to > addDaysIso(from, 92)) {
    throw new Error("Parâmetros do relatório não encontrados (pessoa e período de até 3 meses).");
  }
  return { profileId: p.profileId, from, to };
}

const OCC: Record<string, string> = { prevista: "Prevista", iniciada: "Iniciada", concluida: "Finalizada", nao_realizada: "Não realizada", cancelada: "Cancelada" };

/** Atividades por pessoa: programadas, realizadas, pendências e locais (Word §8). */
registerBuilder("atividades_pessoa", async (admin, job) => {
  const p = params(job.params);
  // Listas que crescem com o tempo são paginadas (a API devolve no máximo 1000 linhas por consulta).
  const [{ data: person }, participations, assignments, requestAssignments, hours] = await Promise.all([
    admin.from("profiles").select("full_name, role").eq("id", p.profileId).single(),
    fetchAll((a, b) =>
      admin
        .from("work_entry_participants")
        .select("work_entry_id, entry:work_entries!inner(id, activity_date, description, outcome, next_step, site:sites(name), request:service_requests(number))")
        .eq("profile_id", p.profileId)
        .gte("entry.activity_date", p.from)
        .lte("entry.activity_date", p.to)
        .order("work_entry_id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      admin
        .from("task_assignments")
        .select("task_id, task:tasks!inner(title, occurrences:task_occurrences(scheduled_date, status, no_show_reason, site:sites(name)))")
        .eq("profile_id", p.profileId)
        .order("task_id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      admin
        .from("request_assignments")
        .select("id, request:service_requests!inner(number, title, status, scheduled_date, current_pending, site:sites(name))")
        .eq("profile_id", p.profileId)
        .is("unassigned_at", null)
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      admin
        .from("time_entries")
        .select("id, work_date, hours, site:sites(name)")
        .eq("profile_id", p.profileId)
        .gte("work_date", p.from)
        .lte("work_date", p.to)
        .order("work_date")
        .order("id")
        .range(a, b),
    ),
  ]);

  type Entry = { id: string; activity_date: string; description: string; outcome: string; next_step: string | null; site: { name: string } | null; request: { number: string } | null };
  const entries = ((participations ?? []) as unknown as Array<{ entry: Entry }>).map((x) => x.entry).sort((a, b) => a.activity_date.localeCompare(b.activity_date));
  type Occ = { scheduled_date: string; status: string; no_show_reason: string | null; site: { name: string } | null };
  const planned = ((assignments ?? []) as unknown as Array<{ task: { title: string; occurrences: Occ[] } }>)
    .flatMap((a) => a.task.occurrences.map((o) => ({ ...o, title: a.task.title })))
    .filter((o) => o.scheduled_date >= p.from && o.scheduled_date <= p.to)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  type Req = { number: string; title: string; status: RequestStatus; scheduled_date: string | null; current_pending: Record<string, string> | null; site: { name: string } | null };
  const openRequests = ((requestAssignments ?? []) as unknown as Array<{ request: Req }>)
    .map((x) => x.request)
    .filter((r) => r.status !== "concluida" && r.status !== "cancelada");
  const sites = [...new Set([...entries.map((e) => e.site?.name), ...planned.map((o) => o.site?.name)].filter(Boolean))];
  const totalHours = (hours ?? []).reduce((n, h) => n + Number(h.hours ?? 0), 0);

  return {
    title: `Atividades de ${person?.full_name ?? ""}`,
    footerLabel: `Atividades ${formatDateBR(p.from)} a ${formatDateBR(p.to)}`,
    photoIds: [],
    body: () => html`
      <div class="title-block">
        <div class="doc-kind">Atividades por pessoa</div>
        <h1>${person?.full_name ?? ""}</h1>
        <p class="muted">Período: ${formatDateBR(p.from)} a ${formatDateBR(p.to)} · Locais atendidos: ${sites.join(", ") || "—"}</p>
      </div>
      <div class="summary">
        <div><b>${planned.length}</b><span>tarefas programadas</span></div>
        <div><b>${planned.filter((o) => o.status === "concluida").length}</b><span>tarefas finalizadas</span></div>
        <div><b>${entries.length}</b><span>atividades registradas</span></div>
        <div><b>${String(Math.round(totalHours * 100) / 100).replace(".", ",")}</b><span>horas de jornada</span></div>
      </div>
      <h2>Tarefas programadas</h2>
      <table><thead><tr><th>Data</th><th>Tarefa</th><th>Local</th><th>Situação</th></tr></thead>
      <tbody>${planned.length ? join(planned.map((o) => html`<tr><td>${formatDateBR(o.scheduled_date)}</td><td>${o.title}</td><td>${o.site?.name ?? ""}</td><td>${OCC[o.status] ?? o.status}${o.no_show_reason ? ` — ${o.no_show_reason}` : ""}</td></tr>`)) : html`<tr><td colspan="4" class="muted">Nenhuma.</td></tr>`}</tbody></table>
      <h2>Atividades realizadas</h2>
      <table><thead><tr><th>Data</th><th>Local</th><th>O que foi feito</th><th>Resultado</th></tr></thead>
      <tbody>${entries.length ? join(entries.map((e) => html`<tr><td>${formatDateBR(e.activity_date)}</td><td>${e.site?.name ?? ""}${e.request ? html`<br><span class="small muted">Chamado ${e.request.number}</span>` : ""}</td><td>${e.description}</td><td>${e.outcome === "executado" ? "Feito" : e.outcome === "parcial" ? "Em parte" : "Não feito"}${e.next_step ? ` — ${e.next_step}` : ""}</td></tr>`)) : html`<tr><td colspan="4" class="muted">Nenhuma.</td></tr>`}</tbody></table>
      <h2>Chamados atribuídos ainda abertos</h2>
      <table><thead><tr><th>Nº</th><th>Chamado</th><th>Situação</th><th>Pendência</th></tr></thead>
      <tbody>${openRequests.length ? join(openRequests.map((r) => html`<tr><td>${r.number}</td><td>${r.title}<br><span class="small muted">${r.site?.name ?? ""}</span></td><td>${STATUS_LABEL[r.status]}</td><td class="small">${r.current_pending ? `${r.current_pending.pending_reason ?? ""}: ${r.current_pending.next_action ?? ""}` : "—"}</td></tr>`)) : html`<tr><td colspan="4" class="muted">Nenhum.</td></tr>`}</tbody></table>
      <p class="small muted" style="margin-top:4mm">Emitido em ${formatDateTimeBR(job.requested_at)}.</p>`,
  };
});

registerFileName("atividades_pessoa", async (db, input) => {
  const p = params(input.params);
  const { data } = await db.from("profiles").select("full_name").eq("id", p.profileId).maybeSingle();
  return data ? `Atividades_${fileSlug(data.full_name)}_${formatDateBR(p.from).replace(/\//g, "-")}_a_${formatDateBR(p.to).replace(/\//g, "-")}.pdf` : null;
});
