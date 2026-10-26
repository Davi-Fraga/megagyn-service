import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(), microphone=()" },
];

const isDev = process.env.NODE_ENV !== "production";

// Sem origens externas: fontes são servidas pelo próprio app (next/font) e o navegador
// nunca fala direto com o Supabase. 'unsafe-inline' em script é exigido pelos scripts de
// hidratação do Next sem nonce; o ganho aqui é bloquear origens de fora, plugins,
// <base> e envio de formulário para outro site. 'unsafe-eval' e ws: só no modo dev.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "frame-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Playwright (PDF) e sharp (miniaturas) rodam apenas no servidor Node.
  serverExternalPackages: ["playwright", "sharp"],
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Rotas de arquivo/API definem o próprio CSP (anexos saem isolados em sandbox).
      { source: "/((?!api/).*)", headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] },
    ];
  },
};

export default nextConfig;
