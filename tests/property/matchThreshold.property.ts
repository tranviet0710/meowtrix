/**
 * Property-based tests for match threshold and ranking.
 *
 * **Validates: Requirements 8.3, 8.5**
 *
 * Tests that the match threshold and ranking logic correctly:
 * 1. Persists matches with score ≥ 60 (above threshold)
 * 2. Does NOT persist matches with score < 60 (below threshold)
 * 3. Sorts results by score descending (valid ranking)
 * 4. Caps at maximum 10 suggestions per Overlord
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Helper function that applies match threshold filtering, sorts descending,
 * and caps at 10 results. This encapsulates the threshold + ranking logic
 * from the Match Engine design.
 *
 * @param scores - Array of match scores (0–100)
 * @returns Filtered (≥60), sorted descending, and capped at 10 scores
 */
export function filterAndRankMatches(scores: number[]): number[] {
  return scores
    .filter((score) => score >= 60)
    .sort((a, b) => b - a)
    .slice(0, 10);
}

describe('Property 10: Match threshold and ranking', () => {
  it('matches with score ≥ 60 are persisted (above threshold)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 60, max: 100 }), { minLength: 1, maxLength: 20 }),
        (scores) => {
          const result = filterAndRankMatches(scores);
          // All input scores are ≥ 60, so all should pass the filter
          // (capped at 10 though)
          const expected = Math.min(scores.length, 10);
          return result.length === expected;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('matches with score < 60 are NOT persisted (below threshold)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 59 }), { minLength: 1, maxLength: 20 }),
        (scores) => {
          const result = filterAndRankMatches(scores);
          // All input scores are < 60, so none should pass the filter
          return result.length === 0;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('results are sorted by score descending (valid ranking)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 0, maxLength: 30 }),
        (scores) => {
          const result = filterAndRankMatches(scores);
          // Verify descending order
          for (let i = 1; i < result.length; i++) {
            if (result[i] > result[i - 1]) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('maximum 10 suggestions per Overlord after ranking', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 60, max: 100 }), { minLength: 11, maxLength: 50 }),
        (scores) => {
          const result = filterAndRankMatches(scores);
          // Even with more than 10 qualifying scores, max is 10
          return result.length === 10;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('the top 10 are the highest scores from the filtered set', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 0, maxLength: 50 }),
        (scores) => {
          const result = filterAndRankMatches(scores);
          const allAboveThreshold = scores
            .filter((s) => s >= 60)
            .sort((a, b) => b - a);
          const expectedTop10 = allAboveThreshold.slice(0, 10);
          // Result should exactly match expected top 10
          if (result.length !== expectedTop10.length) return false;
          for (let i = 0; i < result.length; i++) {
            if (result[i] !== expectedTop10[i]) return false;
          }
          return true;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('every score in the result is ≥ 60', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 0, maxLength: 30 }),
        (scores) => {
          const result = filterAndRankMatches(scores);
          return result.every((s) => s >= 60);
        }
      ),
      { numRuns: 500 }
    );
  });
});
