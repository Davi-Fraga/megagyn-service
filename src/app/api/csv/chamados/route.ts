import { NextResponse } from "next/server";
import { formatDateBR, formatDateTimeBR, todayIso } from "@/domain/dates";
import { toCsv } from "@/domain/csv";
import { csvFileName } from "@/domain/report-naming";
import { STATUS_LABEL } from "@/domain/request-status";
import { loadProfiles } from "@/server/data";
import { listRequests, parseRequestFilters, type RequestListRow } from "@/server/request-list";
import { createSupabaseServer } from "@/server/supabase/server";

export const runtime = "nodejs";

/** CSV da listagem de chamados com os MESMOS filtros e a MESMA consulta da tela (totais conciliam). */
export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Sessão expirada", { status: 401 });
  const { data: role } = await supabase.rpc("current_app_role");
  if (role !== "admin") return new NextResponse("Acesso negado", { status: 403 });

  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = parseRequestFilters(params);
  const [{ rows, total }, profiles] = await Promise.all([listRequests(supabase, filters, 10_000), loadProfiles(supabase)]);
  const csv = toCsv<RequestListRow>(
    [
      { header: "Número", value: (r) => r.number },
      { header: "Título", value: (r) => r.title },
      { header: "Cliente", value: (r) => r.client?.display_name ?? "" },
      { header: "Obra/unidade", value: (r) => r.site?.name ?? "" },
      { header: "Situação", value: (r) => STATUS_LABEL[r.status] },
      { header: "Prazo vencido", value: (r) => (r.overdue ? "Sim" : "Não") },
      { header: "Prioridade", value: (r) => r.priority?.name ?? "" },
      { header: "Categoria", value: (r) => r.category?.name ?? "" },
      { header: "Responsáveis", value: (r) => r.activeAssigneeIds.map((id) => profiles.name(id)).join(", ") },
      { header: "Solicitante", value: (r) => r.requester_name ?? "" },
      { header: "Aberto em", value: (r) => formatDateTimeBR(r.opened_at) },
      { header: "Programado", value: (r) => formatDateBR(r.scheduled_date) },
      { header: "Prazo", value: (r) => formatDateBR(r.due_date) },
      { header: "Encerrado em", value: (r) => (r.closed_at ? formatDateTimeBR(r.closed_at) : "") },
      {
        header: "Pendência",
        value: (r) => {
          const p = (r.current_pending ?? null) as Record<string, string> | null;
          return r.status === "pendente" && p ? `${p.pending_reason ?? ""}: ${p.next_action ?? ""} (${p.next_action_owner_name ?? ""})` : "";
        },
      },
      { header: "Demanda interna", value: (r) => (r.is_internal ? "Sim" : "Não") },
    ],
    rows,
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFileName("Chamados", todayIso())}"`,
      "Cache-Control": "private, no-store",
      "X-Total-Count": String(total),
    },
  });
}
