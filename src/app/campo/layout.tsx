import { requireProfile } from "@/server/auth";
import { createSupabaseServer } from "@/server/supabase/server";
import { FieldNav } from "@/ui/nav";
import { signOut } from "../(auth)/actions";

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile(["worker", "foreman", "admin"]);
  const supabase = await createSupabaseServer();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return (
    <div className="min-h-dvh pb-24" style={{ "--sticky-offset": "calc(4.25rem + env(safe-area-inset-bottom))" } as React.CSSProperties}>
      <FieldNav isForeman={profile.role !== "worker"} unread={count ?? 0} userName={profile.fullName} signOutAction={signOut} />
      <main id="conteudo" className="mx-auto w-full max-w-3xl px-4 py-5">
        {children}
      </main>
    </div>
  );
}
