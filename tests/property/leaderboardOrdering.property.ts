/**
 * Property-based tests for leaderboard ordering.
 *
 * **Validates: Requirements 10.2**
 *
 * Tests that the leaderboard ordering logic correctly:
 * 1. Entries are sorted by total_points descending
 * 2. On point ties, entries are sorted by first_match_at ascending (earliest first)
 * 3. Rank is always sequential (1, 2, 3, ... with no gaps)
 * 4. Max 50 entries per page
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

interface LeaderboardInput {
  total_points: number;
  first_match_at: string | null;
}

interface LeaderboardOutput {
  rank: number;
  total_points: number;
  first_match_at: string | null;
}

const PAGE_SIZE = 50;

/**
 * Sort leaderboard entries by total_points descending, with ties broken by
 * first_match_at ascending (earliest first, nulls last). Then paginate to
 * max 50 entries per page and assign sequential ranks starting from the given offset.
 */
export function sortLeaderboard(
  entries: LeaderboardInput[],
  page: number = 1
): LeaderboardOutput[] {
  const sorted = [...entries].sort((a, b) => {
    // Primary sort: total_points descending
    if (b.total_points !== a.total_points) {
      return b.total_points - a.total_points;
    }
    // Secondary sort: first_match_at ascending (earliest first), nulls last
    if (a.first_match_at === null && b.first_match_at === null) return 0;
    if (a.first_match_at === null) return 1;
    if (b.first_match_at === null) return -1;
    return a.first_match_at.localeCompare(b.first_match_at);
  });

  const offset = (page - 1) * PAGE_SIZE;
  const paged = sorted.slice(offset, offset + PAGE_SIZE);

  return paged.map((entry, index) => ({
    rank: offset + index + 1,
    total_points: entry.total_points,
    first_match_at: entry.first_match_at,
  }));
}

// --- Generators ---

/** Generate a valid ISO timestamp string for first_match_at */
const isoTimestampArb = fc.date({
  min: new Date('2020-01-01T00:00:00Z'),
  max: new Date('2030-12-31T23:59:59Z'),
}).map((d) => d.toISOString());

/** Generate a first_match_at that can be a timestamp or null */
const firstMatchAtArb = fc.oneof(
  { weight: 3, arbitrary: isoTimestampArb },
  { weight: 1, arbitrary: fc.constant(null) }
);

/** Generate a leaderboard input entry */
const leaderboardEntryArb: fc.Arbitrary<LeaderboardInput> = fc.record({
  total_points: fc.integer({ min: 1, max: 10000 }),
  first_match_at: firstMatchAtArb,
});

describe('Property 17: Leaderboard ordering', () => {
  it('entries are sorted by total_points descending', () => {
    fc.assert(
      fc.property(
        fc.array(leaderboardEntryArb, { minLength: 2, maxLength: 100 }),
        (entries) => {
          const result = sortLeaderboard(entries);
          for (let i = 1; i < result.length; i++) {
            if (result[i].total_points > result[i - 1].total_points) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('on point ties, entries are sorted by first_match_at ascending (earliest first)', () => {
    fc.assert(
      fc.property(
        fc.array(leaderboardEntryArb, { minLength: 2, maxLength: 100 }),
        (entries) => {
          const result = sortLeaderboard(entries);
          for (let i = 1; i < result.length; i++) {
            if (result[i].total_points === result[i - 1].total_points) {
              const prev = result[i - 1].first_match_at;
              const curr = result[i].first_match_at;
              // null should come after non-null (nulls last)
              if (prev === null && curr !== null) return false;
              // If both non-null, earlier should come first
              if (prev !== null && curr !== null && prev > curr) return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('rank is always sequential (1, 2, 3, ... with no gaps)', () => {
    fc.assert(
      fc.property(
        fc.array(leaderboardEntryArb, { minLength: 1, maxLength: 100 }),
        (entries) => {
          const result = sortLeaderboard(entries);
          for (let i = 0; i < result.length; i++) {
            if (result[i].rank !== i + 1) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('rank is sequential with correct offset for page > 1', () => {
    fc.assert(
      fc.property(
        fc.array(leaderboardEntryArb, { minLength: 51, maxLength: 120 }),
        fc.integer({ min: 1, max: 3 }),
        (entries, page) => {
          const result = sortLeaderboard(entries, page);
          const expectedStartRank = (page - 1) * PAGE_SIZE + 1;
          for (let i = 0; i < result.length; i++) {
            if (result[i].rank !== expectedStartRank + i) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('max 50 entries per page', () => {
    fc.assert(
      fc.property(
        fc.array(leaderboardEntryArb, { minLength: 51, maxLength: 200 }),
        (entries) => {
          const result = sortLeaderboard(entries);
          return result.length <= PAGE_SIZE;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('page 1 always returns at most 50 entries even with large input', () => {
    fc.assert(
      fc.property(
        fc.array(leaderboardEntryArb, { minLength: 0, maxLength: 200 }),
        (entries) => {
          const result = sortLeaderboard(entries, 1);
          return result.length === Math.min(entries.length, PAGE_SIZE);
        }
      ),
      { numRuns: 500 }
    );
  });
});
