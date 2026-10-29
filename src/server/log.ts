/** Log operacional estruturado (JSON em uma linha). Nunca registrar senhas, tokens ou conteúdo de anexos. */
type Level = "info" | "warn" | "error";

function write(level: Level, event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...data });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, data?: Record<string, unknown>) => write("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => write("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) => write("error", event, data),
};

export function errorInfo(error: unknown): Record<string, unknown> {
  if (error instanceof Error) return { message: error.message, name: error.name };
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    return { message: e.message, code: e.code, hint: e.hint, details: e.details };
  }
  return { message: String(error) };
}
