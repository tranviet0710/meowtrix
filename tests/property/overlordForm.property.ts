/**
 * Property-based tests for Overlord form validation.
 *
 * **Validates: Requirements 2.1, 2.6**
 *
 * Req 2.1: Cat name (1-50 chars), description (0-500 chars), last-seen timestamp
 *          not future and not >30 days ago, last-seen location, verification fields
 * Req 2.6: Validate cat name, at least one photo, last-seen location, and timestamp
 *          within allowed range; display inline error for fields that fail
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { overlordFormSchema } from '@/lib/validators';

// --- Generators ---

/** Valid cat name (1-50 characters, non-empty printable strings) */
const validCatNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

/** Invalid cat name: empty string */
const emptyCatNameArb = fc.constant('');

/** Invalid cat name: >50 characters */
const tooLongCatNameArb = fc.string({ minLength: 51, maxLength: 200 });

/** Valid description (0-500 chars) */
const validDescriptionArb = fc.string({ minLength: 0, maxLength: 500 });

/** Invalid description: >500 chars */
const tooLongDescriptionArb = fc.string({ minLength: 501, maxLength: 1000 });

/** Valid latitude (-90 to 90) */
const validLatArb = fc.double({ min: -90, max: 90, noNaN: true });

/** Valid longitude (-180 to 180) */
const validLngArb = fc.double({ min: -180, max: 180, noNaN: true });

/** Generate a valid timestamp (not future, not >30 days ago) */
const validTimestampArb = fc
  .integer({ min: 0, max: 29 * 24 * 60 * 60 * 1000 }) // 0 to 29 days in ms
  .map((msAgo) => {
    const date = new Date(Date.now() - msAgo);
    return date.toISOString();
  });

/** Generate a future timestamp */
const futureTimestampArb = fc
  .integer({ min: 60 * 1000, max: 365 * 24 * 60 * 60 * 1000 }) // 1 min to 1 year in the future
  .map((msAhead) => {
    const date = new Date(Date.now() + msAhead);
    return date.toISOString();
  });

/** Generate a timestamp >30 days ago */
const tooOldTimestampArb = fc
  .integer({ min: 31 * 24 * 60 * 60 * 1000, max: 365 * 24 * 60 * 60 * 1000 }) // 31 days to 1 year ago
  .map((msAgo) => {
    const date = new Date(Date.now() - msAgo);
    return date.toISOString();
  });

/** Valid verification field (1-200 chars, non-empty) */
const validVerificationFieldArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

/** Empty verification field */
const emptyVerificationFieldArb = fc.constant('');

/** Too long verification field (>200 chars) */
const tooLongVerificationFieldArb = fc.string({ minLength: 201, maxLength: 500 });

/** Generate a complete valid overlord form input */
const validOverlordFormArb = fc.record({
  cat_name: validCatNameArb,
  description: validDescriptionArb,
  last_seen_lat: validLatArb,
  last_seen_lng: validLngArb,
  last_seen_at: validTimestampArb,
  verification_name: validVerificationFieldArb,
  verification_marking: validVerificationFieldArb,
  verification_trait: validVerificationFieldArb,
});

describe('Property 1: Overlord form validation', () => {
  it('valid cat name (1-50 chars), valid timestamp, valid location, valid verification fields → passes', () => {
    fc.assert(
      fc.property(validOverlordFormArb, (input) => {
        const result = overlordFormSchema.safeParse(input);
        expect(result.success).toBe(true);
      }),
      { numRuns: 500 }
    );
  });

  it('empty cat name → fails', () => {
    const invalidArb = fc.record({
      cat_name: emptyCatNameArb,
      description: validDescriptionArb,
      last_seen_lat: validLatArb,
      last_seen_lng: validLngArb,
      last_seen_at: validTimestampArb,
      verification_name: validVerificationFieldArb,
      verification_marking: validVerificationFieldArb,
      verification_trait: validVerificationFieldArb,
    });

    fc.assert(
      fc.property(invalidArb, (input) => {
        const result = overlordFormSchema.safeParse(input);
        expect(result.success).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('cat name >50 chars → fails', () => {
    const invalidArb = fc.record({
      cat_name: tooLongCatNameArb,
      description: validDescriptionArb,
      last_seen_lat: validLatArb,
      last_seen_lng: validLngArb,
      last_seen_at: validTimestampArb,
      verification_name: validVerificationFieldArb,
      verification_marking: validVerificationFieldArb,
      verification_trait: validVerificationFieldArb,
    });

    fc.assert(
      fc.property(invalidArb, (input) => {
        const result = overlordFormSchema.safeParse(input);
        expect(result.success).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('future timestamp → fails', () => {
    const invalidArb = fc.record({
      cat_name: validCatNameArb,
      description: validDescriptionArb,
      last_seen_lat: validLatArb,
      last_seen_lng: validLngArb,
      last_seen_at: futureTimestampArb,
      verification_name: validVerificationFieldArb,
      verification_marking: validVerificationFieldArb,
      verification_trait: validVerificationFieldArb,
    });

    fc.assert(
      fc.property(invalidArb, (input) => {
        const result = overlordFormSchema.safeParse(input);
        expect(result.success).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('timestamp >30 days ago → fails', () => {
    const invalidArb = fc.record({
      cat_name: validCatNameArb,
      description: validDescriptionArb,
      last_seen_lat: validLatArb,
      last_seen_lng: validLngArb,
      last_seen_at: tooOldTimestampArb,
      verification_name: validVerificationFieldArb,
      verification_marking: validVerificationFieldArb,
      verification_trait: validVerificationFieldArb,
    });

    fc.assert(
      fc.property(invalidArb, (input) => {
        const result = overlordFormSchema.safeParse(input);
        expect(result.success).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('empty verification fields → fails', () => {
    const invalidArb = fc.record({
      cat_name: validCatNameArb,
      description: validDescriptionArb,
      last_seen_lat: validLatArb,
      last_seen_lng: validLngArb,
      last_seen_at: validTimestampArb,
      verification_name: emptyVerificationFieldArb,
      verification_marking: emptyVerificationFieldArb,
      verification_trait: emptyVerificationFieldArb,
    });

    fc.assert(
      fc.property(invalidArb, (input) => {
        const result = overlordFormSchema.safeParse(input);
        expect(result.success).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('verification field >200 chars → fails', () => {
    const invalidArb = fc.record({
      cat_name: validCatNameArb,
      description: validDescriptionArb,
      last_seen_lat: validLatArb,
      last_seen_lng: validLngArb,
      last_seen_at: validTimestampArb,
      verification_name: tooLongVerificationFieldArb,
      verification_marking: validVerificationFieldArb,
      verification_trait: validVerificationFieldArb,
    });

    fc.assert(
      fc.property(invalidArb, (input) => {
        const result = overlordFormSchema.safeParse(input);
        expect(result.success).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('description >500 chars → fails', () => {
    const invalidArb = fc.record({
      cat_name: validCatNameArb,
      description: tooLongDescriptionArb,
      last_seen_lat: validLatArb,
      last_seen_lng: validLngArb,
      last_seen_at: validTimestampArb,
      verification_name: validVerificationFieldArb,
      verification_marking: validVerificationFieldArb,
      verification_trait: validVerificationFieldArb,
    });

    fc.assert(
      fc.property(invalidArb, (input) => {
        const result = overlordFormSchema.safeParse(input);
        expect(result.success).toBe(false);
      }),
      { numRuns: 200 }
    );
  });
});
