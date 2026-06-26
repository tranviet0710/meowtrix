// lib/geodesic.ts — Geodesic distance and proximity scoring utilities

const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Convert degrees to radians.
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the geodesic (great-circle) distance between two points on Earth
 * using the Haversine formula.
 *
 * @param lat1 - Latitude of point 1 in decimal degrees
 * @param lng1 - Longitude of point 1 in decimal degrees
 * @param lat2 - Latitude of point 2 in decimal degrees
 * @param lng2 - Longitude of point 2 in decimal degrees
 * @returns Distance in meters
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculate the proximity score based on distance.
 *
 * Scoring formula (from design doc):
 * - ≤ 500m → 100 (maximum score)
 * - 500m to 10km → linear interpolation from 100 to 0
 * - > 10km → 0
 *
 * @param distanceMeters - Distance in meters between two points
 * @returns Score from 0 to 100
 */
export function calculateProximityScore(distanceMeters: number): number {
  const MIN_DISTANCE = 500;
  const MAX_DISTANCE = 10_000;

  if (distanceMeters <= MIN_DISTANCE) {
    return 100;
  }

  if (distanceMeters > MAX_DISTANCE) {
    return 0;
  }

  // Linear interpolation from 100 (at 500m) to 0 (at 10,000m)
  return 100 * (MAX_DISTANCE - distanceMeters) / (MAX_DISTANCE - MIN_DISTANCE);
}
