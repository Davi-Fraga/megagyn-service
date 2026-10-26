type CookieOptions = {
  maxAge?: number;
  expires?: Date;
  path?: string;
  domain?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: boolean | "lax" | "strict" | "none";
  [key: string]: unknown;
};

/**
 * Opções finais dos cookies de sessão do Supabase. A aplicação não usa o cliente
 * Supabase no navegador, então o token nunca precisa ser lido por script (httpOnly).
 * "lax" mantém o link de recuperação de senha funcionando vindo do e-mail.
 */
export function hardenSessionCookie<T extends CookieOptions>(options: T | undefined, appUrl: string): T & CookieOptions {
  return {
    ...(options ?? ({} as T)),
    path: options?.path ?? "/",
    httpOnly: true,
    sameSite: "lax",
    secure: appUrl.startsWith("https://"),
  };
}
