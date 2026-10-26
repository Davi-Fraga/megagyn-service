import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hardenSessionCookie } from "@/domain/cookies";

const PROTECTED = ["/admin", "/campo"];

/** Renova a sessão do Supabase e manda para o login quem não está autenticado. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, hardenSessionCookie(options, process.env.APP_URL ?? "http://localhost:3000")),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (error?.code === "user_banned" && path !== "/acesso-negado") {
    // Usuário desativado com sessão aberta: perde o acesso na hora, com explicação.
    const url = request.nextUrl.clone();
    url.pathname = "/acesso-negado";
    url.search = "?motivo=inativo";
    return NextResponse.redirect(url);
  }
  if (!user && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // /api fica fora: rotas de API autenticam sozinhas e o proxy limitaria o corpo dos uploads a 10 MB.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
