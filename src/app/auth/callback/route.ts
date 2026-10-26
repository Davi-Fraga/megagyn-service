import { NextResponse } from "next/server";
import { safeRedirectPath } from "@/domain/safe-redirect";
import { createSupabaseServer } from "@/server/supabase/server";

/** Retorno do link de recuperação de senha (fluxo PKCE do Supabase). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  const safeNext = safeRedirectPath(next, "/");
  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL("/recuperar-acesso?erro=link", url.origin));
}
