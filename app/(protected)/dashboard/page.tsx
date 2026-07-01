"use client";
import dynamic from "next/dynamic";
import { StatGrid } from "@/components/dashboard/StatGrid";
import { MyReports } from "@/components/dashboard/MyReports";

// OperationsMap pulls in react-leaflet / leaflet at module scope, which
// touches `window` on load. Load it dynamically with SSR disabled so the
// prerender does not evaluate the leaflet module tree.
const OperationsMap = dynamic(
  () =>
    import("@/components/dashboard/OperationsMap").then(
      (mod) => mod.OperationsMap
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full w-full items-center justify-center bg-card"
        role="status"
        aria-label="Loading operations map"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-sidebar-active/20" />
          <p className="animate-pulse font-mono text-xs uppercase tracking-wide text-text-secondary">
            Loading map...
          </p>
        </div>
      </div>
    ),
  }
);

export default function DashboardPage() {
  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <header>
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold uppercase tracking-wider text-sidebar-active">
          HQ Dashboard
        </h1>
        <p className="mt-1 text-xs font-mono uppercase tracking-wide text-text-secondary">
          Command center overview — all systems operational
        </p>
      </header>

      <StatGrid />

      <MyReports />

      <section
        className="relative flex-1 overflow-hidden border-[3px] border-sidebar-active shadow-[4px_4px_0px_var(--color-sidebar-active)] min-h-[50vh] md:min-h-[60vh]"
        aria-label="Operations map"
      >
        <div className="absolute top-0 left-0 z-10 bg-card border-b-[3px] border-r-[3px] border-sidebar-active px-3 py-1">
          <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-bold uppercase text-sidebar-active">
            Live Operations Map
          </span>
        </div>
        <OperationsMap />
      </section>
    </div>
  );
}
