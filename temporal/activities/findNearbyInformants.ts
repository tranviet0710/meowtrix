// temporal/activities/findNearbyInformants.ts — Proximity query for eligible informants
// Requirements: 7.2, 7.4, 7.8, 7.10

import { createClient } from '@supabase/supabase-js';
import type { NearbyInformant } from './types';

const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Convert degrees to radians.
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the haversine distance between two geographic points.
 *
 * @param lat1 - Latitude of point 1 (degrees)
 * @param lng1 - Longitude of point 1 (degrees)
 * @param lat2 - Latitude of point 2 (degrees)
 * @param lng2 - Longitude of point 2 (degrees)
 * @returns Distance in meters
 */
function haversineDistance(
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
 * Creates a Supabase client for use in Temporal activities.
 * Uses the service role key to bypass RLS since activities run
 * outside the Next.js request context.
 */
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
    );
  }

  return createClient(url, key);
}

/**
 * Find all informants within a given radius of a geographic point.
 * Filters by location_consent=true and non-null coordinates.
 * Excludes the Overlord owner (they don't need to be notified about their own cat).
 *
 * Uses haversine distance calculation to determine proximity.
 *
 * @param lat - Center latitude (Overlord last-seen location)
 * @param lng - Center longitude (Overlord last-seen location)
 * @param radiusMeters - Search radius in meters
 * @param excludeIds - Array of informant IDs to exclude (e.g., already notified, or the owner)
 * @returns Array of nearby informants sorted by distance ascending
 */
export async function findNearbyInformants(
  lat: number,
  lng: number,
  radiusMeters: number,
  excludeIds: string[] = []
): Promise<NearbyInformant[]> {
  const supabase = getSupabaseClient();

  // Query all informants with location consent who have coordinates
  const { data: informants, error } = await supabase
    .from('informants')
    .select('id, display_name, residential_lat, residential_lng')
    .eq('location_consent', true)
    .not('residential_lat', 'is', null)
    .not('residential_lng', 'is', null);

  if (error) {
    throw new Error(`Failed to query informants: ${error.message}`);
  }

  if (!informants || informants.length === 0) {
    return [];
  }

  // Filter by distance using haversine and exclude specified IDs
  const excludeSet = new Set(excludeIds);

  const nearbyInformants: NearbyInformant[] = informants
    .filter((informant) => !excludeSet.has(informant.id))
    .map((informant) => {
      const distance = haversineDistance(
        lat,
        lng,
        informant.residential_lat!,
        informant.residential_lng!
      );
      return {
        id: informant.id,
        display_name: informant.display_name,
        residential_lat: informant.residential_lat!,
        residential_lng: informant.residential_lng!,
        distance_meters: distance,
      };
    })
    .filter((informant) => informant.distance_meters <= radiusMeters)
    .sort((a, b) => a.distance_meters - b.distance_meters);

  return nearbyInformants;
}
