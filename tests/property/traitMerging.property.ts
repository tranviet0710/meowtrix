/**
 * Property-based tests for trait tag merging logic.
 *
 * **Validates: Requirements 4.3, 4.7**
 *
 * Tests that multi-photo trait tag merging correctly:
 * - Selects the most frequent value for single-value fields (unanimity)
 * - Limits distinguishing_features to max 5 items
 * - Returns unchanged value for single-element arrays
 * - Produces valid enum values for pattern_type and fur_length
 * - Breaks ties by selecting the most recent photo's value
 * - Considers all unique distinguishing_features from inputs
 */
import { describe, it } from "vitest";
import * as fc from "fast-check";
import { mergeTraitTags } from "@/lib/traitMerger";
import type { TraitTags, PatternType, FurLength } from "@/types";
import { patternTypeArb, furLengthArb } from "@/tests/helpers/arbitraries";

// --- Generators ---

const VALID_PATTERN_TYPES: PatternType[] = [
  "solid", "tabby", "calico", "bicolor", "tortoiseshell", "pointed", "tuxedo",
];

const VALID_FUR_LENGTHS: FurLength[] = ["short", "medium", "long"];

const traitTagsArb: fc.Arbitrary<TraitTags> = fc.record({
  primary_color: fc.string({ minLength: 1, maxLength: 20 }),
  secondary_color: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  pattern_type: patternTypeArb,
  fur_length: furLengthArb,
  breed_estimate: fc.string({ minLength: 1, maxLength: 30 }),
  distinguishing_features: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
});

describe("Property 4: Trait tag merging", () => {
  it("unanimity: when all tags agree on a single-value field, the merged result has that value", () => {
    fc.assert(
      fc.property(
        traitTagsArb,
        fc.integer({ min: 2, max: 10 }),
        (baseTags, count) => {
          // Create an array where all tags have the same single-value fields
          const tagsArray: TraitTags[] = Array.from({ length: count }, () => ({
            ...baseTags,
            // Keep different distinguishing_features to make it interesting
            distinguishing_features: [...baseTags.distinguishing_features],
          }));

          const merged = mergeTraitTags(tagsArray);

          // Must not be null for non-empty input
          if (merged === null) return false;

          // All single-value fields should match the unanimous value
          return (
            merged.primary_color === baseTags.primary_color &&
            merged.pattern_type === baseTags.pattern_type &&
            merged.fur_length === baseTags.fur_length &&
            merged.breed_estimate === baseTags.breed_estimate
          );
        }
      ),
      { numRuns: 200 }
    );
  });

  it("distinguishing_features never exceeds 5 items in the merged result", () => {
    fc.assert(
      fc.property(
        fc.array(traitTagsArb, { minLength: 1, maxLength: 10 }),
        (tagsArray) => {
          const merged = mergeTraitTags(tagsArray);

          if (merged === null) return false;

          return merged.distinguishing_features.length <= 5;
        }
      ),
      { numRuns: 200 }
    );
  });

  it("single-element array returns the same value unchanged", () => {
    fc.assert(
      fc.property(
        traitTagsArb,
        (tags) => {
          const merged = mergeTraitTags([tags]);

          if (merged === null) return false;

          return (
            merged.primary_color === tags.primary_color &&
            merged.secondary_color === tags.secondary_color &&
            merged.pattern_type === tags.pattern_type &&
            merged.fur_length === tags.fur_length &&
            merged.breed_estimate === tags.breed_estimate &&
            merged.distinguishing_features.length === tags.distinguishing_features.length &&
            merged.distinguishing_features.every((f, i) => f === tags.distinguishing_features[i])
          );
        }
      ),
      { numRuns: 200 }
    );
  });

  it("merged result always has valid pattern_type and fur_length enum values", () => {
    fc.assert(
      fc.property(
        fc.array(traitTagsArb, { minLength: 1, maxLength: 10 }),
        (tagsArray) => {
          const merged = mergeTraitTags(tagsArray);

          if (merged === null) return false;

          return (
            VALID_PATTERN_TYPES.includes(merged.pattern_type) &&
            VALID_FUR_LENGTHS.includes(merged.fur_length)
          );
        }
      ),
      { numRuns: 200 }
    );
  });

  it("tie-breaking: when two values tie in frequency, the last (most recent) photo's value wins", () => {
    fc.assert(
      fc.property(
        patternTypeArb,
        patternTypeArb,
        traitTagsArb,
        (patternA, patternB, baseTags) => {
          // Skip if patternA === patternB (no tie to break)
          if (patternA === patternB) return true;

          // Create a tie: [patternA, patternB] — each appears once, patternB is last
          const tagsArray: TraitTags[] = [
            { ...baseTags, pattern_type: patternA },
            { ...baseTags, pattern_type: patternB },
          ];

          const merged = mergeTraitTags(tagsArray);

          if (merged === null) return false;

          // patternB is the most recent (last in array), so it should win the tie
          return merged.pattern_type === patternB;
        }
      ),
      { numRuns: 200 }
    );
  });

  it("all unique distinguishing_features from input are considered (features from any photo can appear in output)", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 30 }),
          { minLength: 1, maxLength: 5 }
        ),
        traitTagsArb,
        (features, baseTags) => {
          // Create a single tag array where each tag has exactly one unique feature
          // This ensures all unique features can appear in the output (up to 5)
          const uniqueFeatures = [...new Set(features)].slice(0, 5);
          const tagsArray: TraitTags[] = uniqueFeatures.map((feature) => ({
            ...baseTags,
            distinguishing_features: [feature],
          }));

          if (tagsArray.length === 0) return true;

          const merged = mergeTraitTags(tagsArray);

          if (merged === null) return false;

          // Every unique feature from input should appear in the output
          // since we have at most 5 unique features and the limit is 5
          return uniqueFeatures.every((f) =>
            merged.distinguishing_features.includes(f)
          );
        }
      ),
      { numRuns: 200 }
    );
  });
});
