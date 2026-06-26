/**
 * Property-based tests for the geodesic (haversine) distance function.
 *
 * **Validates: Requirements 7.8, 8.8**
 *
 * Req 7.8: The Notification_Service SHALL determine notification recipients by calculating
 *          the geodesic distance between locations.
 * Req 8.8: The Match_Engine SHALL calculate geographical proximity score using geodesic distance.
 *
 * Properties tested:
 * 1. Distance from any point to itself is always 0
 * 2. Distance is always non-negative
 * 3. Distance is symmetric (A→B = B→A)
 * 4. Triangle inequality holds (d(A,C) ≤ d(A,B) + d(B,C))
 * 5. Distance never exceeds half Earth's circumference (~20,015km)
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { haversineDistance } from '@/lib/geodesic';
import { latitudeArb, longitudeArb, coordinateArb } from '../helpers/arbitraries';

// Half Earth's circumference in meters (π × R ≈ 20,015,086m)
const HALF_EARTH_CIRCUMFERENCE = Math.PI * 6_371_000;

describe('Property 7: Geodesic distance function', () => {
  it('distance from any point to itself is always 0', () => {
    fc.assert(
      fc.property(latitudeArb, longitudeArb, (lat, lng) => {
        const distance = haversineDistance(lat, lng, lat, lng);
        expect(distance).toBeCloseTo(0, 10);
      }),
      { numRuns: 500 }
    );
  });

  it('distance is always non-negative', () => {
    fc.assert(
      fc.property(coordinateArb, coordinateArb, ([lat1, lng1], [lat2, lng2]) => {
        const distance = haversineDistance(lat1, lng1, lat2, lng2);
        expect(distance).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 500 }
    );
  });

  it('distance is symmetric (A→B = B→A)', () => {
    fc.assert(
      fc.property(coordinateArb, coordinateArb, ([lat1, lng1], [lat2, lng2]) => {
        const distAB = haversineDistance(lat1, lng1, lat2, lng2);
        const distBA = haversineDistance(lat2, lng2, lat1, lng1);
        // Allow tiny floating-point tolerance
        expect(Math.abs(distAB - distBA)).toBeLessThan(1e-6);
      }),
      { numRuns: 500 }
    );
  });

  it('triangle inequality holds: d(A,C) ≤ d(A,B) + d(B,C)', () => {
    fc.assert(
      fc.property(
        coordinateArb,
        coordinateArb,
        coordinateArb,
        ([latA, lngA], [latB, lngB], [latC, lngC]) => {
          const dAB = haversineDistance(latA, lngA, latB, lngB);
          const dBC = haversineDistance(latB, lngB, latC, lngC);
          const dAC = haversineDistance(latA, lngA, latC, lngC);

          // Triangle inequality with floating-point tolerance.
          // Haversine has known numerical instability near antipodal points where
          // relative error can reach ~1e-8 on IEEE 754 doubles. We use a generous
          // relative tolerance to account for this while still validating the property.
          const tolerance = (dAB + dBC + dAC) * 1e-7 + 1e-3;
          expect(dAC).toBeLessThanOrEqual(dAB + dBC + tolerance);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('distance never exceeds half Earth circumference (~20,015km)', () => {
    fc.assert(
      fc.property(coordinateArb, coordinateArb, ([lat1, lng1], [lat2, lng2]) => {
        const distance = haversineDistance(lat1, lng1, lat2, lng2);
        // Allow small tolerance for floating point
        expect(distance).toBeLessThanOrEqual(HALF_EARTH_CIRCUMFERENCE + 1);
      }),
      { numRuns: 500 }
    );
  });
});
