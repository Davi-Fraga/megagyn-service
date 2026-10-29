import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/database.types";
import { env } from "@/server/env";

/**
 * Cliente com service_role: ignora RLS. Uso restrito a:
 *  - bytes do Storage (sempre após checagem de RLS com a sessão do usuário);
 *  - criação de contas no Auth pela administração;
 *  - processamento de relatórios no servidor/worker.
 * Nunca importar em código de cliente.
 */
export function createSupabaseAdmin() {
  return createClient<Database>(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
