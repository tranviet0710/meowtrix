/**
 * Shared fast-check arbitraries for MEOWTRIX property-based tests.
 * Provides reusable generators for domain objects.
 */
import * as fc from 'fast-check';

/**
 * Generate a valid latitude value (-90 to 90).
 */
export const latitudeArb = fc.double({ min: -90, max: 90, noNaN: true });

/**
 * Generate a valid longitude value (-180 to 180).
 */
export const longitudeArb = fc.double({ min: -180, max: 180, noNaN: true });

/**
 * Generate a coordinate pair [lat, lng].
 */
export const coordinateArb = fc.tuple(latitudeArb, longitudeArb);

/**
 * Generate a valid pattern type.
 */
export const patternTypeArb = fc.constantFrom(
  'solid',
  'tabby',
  'calico',
  'bicolor',
  'tortoiseshell',
  'pointed',
  'tuxedo',
  'merle',
  'brindle',
  'spotted',
  'sable',
  'harlequin'
) as fc.Arbitrary<'solid' | 'tabby' | 'calico' | 'bicolor' | 'tortoiseshell' | 'pointed' | 'tuxedo' | 'merle' | 'brindle' | 'spotted' | 'sable' | 'harlequin'>;

/**
 * Generate a valid fur length.
 */
export const furLengthArb = fc.constantFrom('short', 'medium', 'long') as fc.Arbitrary<'short' | 'medium' | 'long'>;

/**
 * Generate a valid pet name (1-50 characters).
 */
export const petNameArb = fc.string({ minLength: 1, maxLength: 50 });

/**
 * Generate a valid description (0-500 characters).
 */
export const descriptionArb = fc.string({ minLength: 0, maxLength: 500 });

/**
 * Generate a non-negative elapsed hours value for heatmap calculations.
 */
export const elapsedHoursArb = fc.double({ min: 0, max: 1000, noNaN: true });

/**
 * Generate a match score (0-100).
 */
export const scoreArb = fc.integer({ min: 0, max: 100 });
