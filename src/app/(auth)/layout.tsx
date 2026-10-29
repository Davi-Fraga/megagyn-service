import { BrandLockup } from "@/ui/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col">
      <div aria-hidden className="faixa-alerta h-2" />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 flex justify-center">
          <BrandLockup />
        </div>
        <div className="rounded-panel border border-linha bg-papel p-5 sm:p-7">{children}</div>
      </div>
    </main>
  );
}
