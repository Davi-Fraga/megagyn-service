import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { hardenSessionCookie } from "@/domain/cookies";
import type { Database } from "@/server/db/database.types";
import { env } from "@/server/env";

/**
 * Cliente Supabase com a sessão do usuário: TODA leitura/escrita de dados de negócio
 * passa por aqui, com RLS ativa. Um cliente novo por requisição.
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, hardenSessionCookie(options, env.appUrl)));
        } catch {
          // Em Server Components os cookies são só leitura; o proxy renova a sessão.
        }
      },
    },
  });
}

export type ServerDb = Awaited<ReturnType<typeof createSupabaseServer>>;
