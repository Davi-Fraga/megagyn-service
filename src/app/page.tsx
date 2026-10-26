import { redirect } from "next/navigation";
import { getSessionProfile, homeFor } from "@/server/auth";

export default async function Home() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (!session.profile || !session.profile.isActive) redirect("/acesso-negado?motivo=inativo");
  redirect(homeFor(session.profile.role));
}
