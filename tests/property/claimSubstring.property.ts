/**
 * Property-based tests for claim verification substring matching.
 *
 * **Validates: Requirements 9.2**
 *
 * Tests that the verifyAnswer function correctly:
 * 1. Any submitted answer that is a substring (≥3 chars) of the stored value returns true
 * 2. Any submitted answer shorter than 3 characters always returns false
 * 3. Verification is case-insensitive
 * 4. Exact match (≥3 chars) always passes
 * 5. Random text not contained in stored returns false
 */
import { describe, it } from "vitest";
import * as fc from "fast-check";
import { verifyAnswer } from "@/lib/claimVerification";

describe("Property 12: Claim verification substring matching", () => {
  it("any submitted answer that is a substring (≥3 chars) of the stored value returns true", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 200 }),
        fc.nat({ max: 50 }),
        fc.nat({ max: 50 }),
        (stored, prefixLen, suffixLen) => {
          // Ensure stored is at least 3 chars
          if (stored.length < 3) return true; // skip trivial cases

          // Pick a valid substring of at least 3 chars
          const maxStart = Math.max(0, stored.length - 3);
          const start = prefixLen % (maxStart + 1);
          const minEnd = start + 3;
          const maxEnd = stored.length;
          if (minEnd > maxEnd) return true; // skip if can't get 3 chars
          const end = minEnd + (suffixLen % (maxEnd - minEnd + 1));
          const substring = stored.slice(start, end);

          if (substring.length < 3) return true; // safety check

          return verifyAnswer(stored, substring) === true;
        }
      ),
      { numRuns: 500 }
    );
  });

  it("any submitted answer shorter than 3 characters always returns false", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 0, maxLength: 2 }),
        (stored, submitted) => {
          return verifyAnswer(stored, submitted) === false;
        }
      ),
      { numRuns: 500 }
    );
  });

  it("verification is case-insensitive", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 200 }),
        (stored) => {
          if (stored.length < 3) return true;

          // Take a substring of at least 3 chars
          const substring = stored.slice(0, Math.max(3, stored.length));

          // Verify that upper/lower case variations produce same result
          const resultLower = verifyAnswer(stored, substring.toLowerCase());
          const resultUpper = verifyAnswer(stored, substring.toUpperCase());
          const resultOriginal = verifyAnswer(stored, substring);

          return resultLower === resultUpper && resultUpper === resultOriginal;
        }
      ),
      { numRuns: 500 }
    );
  });

  it("exact match (≥3 chars) always passes", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 200 }),
        (value) => {
          return verifyAnswer(value, value) === true;
        }
      ),
      { numRuns: 500 }
    );
  });

  it("random text not contained in stored returns false", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 100 }),
        fc.string({ minLength: 3, maxLength: 100 }),
        (stored, submitted) => {
          // Only assert when submitted is genuinely not a substring of stored
          if (stored.toLowerCase().includes(submitted.toLowerCase())) {
            return true; // skip — this case is covered by property 1
          }
          return verifyAnswer(stored, submitted) === false;
        }
      ),
      { numRuns: 500 }
    );
  });
});
