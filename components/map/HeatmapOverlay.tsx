"use client";

import { useEffect, useMemo, useState } from "react";
import { Circle } from "react-leaflet";
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
 * Number of concentric circles used to simulate the gradient effect.
 * More rings = smoother gradient, but more DOM elements.
 */
const GRADIENT_RINGS = 8;

/**
 * Maximum opacity at the center of the heatmap.
 */
const MAX_OPACITY = 0.6;

/**
 * Interval in milliseconds for recalculating the radius (5 minutes).
 */
const RECALC_INTERVAL_MS = 5 * 60 * 1000;

/**
 * HeatmapOverlay — Renders a probability zone overlay on the map for a lost Overlord.
 *
 * Uses multiple concentric Leaflet Circles with decreasing opacity to simulate
 * a gradient effect (center 0.6 → edge 0). Recalculates radius every 5 minutes
 * as the elapsed time increases.
 *
 * Must be dynamically imported with next/dynamic and ssr: false since Leaflet requires the DOM.
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

    // Initial calculation
    recalculate();

    const intervalId = setInterval(recalculate, RECALC_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [lastSeenAt]);

  // Calculate the center point (may shift if agent sightings are within zone)
  const center = useMemo(() => {
    if (radius === null) {
      return { lat: lastSeenLat, lng: lastSeenLng };
    }

    return getHeatmapCenter(
      lastSeenLat,
      lastSeenLng,
      agentSightings,
      radius
    );
  }, [lastSeenLat, lastSeenLng, agentSightings, radius]);

  // Don't render if resolved or if less than 30 min elapsed (radius is null)
  if (status === "resolved" || radius === null) {
    return null;
  }

  // Generate concentric circles with linearly decreasing opacity
  const rings = Array.from({ length: GRADIENT_RINGS }, (_, i) => {
    const fraction = (i + 1) / GRADIENT_RINGS;
    const ringRadius = radius * fraction;
    // Opacity decreases linearly from MAX_OPACITY at center to 0 at edge
    const opacity = MAX_OPACITY * (1 - fraction);

    return (
      <Circle
        key={`${overlordId}-ring-${i}`}
        center={[center.lat, center.lng]}
        radius={ringRadius}
        pathOptions={{
          color: "#FF4444",
          fillColor: "#FF4444",
          fillOpacity: opacity,
          weight: 0,
          stroke: false,
        }}
        interactive={false}
      />
    );
  });

  return <>{rings}</>;
}
