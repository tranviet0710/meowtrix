/**
 * Property-based tests for points calculation.
 *
 * **Validates: Requirements 10.1**
 *
 * Tests that the points system correctly awards 10 points per verified claim:
 * 1. After N verified claims, total points = N × 10
 * 2. Points are always non-negative
 * 3. Points increase monotonically with verified claims
 */
import { describe, it } from "vitest";
import * as fc from "fast-check";
import {
  calculatePoints,
  POINTS_PER_VERIFIED_CLAIM,
} from "@/lib/pointsCalculation";

describe("Property 16: Points calculation", () => {
  it("after N verified claims, total points = N × 10", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10000 }),
        (verifiedClaims) => {
          const points = calculatePoints(verifiedClaims);
          return points === verifiedClaims * POINTS_PER_VERIFIED_CLAIM;
        }
      ),
      { numRuns: 1000 }
    );
  });

  it("points are always non-negative", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 10000 }),
        (verifiedClaims) => {
          const points = calculatePoints(verifiedClaims);
          return points >= 0;
        }
      ),
      { numRuns: 1000 }
    );
  });

  it("points increase monotonically with verified claims", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 9999 }),
        fc.nat({ max: 10000 }),
        (a, b) => {
          // Ensure a <= b
          const smaller = Math.min(a, b);
          const larger = Math.max(a, b);
          return calculatePoints(smaller) <= calculatePoints(larger);
        }
      ),
      { numRuns: 1000 }
    );
  });
});
