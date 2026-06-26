/**
 * Property-based tests for claim lockout enforcement.
 *
 * **Validates: Requirements 9.5**
 *
 * Tests that the lockout mechanism correctly:
 * 1. failedAttempts < MAX_FAILED_ATTEMPTS → never locked out regardless of locked_until
 * 2. failedAttempts >= MAX_FAILED_ATTEMPTS with future locked_until → locked out
 * 3. failedAttempts >= MAX_FAILED_ATTEMPTS with expired locked_until → NOT locked out (lockout expired)
 * 4. locked_until = null → never locked out regardless of failedAttempts
 * 5. calculateLockoutExpiry always returns a time approximately 24 hours in the future
 */
import { describe, it } from "vitest";
import * as fc from "fast-check";
import {
  isLockedOut,
  MAX_FAILED_ATTEMPTS,
  calculateLockoutExpiry,
  LOCKOUT_DURATION_MS,
} from "@/lib/claimVerification";

describe("Property 14: Claim lockout enforcement", () => {
  it("failedAttempts < MAX_FAILED_ATTEMPTS → never locked out regardless of locked_until", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_FAILED_ATTEMPTS - 1 }),
        fc.oneof(
          fc.constant(null),
          fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 11, 31) }).map(
            (d) => d.toISOString()
          )
        ),
        (failedAttempts, lockedUntil) => {
          return isLockedOut(failedAttempts, lockedUntil) === false;
        }
      ),
      { numRuns: 500 }
    );
  });

  it("failedAttempts >= MAX_FAILED_ATTEMPTS with future locked_until → locked out", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_FAILED_ATTEMPTS, max: 100 }),
        fc.integer({ min: 1, max: 365 * 24 * 60 * 60 * 1000 }).map((offset) =>
          new Date(Date.now() + offset).toISOString()
        ),
        (failedAttempts, futureLockedUntil) => {
          return isLockedOut(failedAttempts, futureLockedUntil) === true;
        }
      ),
      { numRuns: 500 }
    );
  });

  it("failedAttempts >= MAX_FAILED_ATTEMPTS with expired locked_until → NOT locked out", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_FAILED_ATTEMPTS, max: 100 }),
        fc.integer({ min: 1, max: 365 * 24 * 60 * 60 * 1000 }).map((offset) =>
          new Date(Date.now() - offset).toISOString()
        ),
        (failedAttempts, expiredLockedUntil) => {
          return isLockedOut(failedAttempts, expiredLockedUntil) === false;
        }
      ),
      { numRuns: 500 }
    );
  });

  it("locked_until = null → never locked out regardless of failedAttempts", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        (failedAttempts) => {
          return isLockedOut(failedAttempts, null) === false;
        }
      ),
      { numRuns: 500 }
    );
  });

  it("calculateLockoutExpiry always returns a time approximately 24 hours in the future", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const before = Date.now();
        const expiry = calculateLockoutExpiry();
        const after = Date.now();

        const expiryMs = new Date(expiry).getTime();

        // The expiry should be within [before + 24h, after + 24h]
        const lowerBound = before + LOCKOUT_DURATION_MS;
        const upperBound = after + LOCKOUT_DURATION_MS;

        return expiryMs >= lowerBound && expiryMs <= upperBound;
      }),
      { numRuns: 100 }
    );
  });
});
