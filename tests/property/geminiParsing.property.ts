/**
 * Property-based tests for Gemini response parsing logic.
 *
 * **Validates: Requirements 4.2, 4.5**
 *
 * Tests that parseGeminiResponse correctly:
 * 1. Parses valid JSON with all required fields
 * 2. Returns null for JSON missing required fields
 * 3. Returns null for invalid pattern_type values
 * 4. Returns null for invalid fur_length values
 * 5. Never returns more than 5 distinguishing_features
 * 6. Is case-insensitive for pattern_type and fur_length
 * 7. Returns null (never throws) for non-JSON input
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { parseGeminiResponse } from "@/lib/gemini";
import type { PatternType, FurLength } from "@/types";
import { patternTypeArb, furLengthArb } from "@/tests/helpers/arbitraries";

// --- Constants ---

const VALID_PATTERN_TYPES: PatternType[] = [
  "solid", "tabby", "calico", "bicolor", "tortoiseshell", "pointed", "tuxedo",
  "merle", "brindle", "spotted", "sable", "harlequin",
];

const VALID_FUR_LENGTHS: FurLength[] = ["short", "medium", "long"];

// --- Generators ---

/** Generate a non-empty color string (avoids falsy values). */
const colorArb = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0);

/** Generate a valid distinguishing feature string. */
const featureArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

/** Generate a valid Gemini-like JSON object with all required fields. */
const validGeminiObjectArb = fc.record({
  primary_color: colorArb,
  secondary_color: fc.option(colorArb, { nil: null }),
  pattern_type: patternTypeArb,
  fur_length: furLengthArb,
  breed_estimate: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  distinguishing_features: fc.array(featureArb, { minLength: 0, maxLength: 10 }),
});

/** Generate a string that is definitely invalid pattern_type. */
const invalidPatternTypeArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => !VALID_PATTERN_TYPES.includes(s.toLowerCase() as PatternType));

/** Generate a string that is definitely invalid fur_length. */
const invalidFurLengthArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => !VALID_FUR_LENGTHS.includes(s.toLowerCase() as FurLength));

/** Generate non-JSON text that won't accidentally be valid JSON. */
const nonJsonArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 100 }).filter((s) => {
    try { JSON.parse(s); return false; } catch { return true; }
  }),
  fc.constant("not json at all"),
  fc.constant("{broken json"),
  fc.constant("```json\n{invalid```"),
  fc.constant("undefined"),
  fc.constant(""),
);

// --- Tests ---

describe("Property 3: Gemini response parsing", () => {
  it("valid JSON with required fields (primary_color, valid pattern_type, valid fur_length) parses successfully", () => {
    fc.assert(
      fc.property(validGeminiObjectArb, (obj) => {
        const json = JSON.stringify(obj);
        const result = parseGeminiResponse(json);

        // Must successfully parse
        expect(result).not.toBeNull();

        if (result === null) return;

        // Verify required fields are present
        expect(result.primary_color).toBeTruthy();
        expect(VALID_PATTERN_TYPES).toContain(result.pattern_type);
        expect(VALID_FUR_LENGTHS).toContain(result.fur_length);
      }),
      { numRuns: 200 }
    );
  });

  it("JSON missing primary_color OR pattern_type OR fur_length returns null", () => {
    fc.assert(
      fc.property(
        validGeminiObjectArb,
        fc.constantFrom("primary_color", "pattern_type", "fur_length"),
        (obj, fieldToRemove) => {
          // Create a copy with one required field removed
          const incomplete = { ...obj };
          delete (incomplete as Record<string, unknown>)[fieldToRemove];

          const json = JSON.stringify(incomplete);
          const result = parseGeminiResponse(json);

          expect(result).toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  it("JSON with invalid pattern_type values returns null", () => {
    fc.assert(
      fc.property(
        validGeminiObjectArb,
        invalidPatternTypeArb,
        (obj, badPattern) => {
          const modified = { ...obj, pattern_type: badPattern };
          const json = JSON.stringify(modified);
          const result = parseGeminiResponse(json);

          expect(result).toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  it("JSON with invalid fur_length values returns null", () => {
    fc.assert(
      fc.property(
        validGeminiObjectArb,
        invalidFurLengthArb,
        (obj, badFurLength) => {
          const modified = { ...obj, fur_length: badFurLength };
          const json = JSON.stringify(modified);
          const result = parseGeminiResponse(json);

          expect(result).toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  it("parsed result never has more than 5 distinguishing_features", () => {
    fc.assert(
      fc.property(
        fc.record({
          primary_color: colorArb,
          secondary_color: fc.option(colorArb, { nil: null }),
          pattern_type: patternTypeArb,
          fur_length: furLengthArb,
          breed_estimate: fc.string({ minLength: 1, maxLength: 30 }),
          // Generate more than 5 features to test the cap
          distinguishing_features: fc.array(featureArb, { minLength: 6, maxLength: 20 }),
        }),
        (obj) => {
          const json = JSON.stringify(obj);
          const result = parseGeminiResponse(json);

          expect(result).not.toBeNull();

          if (result === null) return;

          expect(result.distinguishing_features.length).toBeLessThanOrEqual(5);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("parsing is case-insensitive for pattern_type and fur_length", () => {
    fc.assert(
      fc.property(
        validGeminiObjectArb,
        fc.constantFrom("upper", "mixed") as fc.Arbitrary<"upper" | "mixed">,
        (obj, caseStyle) => {
          const modified = { ...obj };

          if (caseStyle === "upper") {
            modified.pattern_type = obj.pattern_type.toUpperCase() as PatternType;
            modified.fur_length = obj.fur_length.toUpperCase() as FurLength;
          } else {
            // Mixed case: capitalize first letter
            modified.pattern_type = (
              obj.pattern_type.charAt(0).toUpperCase() + obj.pattern_type.slice(1)
            ) as PatternType;
            modified.fur_length = (
              obj.fur_length.charAt(0).toUpperCase() + obj.fur_length.slice(1)
            ) as FurLength;
          }

          const json = JSON.stringify(modified);
          const result = parseGeminiResponse(json);

          // Should parse successfully despite non-lowercase input
          expect(result).not.toBeNull();

          if (result === null) return;

          // Result should have the normalized lowercase value
          expect(result.pattern_type).toBe(obj.pattern_type.toLowerCase());
          expect(result.fur_length).toBe(obj.fur_length.toLowerCase());
        }
      ),
      { numRuns: 200 }
    );
  });

  it("non-JSON input returns null and never throws", () => {
    fc.assert(
      fc.property(nonJsonArb, (input) => {
        // Should never throw — always returns null for invalid input
        const result = parseGeminiResponse(input);
        expect(result).toBeNull();
      }),
      { numRuns: 200 }
    );
  });
});
