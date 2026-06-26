import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getMapCenter } from "@/lib/mapCenter";

describe("getMapCenter", () => {
  beforeEach(() => {
    // Mock navigator.geolocation
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns center prop when provided", async () => {
    const result = await getMapCenter([10, 20], 15);

    expect(result).toEqual({
      center: [10, 20],
      zoom: 15,
      source: "prop",
    });
  });

  it("uses default zoom 13 when center prop provided but no zoom", async () => {
    const result = await getMapCenter([10, 20], undefined);

    expect(result).toEqual({
      center: [10, 20],
      zoom: 13,
      source: "prop",
    });
  });

  it("uses geolocation when no center prop and geolocation succeeds", async () => {
    const mockGetCurrentPosition = vi.fn(
      (success: PositionCallback) => {
        success({
          coords: { latitude: 40.7128, longitude: -74.006 },
        } as GeolocationPosition);
      }
    );

    vi.stubGlobal("navigator", {
      geolocation: { getCurrentPosition: mockGetCurrentPosition },
    });

    const result = await getMapCenter(undefined, undefined);

    expect(result).toEqual({
      center: [40.7128, -74.006],
      zoom: 13,
      source: "geolocation",
    });
  });

  it("falls back to residential coords when geolocation is denied", async () => {
    const mockGetCurrentPosition = vi.fn(
      (_success: PositionCallback, error?: PositionErrorCallback | null) => {
        if (error) {
          error({
            code: 1,
            message: "User denied",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          });
        }
      }
    );

    vi.stubGlobal("navigator", {
      geolocation: { getCurrentPosition: mockGetCurrentPosition },
    });

    const result = await getMapCenter(undefined, undefined, {
      residentialCoords: [35.6762, 139.6503],
    });

    expect(result).toEqual({
      center: [35.6762, 139.6503],
      zoom: 13,
      source: "residential",
    });
  });

  it("falls back to Bangkok when geolocation fails and no residential coords", async () => {
    const mockGetCurrentPosition = vi.fn(
      (_success: PositionCallback, error?: PositionErrorCallback | null) => {
        if (error) {
          error({
            code: 1,
            message: "User denied",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          });
        }
      }
    );

    vi.stubGlobal("navigator", {
      geolocation: { getCurrentPosition: mockGetCurrentPosition },
    });

    const result = await getMapCenter(undefined, undefined);

    expect(result).toEqual({
      center: [13.7563, 100.5018],
      zoom: 5,
      source: "fallback",
    });
  });

  it("falls back to Bangkok when geolocation times out and no residential coords", async () => {
    vi.useFakeTimers();

    // Simulate geolocation that never responds (timeout)
    const mockGetCurrentPosition = vi.fn(() => {
      // Does nothing - simulates hanging
    });

    vi.stubGlobal("navigator", {
      geolocation: { getCurrentPosition: mockGetCurrentPosition },
    });

    const promise = getMapCenter(undefined, undefined);

    // Advance past the 10-second geolocation timeout
    vi.advanceTimersByTime(10_001);

    const result = await promise;

    expect(result).toEqual({
      center: [13.7563, 100.5018],
      zoom: 5,
      source: "fallback",
    });

    vi.useRealTimers();
  });

  it("falls back when navigator.geolocation is not available", async () => {
    vi.stubGlobal("navigator", {});

    const result = await getMapCenter(undefined, undefined, {
      residentialCoords: [48.8566, 2.3522],
    });

    expect(result).toEqual({
      center: [48.8566, 2.3522],
      zoom: 13,
      source: "residential",
    });
  });

  it("respects custom zoom when using geolocation fallback", async () => {
    const mockGetCurrentPosition = vi.fn(
      (success: PositionCallback) => {
        success({
          coords: { latitude: 51.5074, longitude: -0.1278 },
        } as GeolocationPosition);
      }
    );

    vi.stubGlobal("navigator", {
      geolocation: { getCurrentPosition: mockGetCurrentPosition },
    });

    const result = await getMapCenter(undefined, 10);

    expect(result).toEqual({
      center: [51.5074, -0.1278],
      zoom: 10,
      source: "geolocation",
    });
  });

  it("respects custom zoom when falling back to Bangkok", async () => {
    const mockGetCurrentPosition = vi.fn(
      (_success: PositionCallback, error?: PositionErrorCallback | null) => {
        if (error) {
          error({
            code: 1,
            message: "User denied",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          });
        }
      }
    );

    vi.stubGlobal("navigator", {
      geolocation: { getCurrentPosition: mockGetCurrentPosition },
    });

    const result = await getMapCenter(undefined, 8);

    expect(result).toEqual({
      center: [13.7563, 100.5018],
      zoom: 8,
      source: "fallback",
    });
  });
});
