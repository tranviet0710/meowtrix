/**
 * Property-based tests for photo upload validation.
 *
 * **Validates: Requirements 2.3, 3.3, 3.7**
 *
 * Req 2.3: Accept only JPEG, PNG, or WebP formats with max 5MB per image
 * Req 3.3: Same requirements for spotted agent photos
 * Req 3.7: Inline validation errors for invalid format/size
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  photoUploadSchema,
  photoListSchema,
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
} from '@/lib/validators';

// --- Generators ---

/** Valid MIME types for cat photos */
const validMimeTypeArb = fc.constantFrom(...ACCEPTED_IMAGE_TYPES);

/** Valid file size (1 byte to 5MB inclusive) */
const validFileSizeArb = fc.integer({ min: 1, max: MAX_IMAGE_SIZE_BYTES });

/** Invalid file size (> 5MB) */
const oversizedFileSizeArb = fc.integer({
  min: MAX_IMAGE_SIZE_BYTES + 1,
  max: MAX_IMAGE_SIZE_BYTES * 10,
});

/** Generate random non-image MIME types that are NOT in the accepted list */
const invalidMimeTypeArb = fc
  .oneof(
    fc.constantFrom(
      'application/pdf',
      'text/plain',
      'video/mp4',
      'audio/mpeg',
      'image/gif',
      'image/bmp',
      'image/tiff',
      'image/svg+xml',
      'application/json',
      'application/octet-stream',
      'text/html',
      'video/webm',
      'audio/wav'
    ),
    fc
      .tuple(
        fc.constantFrom('application', 'text', 'video', 'audio', 'font', 'model'),
        fc.stringMatching(/^[a-z]{3,10}$/)
      )
      .map(([category, subtype]) => `${category}/${subtype}`)
  )
  .filter((type) => !(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type));

/** Generate a valid file object (valid MIME + valid size) */
const validFileArb = fc.record({
  size: validFileSizeArb,
  type: validMimeTypeArb,
});

/** Generate an invalid-type file object (invalid MIME + valid size) */
const invalidTypeFileArb = fc.record({
  size: validFileSizeArb,
  type: invalidMimeTypeArb,
});

/** Generate an oversized file object (valid MIME + size > 5MB) */
const oversizedFileArb = fc.record({
  size: oversizedFileSizeArb,
  type: validMimeTypeArb,
});

describe('Property 2: Photo upload validation', () => {
  it('any file with valid MIME type AND size ≤ 5MB should pass photoUploadSchema validation', () => {
    fc.assert(
      fc.property(validFileArb, (file) => {
        const result = photoUploadSchema.safeParse({ file });
        expect(result.success).toBe(true);
      }),
      { numRuns: 500 }
    );
  });

  it('any file with invalid MIME type should fail photoUploadSchema validation', () => {
    fc.assert(
      fc.property(invalidTypeFileArb, (file) => {
        const result = photoUploadSchema.safeParse({ file });
        expect(result.success).toBe(false);
      }),
      { numRuns: 500 }
    );
  });

  it('any file with size > 5MB should fail photoUploadSchema validation regardless of type', () => {
    fc.assert(
      fc.property(oversizedFileArb, (file) => {
        const result = photoUploadSchema.safeParse({ file });
        expect(result.success).toBe(false);
      }),
      { numRuns: 500 }
    );
  });

  it('a photo list of 1-5 valid files should pass photoListSchema validation', () => {
    const validPhotoListArb = fc
      .integer({ min: 1, max: 5 })
      .chain((count) => fc.array(validFileArb, { minLength: count, maxLength: count }));

    fc.assert(
      fc.property(validPhotoListArb, (files) => {
        const result = photoListSchema.safeParse(files);
        expect(result.success).toBe(true);
      }),
      { numRuns: 500 }
    );
  });

  it('an empty photo list should fail photoListSchema validation', () => {
    const result = photoListSchema.safeParse([]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('At least 1 photo is required');
    }
  });

  it('a photo list with more than 5 items should fail photoListSchema validation', () => {
    const tooManyFilesArb = fc.array(validFileArb, { minLength: 6, maxLength: 20 });

    fc.assert(
      fc.property(tooManyFilesArb, (files) => {
        const result = photoListSchema.safeParse(files);
        expect(result.success).toBe(false);
      }),
      { numRuns: 200 }
    );
  });
});
