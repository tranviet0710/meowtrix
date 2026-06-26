export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      {/* MEOWTRIX Logo / Title */}
      <div className="mb-8 text-center">
        <h1 className="font-mono text-3xl font-bold tracking-wider text-accent">
          MEOWTRIX
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Feline Overlord Tracker
        </p>
      </div>

      {/* Auth card content */}
      <div className="w-full max-w-md">
        {children}
      </div>

      {/* Footer branding */}
      <p className="mt-8 text-xs text-text-secondary">
        Secure transmission channel — Classified HQ access
      </p>
    </div>
  );
}
