/**
 * Property-based tests for owner-only resolution.
 *
 * **Validates: Requirements 9.8**
 *
 * Req 9.8: THE Claim_Workflow SHALL restrict the resolution action exclusively
 * to the original Informant who reported the Overlord; no other Informant or
 * administrator may mark the Overlord as resolved.
 *
 * Properties tested:
 * 1. Owner user_id matching owner_id → allowed to resolve
 * 2. Any other user_id → NOT allowed to resolve
 * 3. The authorization check is deterministic (same inputs always same output)
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { canResolveOverlord } from '@/lib/claimVerification';

// --- Generators ---

/** Generate a UUID-like string (standard format used for Supabase user IDs) */
const uuidArb = fc.uuid();

/** Generate two distinct UUIDs (guaranteed non-equal) */
const distinctUuidPairArb = fc
  .tuple(uuidArb, uuidArb)
  .filter(([a, b]) => a !== b);

describe('Property 15: Owner-only resolution', () => {
  describe('Owner is allowed to resolve', () => {
    it('when userId matches overlordOwnerId, resolution is allowed', () => {
      fc.assert(
        fc.property(uuidArb, (userId) => {
          // The owner resolving their own Overlord → allowed
          expect(canResolveOverlord(userId, userId)).toBe(true);
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('Non-owner is NOT allowed to resolve', () => {
    it('when userId does NOT match overlordOwnerId, resolution is denied', () => {
      fc.assert(
        fc.property(distinctUuidPairArb, ([userId, ownerId]) => {
          // A different user attempting to resolve → denied
          expect(canResolveOverlord(userId, ownerId)).toBe(false);
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('Authorization check is deterministic', () => {
    it('calling canResolveOverlord with the same inputs always returns the same result', () => {
      fc.assert(
        fc.property(uuidArb, uuidArb, (userId, ownerId) => {
          const result1 = canResolveOverlord(userId, ownerId);
          const result2 = canResolveOverlord(userId, ownerId);
          const result3 = canResolveOverlord(userId, ownerId);
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('Completeness: result is always a boolean', () => {
    it('canResolveOverlord always returns exactly true or false', () => {
      fc.assert(
        fc.property(uuidArb, uuidArb, (userId, ownerId) => {
          const result = canResolveOverlord(userId, ownerId);
          expect(typeof result).toBe('boolean');
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('Logical equivalence', () => {
    it('canResolveOverlord(a, b) === true if and only if a === b', () => {
      fc.assert(
        fc.property(uuidArb, uuidArb, (userId, ownerId) => {
          const result = canResolveOverlord(userId, ownerId);
          expect(result).toBe(userId === ownerId);
        }),
        { numRuns: 1000 }
      );
    });
  });
});
