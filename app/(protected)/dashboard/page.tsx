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
        aria-label="Loading map"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-primary/20" />
          <p className="animate-pulse text-sm text-text-secondary">
            Loading map…
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
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-text-primary">
          Welcome back 🐾
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Here&apos;s what&apos;s happening in your area
        </p>
      </header>

      <StatGrid />

      <MyReports />

      <section
        className="relative overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-soft)] h-[70dvh] md:h-[calc(100dvh-11rem)] md:min-h-[560px]"
        aria-label="Live map of missing pets and sightings"
      >
        <div className="absolute top-0 left-0 z-[400] rounded-br-xl border-b border-r border-border bg-card/95 backdrop-blur-sm px-3 py-1.5">
          <span className="text-xs font-semibold text-text-primary">
            Live Map · Missing pets &amp; sightings nearby
          </span>
        </div>
        <OperationsMap />
      </section>
    </div>
  );
}
