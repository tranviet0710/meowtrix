import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('Property-based testing setup', () => {
  it('should verify fast-check integration works', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        // Addition is commutative
        expect(a + b).toBe(b + a);
      })
    );
  });

  it('should support custom arbitraries', () => {
    const positiveInt = fc.integer({ min: 1, max: 1000 });

    fc.assert(
      fc.property(positiveInt, (n) => {
        expect(n).toBeGreaterThan(0);
        expect(n).toBeLessThanOrEqual(1000);
      })
    );
  });
});
