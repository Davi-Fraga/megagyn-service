/** Variáveis de ambiente lidas em tempo de execução (nunca embutidas no código). */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ${name} não configurada. Veja .env.example.`);
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get serviceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get appUrl() {
    return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get pdfRenderer(): "playwright" | "gotenberg" {
    return process.env.PDF_RENDERER === "gotenberg" ? "gotenberg" : "playwright";
  },
  get gotenbergUrl() {
    return process.env.GOTENBERG_URL ?? "";
  },
};
