/**
 * Property-based tests for image dimension constraints in the Image_Optimizer.
 *
 * **Validates: Requirements 14.4, 14.5**
 *
 * Req 14.4: Downscaling longest edge > 2048px → 2048px, maintain aspect ratio
 * Req 14.5: Min dimension 800px (never resize below this)
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateResizeDimensions } from '@/lib/imageOptimizer';

// --- Generators ---

/** Generate dimensions where longest edge > 2048 (needs resize) */
const largeDimensionArb = fc.integer({ min: 2049, max: 20000 });

/** Generate dimensions where longest edge <= 2048 (no resize needed) */
const smallDimensionArb = fc.integer({ min: 1, max: 2048 });

/** Arbitrary for width and height where at least one exceeds 2048 */
const oversizedImageArb = fc.oneof(
  // Landscape: width > 2048
  fc.record({
    width: largeDimensionArb,
    height: fc.integer({ min: 1, max: 20000 }),
  }).filter(({ width, height }) => Math.max(width, height) > 2048),
  // Portrait: height > 2048
  fc.record({
    width: fc.integer({ min: 1, max: 20000 }),
    height: largeDimensionArb,
  }).filter(({ width, height }) => Math.max(width, height) > 2048)
);

/** Arbitrary for width and height where both are <= 2048 (longest edge <= 2048) */
const withinBoundsImageArb = fc.record({
  width: smallDimensionArb,
  height: smallDimensionArb,
});

describe('Property 21: Image dimension constraints', () => {
  it('for any image with longest edge > 2048, output longest edge should be exactly 2048', () => {
    fc.assert(
      fc.property(oversizedImageArb, ({ width, height }) => {
        const result = calculateResizeDimensions(width, height);

        // Should always return resize dimensions when longest edge > 2048
        expect(result).not.toBeNull();

        const outputLongest = Math.max(result!.width, result!.height);
        expect(outputLongest).toBe(2048);
      }),
      { numRuns: 500 }
    );
  });

  it('for any image with longest edge <= 2048, calculateResizeDimensions should return null', () => {
    fc.assert(
      fc.property(withinBoundsImageArb, ({ width, height }) => {
        const result = calculateResizeDimensions(width, height);

        // No resize needed when longest edge is within bounds
        expect(result).toBeNull();
      }),
      { numRuns: 500 }
    );
  });

  it('output should always maintain the original aspect ratio (within ±1px rounding tolerance)', () => {
    fc.assert(
      fc.property(oversizedImageArb, ({ width, height }) => {
        const result = calculateResizeDimensions(width, height);
        expect(result).not.toBeNull();

        // The expected scaled dimensions before rounding
        const longestEdge = Math.max(width, height);
        const scale = 2048 / longestEdge;
        const expectedWidth = width * scale;
        const expectedHeight = height * scale;

        // Each output dimension should be within ±1 of the exact (unrounded) scaled value
        // This accounts for Math.round() rounding errors and the min-1 clamp
        expect(Math.abs(result!.width - Math.max(1, expectedWidth))).toBeLessThanOrEqual(1);
        expect(Math.abs(result!.height - Math.max(1, expectedHeight))).toBeLessThanOrEqual(1);
      }),
      { numRuns: 500 }
    );
  });

  it('output should never have a longest edge below 800px (MIN_LONGEST_EDGE)', () => {
    // Test with any positive dimensions where longest edge > 2048
    fc.assert(
      fc.property(oversizedImageArb, ({ width, height }) => {
        const result = calculateResizeDimensions(width, height);
        expect(result).not.toBeNull();

        const outputLongest = Math.max(result!.width, result!.height);
        expect(outputLongest).toBeGreaterThanOrEqual(800);
      }),
      { numRuns: 500 }
    );
  });

  it('width and height in output should always be positive integers', () => {
    fc.assert(
      fc.property(oversizedImageArb, ({ width, height }) => {
        const result = calculateResizeDimensions(width, height);
        expect(result).not.toBeNull();

        // Positive
        expect(result!.width).toBeGreaterThan(0);
        expect(result!.height).toBeGreaterThan(0);

        // Integer (Math.round is used in implementation)
        expect(Number.isInteger(result!.width)).toBe(true);
        expect(Number.isInteger(result!.height)).toBe(true);
      }),
      { numRuns: 500 }
    );
  });
});
