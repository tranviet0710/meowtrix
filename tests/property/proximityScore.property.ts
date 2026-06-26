/**
 * Property-based tests for proximity score formula.
 *
 * **Validates: Requirements 8.8**
 *
 * Tests that the proximity score calculation correctly:
 * - Returns exactly 100 for any distance ≤ 500m
 * - Returns exactly 0 for any distance > 10,000m
 * - Returns a value strictly between 0 and 100 for distances in (500m, 10,000m)
 * - Is monotonically decreasing (larger distance → lower or equal score)
 * - Never produces negative values or values exceeding 100
 */
import { describe, it } from "vitest";
import * as fc from "fast-check";
import { calculateProximityScore } from "@/lib/geodesic";

describe("Property 9: Proximity score formula", () => {
  it("for any distance ≤ 500m, score is always exactly 100", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 500, noNaN: true }),
        (distance) => {
          return calculateProximityScore(distance) === 100;
        }
      ),
      { numRuns: 500 }
    );
  });

  it("for any distance > 10,000m, score is always exactly 0", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 10_000.01, max: 1_000_000, noNaN: true }),
        (distance) => {
          return calculateProximityScore(distance) === 0;
        }
      ),
      { numRuns: 500 }
    );
  });

  it("for any distance in (500m, 10,000m), score is strictly between 0 and 100", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 500.01, max: 9_999.99, noNaN: true }),
        (distance) => {
          const score = calculateProximityScore(distance);
          return score > 0 && score < 100;
        }
      ),
      { numRuns: 500 }
    );
  });

  it("score is monotonically decreasing (larger distance → lower or equal score)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 50_000, noNaN: true }),
        fc.double({ min: 0, max: 50_000, noNaN: true }),
        (d1, d2) => {
          const [smaller, larger] = d1 <= d2 ? [d1, d2] : [d2, d1];
          const scoreSmaller = calculateProximityScore(smaller);
          const scoreLarger = calculateProximityScore(larger);
          return scoreSmaller >= scoreLarger;
        }
      ),
      { numRuns: 500 }
    );
  });

  it("score is never negative and never exceeds 100", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1_000_000, noNaN: true }),
        (distance) => {
          const score = calculateProximityScore(distance);
          return score >= 0 && score <= 100;
        }
      ),
      { numRuns: 500 }
    );
  });
});
