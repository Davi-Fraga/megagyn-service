import type { ServerDb } from "@/server/data";

export type ClientSituation = "ativos" | "inativos" | "todos";

/**
 * Lista de clientes da administração (até 300), com a contagem de locais de cada um.
 * A contagem é feita aqui, sobre os ids: com a leitura de locais por coluna (B-16), "sites(count)" pede a
 * tabela inteira e falha, e a API não libera agregação por coluna.
 * Erro de consulta sobe para a tela de erro: lista vazia silenciosa esconde o problema.
 */
export async function listClients(db: ServerDb, { q, situation }: { q: string | null; situation: ClientSituation }) {
  let query = db
    .from("clients")
    .select("id, kind, legal_name, display_name, document, email, phone, is_active, sites(id)")
    .order("display_name")
    .limit(300);
  if (situation === "ativos") query = query.eq("is_active", true);
  if (situation === "inativos") query = query.eq("is_active", false);
  if (q) query = query.or(`display_name.ilike.*${q}*,legal_name.ilike.*${q}*`);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(({ sites, ...c }) => ({ ...c, siteCount: sites.length }));
}
