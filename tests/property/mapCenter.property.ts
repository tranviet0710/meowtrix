/**
 * Property-based tests for map center fallback logic.
 *
 * **Validates: Requirements 5.7**
 *
 * Tests that the map center determination correctly follows the fallback chain:
 * 1. When center prop is provided, result source is always "prop" and center matches the input
 * 2. When center prop is provided, zoom defaults to 13 if not specified
 * 3. When no center, no geolocation, and residential coords provided → source is "residential"
 * 4. When no center, no geolocation, no residential → fallback to Bangkok (13.7563, 100.5018)
 * 5. Result center is always a valid lat/lng pair (lat in [-90,90], lng in [-180,180])
 * 6. Result zoom is always a positive integer ≥ 1
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import {
  getMapCenter,
  BANGKOK_COORDS,
  DEFAULT_ZOOM,
  FALLBACK_ZOOM,
} from "@/lib/mapCenter";

/**
 * Arbitrary for valid latitude values [-90, 90]
 */
const arbLat = fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true });

/**
 * Arbitrary for valid longitude values [-180, 180]
 */
const arbLng = fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true });

/**
 * Arbitrary for a valid [lat, lng] coordinate pair
 */
const arbCoords = fc.tuple(arbLat, arbLng) as fc.Arbitrary<[number, number]>;

/**
 * Arbitrary for positive zoom levels (integer ≥ 1)
 */
const arbZoom = fc.integer({ min: 1, max: 18 });

/**
 * Mock geolocation as unavailable (simulates no navigator.geolocation)
 */
function mockGeolocationUnavailable() {
  // In Node.js test env, navigator is undefined by default, which makes
  // tryGeolocation resolve to null. No extra mocking needed.
  // But ensure we don't have a global navigator set from previous tests.
  if (typeof globalThis.navigator !== "undefined") {
    vi.stubGlobal("navigator", undefined);
  }
}

/**
 * Mock geolocation as denied (simulates user denying permission)
 */
function mockGeolocationDenied() {
  vi.stubGlobal("navigator", {
    geolocation: {
      getCurrentPosition: (
        _success: PositionCallback,
        error: PositionErrorCallback | null
      ) => {
        if (error) {
          error({
            code: 1, // PERMISSION_DENIED
            message: "User denied Geolocation",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        }
      },
    },
  });
}

beforeEach(() => {
  mockGeolocationUnavailable();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Property 22: Map center fallback logic", () => {
  it("when center prop is provided, source is always 'prop' and center matches input", () => {
    fc.assert(
      fc.asyncProperty(arbCoords, arbZoom, async (coords, zoom) => {
        mockGeolocationUnavailable();
        const result = await getMapCenter(coords, zoom);
        expect(result.source).toBe("prop");
        expect(result.center[0]).toBe(coords[0]);
        expect(result.center[1]).toBe(coords[1]);
      }),
      { numRuns: 200 }
    );
  });

  it("when center prop is provided, zoom defaults to DEFAULT_ZOOM (13) if not specified", () => {
    fc.assert(
      fc.asyncProperty(arbCoords, async (coords) => {
        mockGeolocationUnavailable();
        const result = await getMapCenter(coords, undefined);
        expect(result.zoom).toBe(DEFAULT_ZOOM);
        expect(result.source).toBe("prop");
      }),
      { numRuns: 200 }
    );
  });

  it("when center prop provided with explicit zoom, uses that zoom", () => {
    fc.assert(
      fc.asyncProperty(arbCoords, arbZoom, async (coords, zoom) => {
        mockGeolocationUnavailable();
        const result = await getMapCenter(coords, zoom);
        expect(result.zoom).toBe(zoom);
      }),
      { numRuns: 200 }
    );
  });

  it("when no center, no geolocation, residential coords provided → source is 'residential'", () => {
    fc.assert(
      fc.asyncProperty(arbCoords, async (residentialCoords) => {
        mockGeolocationDenied();
        const result = await getMapCenter(undefined, undefined, {
          residentialCoords,
        });
        expect(result.source).toBe("residential");
        expect(result.center[0]).toBe(residentialCoords[0]);
        expect(result.center[1]).toBe(residentialCoords[1]);
        expect(result.zoom).toBe(DEFAULT_ZOOM);
      }),
      { numRuns: 200 }
    );
  });

  it("when no center, no geolocation, no residential → fallback to Bangkok at zoom 5", () => {
    fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        mockGeolocationDenied();
        const result = await getMapCenter(undefined, undefined, {
          residentialCoords: null,
        });
        expect(result.source).toBe("fallback");
        expect(result.center[0]).toBe(BANGKOK_COORDS[0]);
        expect(result.center[1]).toBe(BANGKOK_COORDS[1]);
        expect(result.zoom).toBe(FALLBACK_ZOOM);
      }),
      { numRuns: 50 }
    );
  });

  it("when no center, no geolocation, no residential (undefined) → fallback to Bangkok", () => {
    fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        mockGeolocationDenied();
        const result = await getMapCenter(undefined, undefined, {});
        expect(result.source).toBe("fallback");
        expect(result.center[0]).toBe(BANGKOK_COORDS[0]);
        expect(result.center[1]).toBe(BANGKOK_COORDS[1]);
        expect(result.zoom).toBe(FALLBACK_ZOOM);
      }),
      { numRuns: 50 }
    );
  });

  it("result center is always a valid lat/lng pair (lat in [-90,90], lng in [-180,180])", () => {
    // Test with various input combinations that all center values remain valid
    fc.assert(
      fc.asyncProperty(
        fc.option(arbCoords, { nil: undefined }),
        fc.option(arbZoom, { nil: undefined }),
        fc.option(arbCoords, { nil: null }),
        async (centerProp, zoomProp, residentialCoords) => {
          mockGeolocationDenied();
          const result = await getMapCenter(centerProp, zoomProp, {
            residentialCoords,
          });
          const [lat, lng] = result.center;
          expect(lat).toBeGreaterThanOrEqual(-90);
          expect(lat).toBeLessThanOrEqual(90);
          expect(lng).toBeGreaterThanOrEqual(-180);
          expect(lng).toBeLessThanOrEqual(180);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("result zoom is always a positive number ≥ 1", () => {
    fc.assert(
      fc.asyncProperty(
        fc.option(arbCoords, { nil: undefined }),
        fc.option(arbZoom, { nil: undefined }),
        fc.option(arbCoords, { nil: null }),
        async (centerProp, zoomProp, residentialCoords) => {
          mockGeolocationDenied();
          const result = await getMapCenter(centerProp, zoomProp, {
            residentialCoords,
          });
          expect(result.zoom).toBeGreaterThanOrEqual(1);
          expect(Number.isFinite(result.zoom)).toBe(true);
        }
      ),
      { numRuns: 300 }
    );
  });
});
