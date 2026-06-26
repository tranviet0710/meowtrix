/**
 * Property-based tests for verification fields access control.
 *
 * **Validates: Requirements 2.9, 13.5**
 *
 * Req 2.9: THE Report_Form SHALL require the Informant to provide verification
 * details for future claims: the cat's name, one unique physical marking, and
 * one behavioral trait, storing these fields in the Overlord record such that
 * they are not exposed to any Informant other than the record owner through
 * read access or API responses.
 *
 * Req 13.5: THE Tracker SHALL not expose Informant personal information (email
 * address, authentication identifiers, and Residential_Area coordinates) through
 * read access to Overlord or Agent records or through any public API response to
 * other Informants.
 *
 * Properties tested:
 * 1. Stripping verification fields always removes exactly those 3 fields
 * 2. All other fields are preserved unchanged after stripping
 * 3. For any user who is NOT the owner, the response should not contain verification fields
 * 4. For the owner, the response should contain verification fields
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  stripVerificationFields,
  shouldExposeVerificationFields,
  prepareOverlordResponse,
  VERIFICATION_FIELDS,
} from '@/lib/stripVerificationFields';

// --- Generators ---

/** Generate a UUID-like string */
const uuidArb = fc.uuid();

/** Generate two distinct UUIDs (guaranteed non-equal) */
const distinctUuidPairArb = fc
  .tuple(uuidArb, uuidArb)
  .filter(([a, b]) => a !== b);

/** Generate a random non-verification field name */
const nonVerificationFieldArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter(
    (s) =>
      !VERIFICATION_FIELDS.includes(s as typeof VERIFICATION_FIELDS[number])
  );

/** Generate a realistic Overlord-like record with verification fields */
const overlordRecordArb = fc.record({
  id: uuidArb,
  owner_id: uuidArb,
  cat_name: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ maxLength: 500 }),
  last_seen_lat: fc.double({ min: -90, max: 90, noNaN: true }),
  last_seen_lng: fc.double({ min: -180, max: 180, noNaN: true }),
  last_seen_at: fc.date().map((d) => d.toISOString()),
  status: fc.constantFrom('active', 'resolved'),
  photos: fc.array(fc.webUrl(), { minLength: 1, maxLength: 5 }),
  verification_name: fc.string({ minLength: 1, maxLength: 50 }),
  verification_marking: fc.string({ minLength: 1, maxLength: 200 }),
  verification_trait: fc.string({ minLength: 1, maxLength: 200 }),
  is_seed: fc.boolean(),
  created_at: fc.date().map((d) => d.toISOString()),
});

/** Generate a record with random extra fields (to ensure they are preserved) */
const overlordWithExtraFieldsArb = fc
  .tuple(
    overlordRecordArb,
    fc.dictionary(nonVerificationFieldArb, fc.jsonValue(), {
      minKeys: 0,
      maxKeys: 5,
    })
  )
  .map(([overlord, extras]) => ({ ...overlord, ...extras }));

describe('Property 19: Verification fields access control', () => {
  describe('Stripping removes exactly the 3 verification fields', () => {
    it('the result does not contain any of the verification fields', () => {
      fc.assert(
        fc.property(overlordRecordArb, (overlord) => {
          const stripped = stripVerificationFields(overlord);

          // None of the verification fields should be present
          for (const field of VERIFICATION_FIELDS) {
            expect(stripped).not.toHaveProperty(field);
          }
        }),
        { numRuns: 1000 }
      );
    });

    it('exactly 3 fields are removed (no more, no less)', () => {
      fc.assert(
        fc.property(overlordRecordArb, (overlord) => {
          const originalKeys = Object.keys(overlord);
          const stripped = stripVerificationFields(overlord);
          const strippedKeys = Object.keys(stripped);

          // The number of keys removed should be exactly 3
          const removedCount = originalKeys.length - strippedKeys.length;
          expect(removedCount).toBe(3);
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('All other fields are preserved unchanged after stripping', () => {
    it('non-verification fields retain their original values', () => {
      fc.assert(
        fc.property(overlordWithExtraFieldsArb, (overlord) => {
          const stripped = stripVerificationFields(overlord);

          // Every key in the stripped result should have the same value as the original
          for (const key of Object.keys(stripped)) {
            expect((stripped as Record<string, unknown>)[key]).toEqual(
              (overlord as Record<string, unknown>)[key]
            );
          }

          // Every non-verification key from the original should still be present
          for (const key of Object.keys(overlord)) {
            if (
              !VERIFICATION_FIELDS.includes(
                key as typeof VERIFICATION_FIELDS[number]
              )
            ) {
              expect(stripped).toHaveProperty(key);
            }
          }
        }),
        { numRuns: 1000 }
      );
    });

    it('stripping does not mutate the original object', () => {
      fc.assert(
        fc.property(overlordRecordArb, (overlord) => {
          const originalCopy = { ...overlord };
          stripVerificationFields(overlord);

          // The original should remain unchanged
          expect(overlord).toEqual(originalCopy);
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('Non-owner response never contains verification fields', () => {
    it('prepareOverlordResponse strips verification fields for non-owners', () => {
      fc.assert(
        fc.property(
          overlordRecordArb,
          distinctUuidPairArb,
          (overlord, [requesterId, ownerId]) => {
            // Ensure the overlord has a different owner than the requester
            const record = { ...overlord, owner_id: ownerId };
            const response = prepareOverlordResponse(record, requesterId);

            // Verification fields must not be present
            for (const field of VERIFICATION_FIELDS) {
              expect(response).not.toHaveProperty(field);
            }
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('shouldExposeVerificationFields returns false for non-owners', () => {
      fc.assert(
        fc.property(distinctUuidPairArb, ([userId, ownerId]) => {
          expect(shouldExposeVerificationFields(userId, ownerId)).toBe(false);
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('Owner response contains verification fields', () => {
    it('prepareOverlordResponse includes verification fields for the owner', () => {
      fc.assert(
        fc.property(overlordRecordArb, uuidArb, (overlord, ownerId) => {
          // Set the overlord's owner to match the requesting user
          const record = { ...overlord, owner_id: ownerId };
          const response = prepareOverlordResponse(record, ownerId);

          // All verification fields must be present
          for (const field of VERIFICATION_FIELDS) {
            expect(response).toHaveProperty(field);
            expect((response as Record<string, unknown>)[field]).toBe(
              (record as Record<string, unknown>)[field]
            );
          }
        }),
        { numRuns: 1000 }
      );
    });

    it('shouldExposeVerificationFields returns true for the owner', () => {
      fc.assert(
        fc.property(uuidArb, (userId) => {
          expect(shouldExposeVerificationFields(userId, userId)).toBe(true);
        }),
        { numRuns: 1000 }
      );
    });
  });
});
