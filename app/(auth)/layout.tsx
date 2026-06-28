import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // If the visitor already has an active session, skip the login/register
  // screens entirely and drop them at HQ.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      {/* MEOWTRIX Logo / Title */}
      <div className="mb-8 text-center">
        <Image src="/logo/logo.png" alt="Meowtrix logo" width={64} height={64} className="mx-auto mb-3" priority />
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-bold tracking-wider text-sidebar-active uppercase">
          Meowtrix
        </h1>
        <p className="mt-2 text-sm font-bold uppercase text-text-secondary tracking-wide">
          Feline &amp; Canine Overlord Tracker
        </p>
      </div>

      {/* Auth card content */}
      <div className="w-full max-w-md">
        {children}
      </div>

      {/* Footer branding */}
      <p className="mt-8 text-xs font-mono font-bold uppercase text-text-secondary tracking-wider">
        Secure transmission channel — Classified HQ access
      </p>
    </div>
  );
}
