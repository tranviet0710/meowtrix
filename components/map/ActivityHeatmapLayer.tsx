"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

/**
 * A single point on the activity heatmap. `weight` biases how strongly this
 * point contributes to a hot spot (defaults to 1). Missing pets are weighted
 * heavier than sightings so they draw attention on the map.
 */
export interface ActivityHeatPoint {
  lat: number;
  lng: number;
  weight?: number;
}

interface ActivityHeatmapLayerProps {
  points: ActivityHeatPoint[];
  /** Radius of each heat point in pixels. Larger = broader hot spots. */
  radius?: number;
  /** Blur amount in pixels. Larger = smoother gradient. */
  blur?: number;
  /**
   * Zoom level at which every point reaches maximum intensity. Below this
   * zoom the heat map appears softer.
   */
  maxZoom?: number;
  /** Peak intensity value. Points with weight equal to `max` render at full color. */
  max?: number;
}

/**
 * Default radius/blur values tuned for a city-scale view (zoom 11–14).
 * Feels warm rather than opaque, matching the app's soft design language.
 */
const DEFAULT_RADIUS = 28;
const DEFAULT_BLUR = 22;
const DEFAULT_MAX_ZOOM = 15;
const DEFAULT_MAX = 3;

/**
 * Warm coral-to-amber gradient. Anchored at the app's primary brand color so
 * "hot" areas feel on-brand rather than clinical.
 * Values are ratios (0.0–1.0) mapping to CSS colors.
 */
const HEAT_GRADIENT: Record<number, string> = {
  0.2: "rgba(255, 184, 101, 0.55)", // amber, low activity
  0.45: "rgba(255, 139, 112, 0.75)", // coral, medium
  0.7: "#FF7D7D", // warm coral-red, high
  1.0: "#EF4444", // danger red, peak
};

/**
 * ActivityHeatmapLayer — Renders a density heatmap of report locations using
 * the `leaflet.heat` plugin.
 *
 * Unlike HeatmapOverlay (which shows a predictive probability zone for a
 * single missing pet), this layer aggregates ALL points passed in and highlights
 * where reports cluster geographically. Use it to answer "which areas are
 * currently seeing the most activity".
 *
 * Must be rendered inside a MapContainer. The parent map is picked up via
 * `useMap()` from react-leaflet.
 *
 * Must be dynamically imported with `next/dynamic` + `ssr: false` in the
 * consuming page tree, since Leaflet touches `window` at module scope.
 */
export function ActivityHeatmapLayer({
  points,
  radius = DEFAULT_RADIUS,
  blur = DEFAULT_BLUR,
  maxZoom = DEFAULT_MAX_ZOOM,
  max = DEFAULT_MAX,
}: ActivityHeatmapLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;

    // Convert points to the [lat, lng, intensity] tuples leaflet.heat expects.
    const heatPoints: L.HeatLatLngTuple[] = points.map((p) => [
      p.lat,
      p.lng,
      p.weight ?? 1,
    ]);

    const layer = L.heatLayer(heatPoints, {
      radius,
      blur,
      maxZoom,
      max,
      gradient: HEAT_GRADIENT,
      // Draw beneath markers so pins remain clickable.
      minOpacity: 0.35,
    });

    layer.addTo(map);

    return () => {
      map.removeLayer(layer);
    };
  }, [map, points, radius, blur, maxZoom, max]);

  return null;
}
