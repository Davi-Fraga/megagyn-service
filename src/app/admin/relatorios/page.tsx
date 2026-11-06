import { Download, FileDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { addDaysIso, isValidIsoDate, todayIso } from "@/domain/dates";
import { UUID_RE } from "@/domain/ids";
import { loadProfiles, loadSites } from "@/server/data";
import { createSupabaseServer } from "@/server/supabase/server";
import { buttonClass } from "@/ui/button";
import { PageHeader, Panel } from "@/ui/page";
import { GenerateReportButton } from "@/ui/report-button";
import { List } from "@/ui/list";

// Esta página pede PDFs; a geração roda após a resposta e precisa caber no tempo da função (Vercel Hobby: até 300 s).
export const maxDuration = 300;

export const metadata: Metadata = { title: "Relatórios" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ local?: string; pessoa?: string; de?: string; ate?: string }>;
}) {
  const sp = await searchParams;
  const today = todayIso();
  const from = sp.de && isValidIsoDate(sp.de) ? sp.de : addDaysIso(today, -30);
  const to = sp.ate && isValidIsoDate(sp.ate) ? sp.ate : today;
  const siteId = sp.local && UUID_RE.test(sp.local) ? sp.local : null;
  const personId = sp.pessoa && UUID_RE.test(sp.pessoa) ? sp.pessoa : null;
  const db = await createSupabaseServer();
  const [sites, profiles, { data: recent }] = await Promise.all([
    loadSites(db),
    loadProfiles(db),
    db.from("report_artifacts").select("id, kind, file_name, status, requested_at, page_count").order("requested_at", { ascending: false }).limit(15),
  ]);

  return (
    <>
      <PageHeader title="Relatórios" description="PDFs A4 com páginas numeradas e CSV para planilha. O fechamento mensal fica em Fechamento mensal; a OS individual, no próprio chamado." />
      <form method="get" className="mb-5 grid gap-3 rounded-panel border border-linha bg-papel p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <label className="space-y-1 text-sm font-semibold">
          Obra ou unidade
          <select name="local" defaultValue={siteId ?? ""} className="campo-input">
            <option value="">—</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.clientName} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Pessoa
          <select name="pessoa" defaultValue={personId ?? ""} className="campo-input">
            <option value="">—</option>
            {profiles.list
              .filter((p) => p.role !== "client")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          De
          <input type="date" name="de" defaultValue={from} className="campo-input" />
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Até
          <input type="date" name="ate" defaultValue={to} className="campo-input" />
        </label>
        <button type="submit" className={buttonClass("dark")}>
          Aplicar
        </button>
      </form>

      <div className="grid grid-cols-1 gap-x-14 gap-y-10 lg:grid-cols-2">
        <Panel title="Diário por local">
          {siteId ? (
            <div className="flex flex-wrap gap-2">
              <GenerateReportButton kind="diario" params={{ siteId, from, to, clientView: false }} label="PDF interno" icon={<FileDown aria-hidden className="size-4" />} />
              <GenerateReportButton kind="diario" params={{ siteId, from, to, clientView: true }} label="PDF para o cliente" icon={<FileDown aria-hidden className="size-4" />} />
            </div>
          ) : (
            <p className="text-muted">Escolha a obra ou unidade e o período acima.</p>
          )}
        </Panel>
        <Panel title="Atividades por pessoa">
          {personId ? (
            <GenerateReportButton kind="atividades_pessoa" params={{ profileId: personId, from, to }} label="Gerar PDF" icon={<FileDown aria-hidden className="size-4" />} />
          ) : (
            <p className="text-muted">Escolha a pessoa e o período acima.</p>
          )}
        </Panel>
        <Panel title="Despesas internas (uso exclusivo da Megagyn)">
          <GenerateReportButton
            kind="despesas_internas"
            params={{ from, to, siteId: siteId ?? "" }}
            label="Gerar PDF"
            icon={<FileDown aria-hidden className="size-4" />}
          />
          <p className="mt-2 text-sm text-muted">Rateios, comprovantes, situação de conferência e reembolsos. Nunca entregue ao cliente.</p>
        </Panel>
        <Panel title="Planilhas (CSV)">
          <ul className="space-y-2">
            <li>
              <a href={`/api/csv/chamados?de=${from}&ate=${to}${siteId ? `&local=${siteId}` : ""}`} className={buttonClass("secondary")}>
                <Download aria-hidden className="size-4" /> Chamados abertos no período
              </a>
            </li>
            <li>
              <a href={`/api/csv/despesas?de=${from}&ate=${to}${siteId ? `&obra=${siteId}` : ""}`} className={buttonClass("secondary")}>
                <Download aria-hidden className="size-4" /> Despesas do período
              </a>
            </li>
          </ul>
          <p className="mt-2 text-sm text-muted">Arquivos UTF-8 separados por ponto e vírgula, prontos para o Excel em português.</p>
        </Panel>
      </div>

      <h2 className="mb-2 mt-8 text-lg font-bold">Últimos PDFs gerados</h2>
      <List variant="boxed">
        {(recent ?? []).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
            <span>{r.file_name}</span>
            {r.status === "pronto" ? (
              <Link href={`/api/reports/${r.id}/download`} className="font-semibold text-info underline">
                Baixar ({r.page_count ?? "?"} págs.)
              </Link>
            ) : (
              <span className="text-sm text-muted">{r.status === "falhou" ? "Falhou" : "Gerando…"}</span>
            )}
          </li>
        ))}
      </List>
    </>
  );
}
