/** Cabeçalho de autenticação básica do Gotenberg. Sem credenciais, não envia nada. */
export function gotenbergAuthHeaders(user: string, password: string): Record<string, string> {
  if (!user || !password) return {};
  return { Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}` };
}
