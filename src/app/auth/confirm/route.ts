import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { safeRedirectPath } from "@/domain/safe-redirect";
import { createSupabaseServer } from "@/server/supabase/server";

const TYPES: EmailOtpType[] = ["recovery", "invite", "email", "email_change", "magiclink", "signup"];

/**
 * Link do e-mail de recuperação/convite (token_hash). Diferente do fluxo PKCE, funciona
 * mesmo quando o link é aberto em outro aparelho ou navegador.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? "/redefinir-senha";
  const safeNext = safeRedirectPath(next, "/redefinir-senha");
  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL("/recuperar-acesso?erro=link", url.origin));
}
