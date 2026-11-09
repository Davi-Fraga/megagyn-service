import { requireProfile } from "@/server/auth";
import { createSupabaseServer } from "@/server/supabase/server";
import { loadFileLimits } from "@/server/upload-limits";
import { FieldNav } from "@/ui/nav";
import { UploadLimitsProvider } from "@/ui/upload-limits";
import { signOut } from "../(auth)/actions";

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile(["worker", "foreman", "admin"]);
  const supabase = await createSupabaseServer();
  const [{ count }, limits] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    loadFileLimits(supabase),
  ]);
  return (
    <div className="min-h-dvh bg-papel pb-24" style={{ "--sticky-offset": "calc(4rem + 1px + env(safe-area-inset-bottom))" } as React.CSSProperties}>
      <FieldNav isForeman={profile.role !== "worker"} unread={count ?? 0} userName={profile.fullName} signOutAction={signOut} />
      <main id="conteudo" className="mx-auto w-full max-w-3xl px-4 py-5">
        <UploadLimitsProvider limits={limits}>{children}</UploadLimitsProvider>
      </main>
    </div>
  );
}
