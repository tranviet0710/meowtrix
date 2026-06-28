// lib/geocoding.ts — Reverse-geocoding via OpenStreetMap Nominatim
//
// We use Nominatim's public endpoint for free, key-less reverse geocoding.
// Per their usage policy we MUST send a descriptive User-Agent and stay under
// 1 request per second per origin. Calls are best-effort: when geocoding fails
// or times out, callers fall back to raw coordinates.
//
// Docs: https://nominatim.org/release-docs/develop/api/Reverse/

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const REQUEST_TIMEOUT_MS = 4_000;

// Use a stable identifier so OSM can contact us if abuse is detected.
// Override via env if deploying under a different domain.
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ??
  "Meowtrix/1.0 (https://meowtrix.vercel.app; contact: hello@meowtrix.io)";

interface NominatimReverseResponse {
  display_name?: string;
  address?: {
    suburb?: string;
    neighbourhood?: string;
    quarter?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    region?: string;
    country?: string;
  };
}

/**
 * Build a short, human-readable label from a Nominatim address object.
 * Prefers neighborhood + city; falls back to display_name; falls back to null.
 *
 * Example outputs:
 *   "Silom, Bangkok, Thailand"
 *   "Chatuchak, Bangkok, Thailand"
 *   "Eastside, Seattle, United States"
 */
function buildLabel(payload: NominatimReverseResponse): string | null {
  const a = payload.address ?? {};

  const local =
    a.suburb ??
    a.neighbourhood ??
    a.quarter ??
    a.city_district ??
    null;
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? null;
  const region = a.state ?? a.region ?? null;
  const country = a.country ?? null;

  const parts: string[] = [];
  if (local && local !== city) parts.push(local);
  if (city) parts.push(city);
  if (!city && region) parts.push(region);
  if (country) parts.push(country);

  if (parts.length > 0) return parts.join(", ");
  if (payload.display_name) {
    // Trim long display_names to the first 3 components for sanity.
    return payload.display_name.split(",").slice(0, 3).join(",").trim();
  }
  return null;
}

/**
 * Reverse-geocode lat/lng into a human-readable place label.
 * Returns null when the network call fails, times out, or the result is empty.
 * This function never throws — failure is silent and callers must handle null.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  locale: string = "en"
): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", lat.toFixed(6));
  url.searchParams.set("lon", lng.toFixed(6));
  url.searchParams.set("zoom", "14");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", locale);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as NominatimReverseResponse;
    return buildLabel(payload);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[geocoding] reverseGeocode failed for ${lat},${lng}: ${message}`);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Format raw coordinates as a fallback label when no address text is available.
 */
export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
