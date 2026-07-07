/**
 * Property-based tests for claim verification exact matching.
 *
 * **Validates: Requirements 9.2**
 *
 * Tests that the verifyAnswer function correctly:
 * 1. Exact matches (≥3 chars, case-insensitive, trimmed) return true
 * 2. Any submitted answer shorter than 3 characters always returns false
 * 3. Verification is case-insensitive
 * 4. Whitespace is normalized (trimmed) before comparison
 * 5. Non-exact matches return false (substring matches are rejected)
 */
import { describe, it } from "vitest";
import * as fc from "fast-check";
import { verifyAnswer } from "@/lib/claimVerification";

describe("Property 12: Claim verification exact matching", () => {
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

          // Verify that upper/lower case variations of the same string all pass
          const resultLower = verifyAnswer(stored, stored.toLowerCase());
          const resultUpper = verifyAnswer(stored, stored.toUpperCase());
          const resultOriginal = verifyAnswer(stored, stored);

          return resultLower === true && resultUpper === true && resultOriginal === true;
        }
      ),
      { numRuns: 500 }
    );
  });

  it("whitespace is normalized (trimmed) before comparison", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 200 }),
        (value) => {
          // Add leading/trailing whitespace to both stored and submitted
          const withWhitespace = `  ${value}  `;
          return verifyAnswer(withWhitespace, value) === true &&
                 verifyAnswer(value, withWhitespace) === true &&
                 verifyAnswer(withWhitespace, withWhitespace) === true;
        }
      ),
      { numRuns: 500 }
    );
  });

  it("substring matches are rejected (not exact match)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 6, maxLength: 200 }),
        (stored) => {
          // Take a proper substring (not the full string)
          const substringLength = Math.floor(stored.length / 2);
          if (substringLength < 3) return true; // skip if can't make valid substring
          
          const substring = stored.slice(0, substringLength);
          if (substring.length < 3) return true; // safety check
          if (substring === stored.trim()) return true; // skip if accidentally equal

          // Substring should NOT pass verification
          return verifyAnswer(stored, substring) === false;
        }
      ),
      { numRuns: 500 }
    );
  });

  it("random non-matching text returns false", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 100 }),
        fc.string({ minLength: 3, maxLength: 100 }),
        (stored, submitted) => {
          // Only assert when submitted is genuinely different from stored (after normalization)
          if (stored.trim().toLowerCase() === submitted.trim().toLowerCase()) {
            return true; // skip — this is an exact match
          }
          return verifyAnswer(stored, submitted) === false;
        }
      ),
      { numRuns: 500 }
    );
  });
});
