// tests/unit/geocoding.test.ts — Unit tests for the Nominatim geocoding helpers.
//
// Focused on `forwardGeocode`, added in task 3 of the "create-report-with-ai"
// spec. `reverseGeocode` already ships with its own coverage elsewhere;
// this file only exercises the new forward-geocoding surface (Requirement 5.1)
// per task 8 of the plan.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { forwardGeocode } from "@/lib/geocoding";

describe("forwardGeocode — input guards (Requirement 5.1)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns [] for an empty string without hitting the network", async () => {
    const results = await forwardGeocode("");
    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns [] for a whitespace-only string without hitting the network", async () => {
    const results = await forwardGeocode("   \n\t  ");
    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns [] when trimmed input exceeds 500 characters", async () => {
    const tooLong = "x".repeat(501);
    const results = await forwardGeocode(tooLong);
    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("issues a Nominatim search request for a valid address", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [],
    } as unknown as Response);

    await forwardGeocode("123 Main St");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [urlArg] = fetchMock.mock.calls[0];
    const url = new URL(urlArg as string);
    expect(url.hostname).toBe("nominatim.openstreetmap.org");
    expect(url.pathname).toBe("/search");
    expect(url.searchParams.get("q")).toBe("123 Main St");
    expect(url.searchParams.get("format")).toBe("jsonv2");
    expect(url.searchParams.get("limit")).toBe("5");
  });

  it("trims whitespace off the input before sending it to Nominatim", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [],
    } as unknown as Response);

    await forwardGeocode("   Hà Nội   ");

    const [urlArg] = fetchMock.mock.calls[0];
    const url = new URL(urlArg as string);
    expect(url.searchParams.get("q")).toBe("Hà Nội");
  });
});

describe("forwardGeocode — result ordering", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sorts results by importance descending", async () => {
    const payload = [
      { lat: "10.0", lon: "20.0", display_name: "Low", importance: 0.2 },
      { lat: "11.0", lon: "21.0", display_name: "High", importance: 0.9 },
      { lat: "12.0", lon: "22.0", display_name: "Mid", importance: 0.5 },
    ];
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => payload,
    } as unknown as Response);

    const results = await forwardGeocode("anywhere");

    expect(results.map((r) => r.display_name)).toEqual(["High", "Mid", "Low"]);
    expect(results[0].importance).toBe(0.9);
    expect(results[2].importance).toBe(0.2);
  });

  it("treats missing importance as zero when sorting", async () => {
    const payload = [
      { lat: "10.0", lon: "20.0", display_name: "NoImportance" }, // -> 0
      { lat: "11.0", lon: "21.0", display_name: "Important", importance: 0.7 },
    ];
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => payload,
    } as unknown as Response);

    const results = await forwardGeocode("anywhere");
    expect(results[0].display_name).toBe("Important");
    expect(results[1].display_name).toBe("NoImportance");
    expect(results[1].importance).toBe(0);
  });

  it("filters out entries with unparseable coordinates", async () => {
    const payload = [
      { lat: "not-a-number", lon: "20.0", display_name: "Broken", importance: 0.9 },
      { lat: "10.0", lon: "20.0", display_name: "Good", importance: 0.4 },
    ];
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => payload,
    } as unknown as Response);

    const results = await forwardGeocode("anywhere");
    expect(results).toHaveLength(1);
    expect(results[0].display_name).toBe("Good");
  });

  it("filters out coordinates outside the valid lat/lng ranges", async () => {
    const payload = [
      { lat: "91", lon: "20.0", display_name: "TooNorth", importance: 0.9 },
      { lat: "10.0", lon: "181", display_name: "TooEast", importance: 0.8 },
      { lat: "10.0", lon: "20.0", display_name: "OK", importance: 0.1 },
    ];
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => payload,
    } as unknown as Response);

    const results = await forwardGeocode("anywhere");
    expect(results).toHaveLength(1);
    expect(results[0].display_name).toBe("OK");
  });
});

describe("forwardGeocode — silent failure modes", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    // Silence expected console.warn during error-path tests.
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns [] when fetch rejects with a network error", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const results = await forwardGeocode("anywhere");
    expect(results).toEqual([]);
  });

  it("returns [] on a non-2xx response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => [],
    } as unknown as Response);
    const results = await forwardGeocode("anywhere");
    expect(results).toEqual([]);
  });

  it("returns [] when the response body is not an array", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ error: "unexpected" }),
    } as unknown as Response);
    const results = await forwardGeocode("anywhere");
    expect(results).toEqual([]);
  });

  it("returns [] when the request aborts (timeout)", async () => {
    fetchMock.mockRejectedValue(
      new DOMException("The user aborted a request.", "AbortError")
    );
    const results = await forwardGeocode("anywhere");
    expect(results).toEqual([]);
  });

  it("returns [] when the response body cannot be parsed as JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    } as unknown as Response);
    const results = await forwardGeocode("anywhere");
    expect(results).toEqual([]);
  });
});
