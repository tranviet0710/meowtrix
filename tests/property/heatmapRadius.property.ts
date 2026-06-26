/**
 * Property-based tests for heatmap radius calculation.
 *
 * **Validates: Requirements 6.1, 6.2**
 *
 * Tests that the heatmap radius calculation correctly:
 * 1. Returns null for elapsed ≤ 30 minutes (no display)
 * 2. Returns a value between 200 and 5000 (inclusive) for elapsed > 30 minutes
 * 3. Increases monotonically with elapsed time (within bounds)
 * 4. Matches the exact formula: max(200, min(5000, 250 × hours))
 * 5. Is exactly 200 at minimum and exactly 5000 at maximum
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { calculateHeatmapRadius } from "@/lib/heatmapCalc";

/** Fixed reference time for deterministic testing */
const NOW = new Date("2024-06-15T12:00:00Z");

/**
 * Helper to create a lastSeenAt date given elapsed minutes from the reference NOW.
 */
function lastSeenFromMinutes(elapsedMinutes: number): Date {
  return new Date(NOW.getTime() - elapsedMinutes * 60 * 1000);
}

/**
 * Helper to create a lastSeenAt date given elapsed hours from the reference NOW.
 */
function lastSeenFromHours(elapsedHours: number): Date {
  return new Date(NOW.getTime() - elapsedHours * 60 * 60 * 1000);
}

describe("Property 5: Heatmap radius calculation", () => {
  it("for elapsed ≤ 30 min, result is null (no display)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 30, noNaN: true }),
        (elapsedMinutes) => {
          const lastSeenAt = lastSeenFromMinutes(elapsedMinutes);
          const result = calculateHeatmapRadius(lastSeenAt, NOW);
          return result === null;
        }
      ),
      { numRuns: 500 }
    );
  });

  it("for elapsed > 30 min, result is always between 200 and 5000 (inclusive)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 30.01, max: 100_000, noNaN: true }),
        (elapsedMinutes) => {
          const lastSeenAt = lastSeenFromMinutes(elapsedMinutes);
          const result = calculateHeatmapRadius(lastSeenAt, NOW);
          return result !== null && result >= 200 && result <= 5000;
        }
      ),
      { numRuns: 500 }
    );
  });

  it("radius increases monotonically with elapsed time (within bounds)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 30.01, max: 50_000, noNaN: true }),
        fc.double({ min: 30.01, max: 50_000, noNaN: true }),
        (minutes1, minutes2) => {
          const [smaller, larger] =
            minutes1 <= minutes2 ? [minutes1, minutes2] : [minutes2, minutes1];
          const lastSeenSmaller = lastSeenFromMinutes(smaller);
          const lastSeenLarger = lastSeenFromMinutes(larger);
          const radiusSmaller = calculateHeatmapRadius(lastSeenSmaller, NOW)!;
          const radiusLarger = calculateHeatmapRadius(lastSeenLarger, NOW)!;
          return radiusLarger >= radiusSmaller;
        }
      ),
      { numRuns: 500 }
    );
  });

  it("radius formula: max(200, min(5000, 250 × hours)) — verify exact calculation", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.501, max: 1000, noNaN: true }),
        (elapsedHours) => {
          const lastSeenAt = lastSeenFromHours(elapsedHours);
          const result = calculateHeatmapRadius(lastSeenAt, NOW);
          const expected = Math.max(200, Math.min(5000, 250 * elapsedHours));
          // Use approximate equality due to floating-point arithmetic
          return result !== null && Math.abs(result - expected) < 0.001;
        }
      ),
      { numRuns: 500 }
    );
  });

  it("radius is exactly 200 at minimum and exactly 5000 at maximum", () => {
    // At exactly 0.8 hours (48 minutes), formula gives 250 * 0.8 = 200
    const lastSeenAt48Min = lastSeenFromHours(0.8);
    const radiusAtMin = calculateHeatmapRadius(lastSeenAt48Min, NOW);
    expect(radiusAtMin).toBe(200);

    // At 20 hours, formula gives 250 * 20 = 5000
    const lastSeenAt20H = lastSeenFromHours(20);
    const radiusAtMax = calculateHeatmapRadius(lastSeenAt20H, NOW);
    expect(radiusAtMax).toBe(5000);

    // Property: for elapsed hours ≥ 20, radius is always capped at 5000
    fc.assert(
      fc.property(
        fc.double({ min: 20, max: 10_000, noNaN: true }),
        (hours) => {
          const lastSeen = lastSeenFromHours(hours);
          const result = calculateHeatmapRadius(lastSeen, NOW);
          return result === 5000;
        }
      ),
      { numRuns: 200 }
    );

    // Property: for elapsed hours in (0.5, 0.8], radius is exactly 200 (minimum clamp)
    fc.assert(
      fc.property(
        fc.double({ min: 0.501, max: 0.8, noNaN: true }),
        (hours) => {
          const lastSeen = lastSeenFromHours(hours);
          const result = calculateHeatmapRadius(lastSeen, NOW);
          return result === 200;
        }
      ),
      { numRuns: 200 }
    );
  });
});
