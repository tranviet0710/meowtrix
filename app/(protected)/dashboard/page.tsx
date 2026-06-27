"use client";
import { StatGrid } from "@/components/dashboard/StatGrid";
import { MapViewDynamic } from "@/components/map/MapViewDynamic";

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

      <section
        className="relative flex-1 overflow-hidden border-[3px] border-sidebar-active shadow-[4px_4px_0px_var(--color-sidebar-active)] min-h-[50vh] md:min-h-[60vh]"
        aria-label="Operations map"
      >
        <div className="absolute top-0 left-0 z-10 bg-card border-b-[3px] border-r-[3px] border-sidebar-active px-3 py-1">
          <span className="font-[family-name:var(--font-space-grotesk)] text-xs font-bold uppercase text-sidebar-active">
            Live Operations Map
          </span>
        </div>
        <MapViewDynamic className="h-full w-full" />
      </section>
    </div>
  );
}
