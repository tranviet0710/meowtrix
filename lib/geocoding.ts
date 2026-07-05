// lib/geocoding.ts — Geocoding via OpenStreetMap Nominatim
//
// We use Nominatim's public endpoint for free, key-less geocoding (both
// reverse and forward). Per their usage policy we MUST send a descriptive
// User-Agent and stay under 1 request per second per origin. Calls are
// best-effort: when geocoding fails or times out, callers fall back to raw
// coordinates or an empty result set.
//
// Docs:
//   - https://nominatim.org/release-docs/develop/api/Reverse/
//   - https://nominatim.org/release-docs/develop/api/Search/

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_SEARCH_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const REQUEST_TIMEOUT_MS = 4_000;
// Forward-geocoding has its own budget per Requirement 5.1 ("completing the
// request within 5 seconds"). Kept as a local constant so we don't disturb
// the reverse-geocoding budget above.
const FORWARD_REQUEST_TIMEOUT_MS = 5_000;
const FORWARD_MIN_LENGTH = 1;
const FORWARD_MAX_LENGTH = 500;
const FORWARD_RESULT_LIMIT = 5;

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

/**
 * A single forward-geocoding candidate returned by Nominatim.
 * `importance` is Nominatim's own relevance score (higher = more relevant).
 */
export interface ForwardGeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
  importance: number;
}

interface NominatimSearchResponseItem {
  lat?: string;
  lon?: string;
  display_name?: string;
  importance?: number;
}

/**
 * Forward-geocode a free-form address string into a list of candidate
 * coordinates, sorted by Nominatim `importance` descending.
 *
 * Behaviour:
 *   - Returns `[]` when the trimmed input is outside `[1, 500]` chars.
 *   - Returns `[]` on any network / HTTP / timeout / parse error (silent).
 *   - Never throws — failure is silent, matching `reverseGeocode`.
 *   - Uses the shared `USER_AGENT` and a 5-second `AbortController` timeout.
 */
export async function forwardGeocode(
  addressText: string,
  locale: string = "en"
): Promise<ForwardGeocodeResult[]> {
  const trimmed = addressText.trim();
  if (trimmed.length < FORWARD_MIN_LENGTH || trimmed.length > FORWARD_MAX_LENGTH) {
    return [];
  }

  const url = new URL(NOMINATIM_SEARCH_ENDPOINT);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("limit", String(FORWARD_RESULT_LIMIT));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", locale);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FORWARD_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) return [];

    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) return [];

    const results: ForwardGeocodeResult[] = [];
    for (const raw of payload as NominatimSearchResponseItem[]) {
      const lat = raw?.lat != null ? Number(raw.lat) : NaN;
      const lng = raw?.lon != null ? Number(raw.lon) : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
      const importance = typeof raw?.importance === "number" ? raw.importance : 0;
      const displayName = typeof raw?.display_name === "string" ? raw.display_name : "";
      results.push({ lat, lng, display_name: displayName, importance });
    }

    results.sort((a, b) => b.importance - a.importance);
    return results;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return [];
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[geocoding] forwardGeocode failed for "${trimmed}": ${message}`);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}
