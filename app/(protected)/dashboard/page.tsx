"use client";

import { StatGrid } from "@/components/dashboard/StatGrid";
import { MapViewDynamic } from "@/components/map/MapViewDynamic";

/**
 * HQ Dashboard — The main command center page.
 *
 * Displays:
 * - Stat cards (total Overlords, active searches, Informants online)
 * - MapView as the hero component (≥60% viewport on desktop)
 *
 * Requirements: 11.1, 11.2, 11.4, 11.6, 11.7
 */
export default function DashboardPage() {
  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg font-bold uppercase tracking-wider text-accent">
            HQ Dashboard
          </h1>
          <p className="mt-0.5 text-xs text-text-secondary">
            Command center overview — all systems operational
          </p>
        </div>
      </header>

      {/* Stat Cards */}
      <StatGrid />

      {/* Map Hero — ≥60% viewport on desktop, ≥50% on mobile */}
      <section
        className="relative flex-1 overflow-hidden rounded-[2px] border border-border min-h-[50vh] md:min-h-[60vh]"
        aria-label="Operations map"
      >
        <MapViewDynamic className="h-full w-full" />
      </section>
    </div>
  );
}
