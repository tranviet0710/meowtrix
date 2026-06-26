"use client";

import dynamic from "next/dynamic";
import type { MapViewProps } from "./MapView";

/**
 * MapViewDynamic — Dynamic wrapper that imports MapView with SSR disabled.
 *
 * Leaflet requires the DOM (window, document), so it cannot be rendered on the server.
 * Use this component instead of importing MapView directly in your pages.
 *
 * Usage:
 * ```tsx
 * import { MapViewDynamic } from "@/components/map/MapViewDynamic";
 *
 * export default function DashboardPage() {
 *   return <MapViewDynamic center={[13.7563, 100.5018]} zoom={13} />;
 * }
 * ```
 */
export const MapViewDynamic = dynamic(
  () => import("./MapView").then((mod) => mod.MapView),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center rounded-[2px] border border-border bg-card w-full min-h-[50vh]"
        role="status"
        aria-label="Loading map"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-accent/20" />
          <p className="animate-pulse text-sm text-text-secondary">
            Loading map...
          </p>
        </div>
      </div>
    ),
  }
);

export type { MapViewProps };
