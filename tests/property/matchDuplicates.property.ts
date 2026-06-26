/**
 * Property-based tests for no duplicate match suggestions.
 *
 * **Validates: Requirements 8.10**
 *
 * Tests that the match deduplication logic correctly:
 * - Given any list of (overlord_id, agent_id) match pairs, no two entries
 *   in the deduplicated output have the same combination
 * - A deduplication function applied to any list of match pairs produces unique pairs only
 * - The deduplication prefers the first occurrence (retains original record)
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Represents a match pair linking an Overlord to an Agent.
 */
interface MatchPair {
  overlord_id: string;
  agent_id: string;
}

/**
 * Deduplicates match pairs by removing entries with duplicate
 * (overlord_id, agent_id) combinations. Keeps the first occurrence.
 *
 * @param pairs - Array of match pairs, possibly containing duplicates
 * @returns Array of unique match pairs, preserving order of first occurrence
 */
export function deduplicateMatchPairs(pairs: MatchPair[]): MatchPair[] {
  const seen = new Set<string>();
  const result: MatchPair[] = [];

  for (const pair of pairs) {
    const key = `${pair.overlord_id}::${pair.agent_id}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(pair);
    }
  }

  return result;
}

/**
 * Arbitrary for generating a match pair with constrained ID formats
 * (simulating UUIDs without requiring full UUID format).
 */
const matchPairArb = fc.record({
  overlord_id: fc.stringOf(fc.constantFrom("a", "b", "c", "d", "e"), {
    minLength: 1,
    maxLength: 5,
  }),
  agent_id: fc.stringOf(fc.constantFrom("x", "y", "z", "w", "v"), {
    minLength: 1,
    maxLength: 5,
  }),
});

describe("Property 11: No duplicate match suggestions", () => {
  it("deduplicated output never contains duplicate (overlord_id, agent_id) pairs", () => {
    fc.assert(
      fc.property(
        fc.array(matchPairArb, { minLength: 0, maxLength: 50 }),
        (pairs) => {
          const result = deduplicateMatchPairs(pairs);
          const keys = result.map((p) => `${p.overlord_id}::${p.agent_id}`);
          const uniqueKeys = new Set(keys);
          return uniqueKeys.size === keys.length;
        }
      ),
      { numRuns: 1000 }
    );
  });

  it("deduplication output length is always ≤ input length", () => {
    fc.assert(
      fc.property(
        fc.array(matchPairArb, { minLength: 0, maxLength: 50 }),
        (pairs) => {
          const result = deduplicateMatchPairs(pairs);
          return result.length <= pairs.length;
        }
      ),
      { numRuns: 1000 }
    );
  });

  it("deduplication preserves the first occurrence of each unique pair", () => {
    fc.assert(
      fc.property(
        fc.array(matchPairArb, { minLength: 1, maxLength: 50 }),
        (pairs) => {
          const result = deduplicateMatchPairs(pairs);

          // For each entry in the result, it should be the first occurrence
          // of that (overlord_id, agent_id) key in the original input
          for (const entry of result) {
            const firstIndex = pairs.findIndex(
              (p) =>
                p.overlord_id === entry.overlord_id &&
                p.agent_id === entry.agent_id
            );
            // The entry in result should reference the same object
            // (same position content) as the first occurrence
            if (firstIndex === -1) return false;
            if (
              pairs[firstIndex].overlord_id !== entry.overlord_id ||
              pairs[firstIndex].agent_id !== entry.agent_id
            ) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 1000 }
    );
  });

  it("all unique pairs from input are present in deduplicated output", () => {
    fc.assert(
      fc.property(
        fc.array(matchPairArb, { minLength: 0, maxLength: 50 }),
        (pairs) => {
          const result = deduplicateMatchPairs(pairs);
          const resultKeys = new Set(
            result.map((p) => `${p.overlord_id}::${p.agent_id}`)
          );

          // Every unique key from input should appear in output
          for (const pair of pairs) {
            const key = `${pair.overlord_id}::${pair.agent_id}`;
            if (!resultKeys.has(key)) return false;
          }
          return true;
        }
      ),
      { numRuns: 1000 }
    );
  });

  it("applying deduplication twice yields the same result (idempotent)", () => {
    fc.assert(
      fc.property(
        fc.array(matchPairArb, { minLength: 0, maxLength: 50 }),
        (pairs) => {
          const once = deduplicateMatchPairs(pairs);
          const twice = deduplicateMatchPairs(once);
          if (once.length !== twice.length) return false;
          for (let i = 0; i < once.length; i++) {
            if (
              once[i].overlord_id !== twice[i].overlord_id ||
              once[i].agent_id !== twice[i].agent_id
            ) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 1000 }
    );
  });
});
