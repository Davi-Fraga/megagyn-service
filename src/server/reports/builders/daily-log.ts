import { addDaysIso, formatDateBR, isValidIsoDate } from "@/domain/dates";
import { dailyLogFileName } from "@/domain/report-naming";
import { html } from "@/reports/html";
import { diaryHtml } from "@/reports/templates/closing";
import { loadDiary, toClientDay } from "@/server/daily-log";
import { registerBuilder } from "../builders";
import { registerFileName } from "../file-names";

type Params = { siteId: string; from: string; to: string; clientView: boolean };

function params(raw: unknown): Params {
  const p = (raw ?? {}) as Record<string, unknown>;
  const from = String(p.from ?? "");
  const to = String(p.to ?? "");
  if (typeof p.siteId !== "string" || !isValidIsoDate(from) || !isValidIsoDate(to) || to < from || to > addDaysIso(from, 92)) {
    throw new Error("Parâmetros do diário não encontrados (local e período de até 3 meses).");
  }
  return { siteId: p.siteId, from, to, clientView: p.clientView === true || p.clientView === "true" };
}

registerBuilder("diario", async (admin, job) => {
  const p = params(job.params);
  const { data: site } = await admin.from("sites").select("name, address_text, client:clients(display_name)").eq("id", p.siteId).single();
  const days = (await loadDiary(admin, [p.siteId], p.from, p.to, { clientView: p.clientView })).get(p.siteId) ?? [];
  const sites = [{ name: site?.name ?? "", days: days.map(toClientDay) }];
  const photoIds = days.flatMap((d) => d.activities.flatMap((a) => a.photos.map((ph) => ph.id)));
  return {
    title: `Diário de obra ${site?.name ?? ""}`,
    footerLabel: `Diário ${formatDateBR(p.from)} a ${formatDateBR(p.to)}`,
    photoIds,
    body: (src) => html`
      <div class="title-block">
        <div class="doc-kind">Diário de obra</div>
        <h1>${site?.name ?? ""} — ${site?.client?.display_name ?? ""}</h1>
        <p class="muted">Período: ${formatDateBR(p.from)} a ${formatDateBR(p.to)}${site?.address_text ? ` · ${site.address_text}` : ""}</p>
        <p class="small muted">${p.clientView ? "Versão para o cliente: somente registros liberados ao cliente." : "Versão interna: inclui todos os registros."} ${days.length} dia(s) com registro.</p>
      </div>
      <div class="tape"></div>
      ${diaryHtml(sites, true, src)}`,
  };
});

registerFileName("diario", async (db, input) => {
  const p = params(input.params);
  const { data } = await db.from("sites").select("name").eq("id", p.siteId).maybeSingle();
  return data ? dailyLogFileName(data.name, p.from, p.to) : null;
});
