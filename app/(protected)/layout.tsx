import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { ToastQueue } from "@/components/layout/ToastQueue";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area — offset by sidebar width on desktop */}
      <main className="md:ml-64 min-h-screen pb-20 md:pb-0 overflow-x-hidden w-full">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <BottomNav />

      {/* Toast notification system */}
      <ToastQueue />
    </div>
  );
}
