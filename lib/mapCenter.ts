// lib/mapCenter.ts — Map center fallback logic (separated for testability)

/** Bangkok coordinates as the last-resort fallback */
export const BANGKOK_COORDS: [number, number] = [13.7563, 100.5018];

/** Default zoom when user's position or residential coords are known */
export const DEFAULT_ZOOM = 13;

/** Zoom level when falling back to Bangkok (wider area view) */
export const FALLBACK_ZOOM = 5;

/** Geolocation timeout in milliseconds */
export const GEOLOCATION_TIMEOUT_MS = 10_000;

export interface MapCenterResult {
  center: [number, number];
  zoom: number;
  source: "prop" | "geolocation" | "residential" | "fallback";
}

export interface GeolocationOptions {
  residentialCoords?: [number, number] | null;
}

/**
 * Determines the map center and zoom level using the fallback chain:
 * 1. If `center` prop provided → use it
 * 2. Try browser geolocation (10-second timeout)
 * 3. If geolocation denied or times out → use stored residential area coordinates
 * 4. If no residential coords → fallback to Bangkok (13.7563, 100.5018) at zoom 5
 *
 * Exported for testability.
 */
export async function getMapCenter(
  centerProp: [number, number] | undefined,
  zoomProp: number | undefined,
  options: GeolocationOptions = {}
): Promise<MapCenterResult> {
  // Step 1: If center prop is provided, use it directly
  if (centerProp) {
    return {
      center: centerProp,
      zoom: zoomProp ?? DEFAULT_ZOOM,
      source: "prop",
    };
  }

  // Step 2: Try browser geolocation
  const geoResult = await tryGeolocation();
  if (geoResult) {
    return {
      center: geoResult,
      zoom: zoomProp ?? DEFAULT_ZOOM,
      source: "geolocation",
    };
  }

  // Step 3: Use residential coords if available
  if (options.residentialCoords) {
    return {
      center: options.residentialCoords,
      zoom: zoomProp ?? DEFAULT_ZOOM,
      source: "residential",
    };
  }

  // Step 4: Fallback to Bangkok
  return {
    center: BANGKOK_COORDS,
    zoom: zoomProp ?? FALLBACK_ZOOM,
    source: "fallback",
  };
}

/**
 * Attempts to get the user's current position via the Geolocation API.
 * Returns [lat, lng] on success, or null on failure/timeout/denial.
 */
export function tryGeolocation(): Promise<[number, number] | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      resolve(null);
    }, GEOLOCATION_TIMEOUT_MS);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        resolve([position.coords.latitude, position.coords.longitude]);
      },
      () => {
        clearTimeout(timeoutId);
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: 60_000,
      }
    );
  });
}
