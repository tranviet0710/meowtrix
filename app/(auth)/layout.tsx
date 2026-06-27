export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      {/* MEOWTRIX Logo / Title */}
      <div className="mb-8 text-center">
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
