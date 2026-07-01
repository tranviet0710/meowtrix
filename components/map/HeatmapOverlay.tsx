"use client";

import { useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker } from "react-leaflet";
import { calculateHeatmapRadius, getHeatmapCenter } from "@/lib/heatmapCalc";

interface HeatmapOverlayProps {
  overlordId: string;
  lastSeenLat: number;
  lastSeenLng: number;
  lastSeenAt: string;
  agentSightings: Array<{ lat: number; lng: number; sighted_at: string }>;
  status: "active" | "resolved";
}

/**
 * Interval in milliseconds for recalculating the radius (5 minutes).
 */
const RECALC_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Warm danger color from the design tokens (--color-danger, dark theme value).
 * Kept as a hex since Leaflet strokes/fills don't inherit CSS variables reliably.
 * Softer than the previous #FF4444 and legible on both light and dark OSM tiles.
 */
const ZONE_COLOR = "#FF7D7D";

/** Soft fill so overlapping zones from nearby overlords don't saturate to solid red. */
const FILL_OPACITY = 0.1;

/** Dashed stroke — reads as "search area" rather than a hard boundary. */
const STROKE_OPACITY = 0.65;
const STROKE_WEIGHT = 2;
const STROKE_DASH = "6 6";

/**
 * HeatmapOverlay — Renders a probability zone overlay on the map for a lost Overlord.
 *
 * Design: one soft-filled Leaflet Circle plus a small anchor dot at the last-seen
 * location. Uses a dashed brand-danger stroke so multiple overlapping zones remain
 * readable and match the app's warm palette.
 *
 * Recalculates radius every 5 minutes as elapsed time grows. Re-centers on the
 * most recent Agent sighting that falls within the current zone (per spec 6.5).
 *
 * Must be dynamically imported with next/dynamic and ssr: false since Leaflet
 * requires the DOM.
 */
export function HeatmapOverlay({
  overlordId,
  lastSeenLat,
  lastSeenLng,
  lastSeenAt,
  agentSightings,
  status,
}: HeatmapOverlayProps) {
  const [radius, setRadius] = useState<number | null>(() =>
    calculateHeatmapRadius(new Date(lastSeenAt))
  );

  // Recalculate radius every 5 minutes
  useEffect(() => {
    function recalculate() {
      const newRadius = calculateHeatmapRadius(new Date(lastSeenAt));
      setRadius(newRadius);
    }

    recalculate();
    const intervalId = setInterval(recalculate, RECALC_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [lastSeenAt]);

  // Zone center may shift toward a recent sighting within the radius.
  const center = useMemo(() => {
    if (radius === null) {
      return { lat: lastSeenLat, lng: lastSeenLng };
    }
    return getHeatmapCenter(lastSeenLat, lastSeenLng, agentSightings, radius);
  }, [lastSeenLat, lastSeenLng, agentSightings, radius]);

  // Don't render if resolved or if less than 30 min elapsed (radius is null)
  if (status === "resolved" || radius === null) {
    return null;
  }

  return (
    <>
      {/* Soft-filled search area with a dashed brand-danger border. */}
      <Circle
        key={`${overlordId}-zone`}
        center={[center.lat, center.lng]}
        radius={radius}
        pathOptions={{
          color: ZONE_COLOR,
          fillColor: ZONE_COLOR,
          fillOpacity: FILL_OPACITY,
          opacity: STROKE_OPACITY,
          weight: STROKE_WEIGHT,
          dashArray: STROKE_DASH,
        }}
        interactive={false}
      />

      {/* Small anchor dot to visually pin the center of the zone. */}
      <CircleMarker
        key={`${overlordId}-center`}
        center={[center.lat, center.lng]}
        radius={3}
        pathOptions={{
          color: ZONE_COLOR,
          fillColor: ZONE_COLOR,
          fillOpacity: 0.9,
          opacity: 0.9,
          weight: 1,
        }}
        interactive={false}
      />
    </>
  );
}
