// lib/heatmapCalc.ts — Heatmap radius calculation and re-centering utilities

import { haversineDistance } from '@/lib/geodesic';

/**
 * Represents a geographic coordinate with latitude and longitude.
 */
export interface Coordinate {
  lat: number;
  lng: number;
}

/**
 * Represents an Agent sighting with location and timestamp (Date variant).
 */
export interface AgentSighting {
  lat: number;
  lng: number;
  sightedAt: Date;
}

/**
 * Represents an Agent sighting with location and timestamp (string variant from DB).
 */
export interface AgentSightingRaw {
  lat: number;
  lng: number;
  sighted_at: string;
}

/**
 * Calculate the heatmap probability zone radius for an Overlord based on
 * elapsed time since last seen.
 *
 * Formula: radius = max(200, min(5000, 250 × elapsed_hours))
 * Returns null if elapsed time is 30 minutes or less (no heatmap displayed).
 *
 * @param lastSeenAt - The timestamp when the Overlord was last seen
 * @param now - The current time as Date or epoch ms (defaults to Date.now() for testability)
 * @returns Radius in meters, or null if elapsed ≤ 30 minutes
 */
export function calculateHeatmapRadius(lastSeenAt: Date, now?: Date | number): number | null {
  const currentTimeMs = now instanceof Date
    ? now.getTime()
    : typeof now === 'number'
      ? now
      : Date.now();
  const elapsedMs = currentTimeMs - lastSeenAt.getTime();
  const elapsedMinutes = elapsedMs / (1000 * 60);

  // Only display heatmap when more than 30 minutes have elapsed
  if (elapsedMinutes <= 30) {
    return null;
  }

  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const radius = 250 * elapsedHours;

  return Math.max(200, Math.min(5000, radius));
}

/**
 * Determine the center point for the heatmap overlay.
 *
 * Re-centering logic:
 * - If any Agent sighting falls within the current probability zone radius,
 *   re-center on the most recent Agent sighting that is within the zone.
 * - If no Agent sightings exist within the zone, keep the original Overlord
 *   last-seen location as the center.
 *
 * Supports two calling conventions:
 * 1. getHeatmapCenter(overlordLat, overlordLng, agentSightings, radiusMeters)
 * 2. getHeatmapCenter(overlordLocation, agentSightings, radiusMeters)
 */
export function getHeatmapCenter(
  overlordLat: number,
  overlordLng: number,
  agentSightings: Array<{ lat: number; lng: number; sighted_at: string }>,
  radiusMeters: number
): { lat: number; lng: number };
export function getHeatmapCenter(
  overlordLocation: Coordinate,
  agentSightings: AgentSighting[],
  radiusMeters: number
): Coordinate;
export function getHeatmapCenter(
  overlordLatOrLocation: number | Coordinate,
  overlordLngOrSightings: number | AgentSighting[],
  agentSightingsOrRadius: Array<{ lat: number; lng: number; sighted_at: string }> | number,
  radiusMetersOpt?: number
): { lat: number; lng: number } {
  let overlordLat: number;
  let overlordLng: number;
  let radiusMeters: number;
  let sightings: Array<{ lat: number; lng: number; time: number }>;

  if (typeof overlordLatOrLocation === 'number') {
    // Overload 1: flat args with string timestamps
    overlordLat = overlordLatOrLocation;
    overlordLng = overlordLngOrSightings as number;
    const rawSightings = agentSightingsOrRadius as Array<{ lat: number; lng: number; sighted_at: string }>;
    radiusMeters = radiusMetersOpt!;
    sightings = rawSightings.map((s) => ({
      lat: s.lat,
      lng: s.lng,
      time: new Date(s.sighted_at).getTime(),
    }));
  } else {
    // Overload 2: Coordinate + AgentSighting[] with Date objects
    overlordLat = overlordLatOrLocation.lat;
    overlordLng = overlordLatOrLocation.lng;
    const agentSightingsArr = overlordLngOrSightings as AgentSighting[];
    radiusMeters = agentSightingsOrRadius as number;
    sightings = agentSightingsArr.map((s) => ({
      lat: s.lat,
      lng: s.lng,
      time: s.sightedAt.getTime(),
    }));
  }

  // Filter sightings that fall within the current probability zone
  const sightingsWithinZone = sightings.filter((sighting) => {
    const distance = haversineDistance(
      overlordLat,
      overlordLng,
      sighting.lat,
      sighting.lng
    );
    return distance <= radiusMeters;
  });

  // If no sightings within zone, keep original center
  if (sightingsWithinZone.length === 0) {
    return { lat: overlordLat, lng: overlordLng };
  }

  // Re-center on the most recent Agent sighting within the zone
  const mostRecent = sightingsWithinZone.reduce((latest, current) => {
    return current.time > latest.time ? current : latest;
  });

  return { lat: mostRecent.lat, lng: mostRecent.lng };
}
