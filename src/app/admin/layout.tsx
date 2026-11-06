import { requireProfile } from "@/server/auth";
import { createSupabaseServer } from "@/server/supabase/server";
import { AdminNav } from "@/ui/nav";
import { signOut } from "../(auth)/actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile(["admin"]);
  const supabase = await createSupabaseServer();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return (
    <div className="min-h-dvh bg-papel lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <AdminNav userName={profile.fullName} unread={count ?? 0} signOutAction={signOut} />
      <main id="conteudo" className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 lg:px-14 lg:pb-20 lg:pt-11">
        {children}
      </main>
    </div>
  );
}
