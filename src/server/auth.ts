import { redirect } from "next/navigation";
import { cache } from "react";
import type { Database } from "@/server/db/database.types";
import { createSupabaseServer } from "@/server/supabase/server";

export type Role = Database["public"]["Enums"]["user_role"];
export type SessionProfile = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
};

/** Usuário autenticado + perfil (uma vez por requisição). O Auth é validado no servidor (getUser). */
export const getSessionProfile = cache(async (): Promise<{ userId: string; profile: SessionProfile | null } | null> => {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  return {
    userId: user.id,
    profile: data
      ? { id: data.id, email: data.email, fullName: data.full_name, role: data.role, isActive: data.is_active }
      : null,
  };
});

export const FIELD_ROLES: Role[] = ["worker", "foreman"];

/** Exige sessão ativa e um dos papéis. A autorização real dos dados continua na RLS. */
export async function requireProfile(roles?: Role[]): Promise<SessionProfile> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const profile = session.profile;
  if (!profile || !profile.isActive) redirect("/acesso-negado?motivo=inativo");
  if (roles && !roles.includes(profile.role)) redirect("/acesso-negado");
  return profile;
}

export function homeFor(role: Role): string {
  if (role === "admin") return "/admin";
  if (role === "worker" || role === "foreman") return "/campo";
  return "/acesso-negado";
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administração",
  worker: "Funcionário",
  foreman: "Encarregado",
  client: "Responsável do cliente",
};
