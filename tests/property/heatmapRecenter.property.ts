/**
 * Property-based tests for heatmap re-centering on Agent sighting.
 *
 * **Validates: Requirements 6.5, 6.7**
 *
 * Req 6.5: WHEN a new Agent sighting is reported within the current probability zone radius
 *          of an Overlord, THE Heatmap_Engine SHALL re-center the probability zone on the
 *          most recent Agent sighting location and continue calculating elapsed time from the
 *          original Overlord last-seen timestamp.
 * Req 6.7: IF no Agent sightings exist within an Overlord's probability zone, THEN THE
 *          Heatmap_Engine SHALL keep the probability zone centered on the Overlord's original
 *          last-seen location.
 *
 * Properties tested:
 * 1. When no agent sightings exist within the zone, center stays at original overlord location
 * 2. When agent sightings exist within the zone, center moves to the most recent one
 * 3. The returned center is always either the original or one of the sightings within the zone
 * 4. Agent sightings outside the radius don't affect the center
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getHeatmapCenter } from '@/lib/heatmapCalc';
import { haversineDistance } from '@/lib/geodesic';
import { latitudeArb, longitudeArb } from '../helpers/arbitraries';

/**
 * Generate a valid ISO timestamp string for sighting dates.
 */
const timestampStrArb = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
  .map((d) => d.toISOString());

/**
 * Generate a reasonable radius (200-5000 meters, matching heatmap constraints).
 */
const radiusArb = fc.double({ min: 200, max: 5000, noNaN: true });

/**
 * Generate an agent sighting record matching the getHeatmapCenter interface.
 */
const agentSightingArb = fc.record({
  lat: fc.double({ min: -90, max: 90, noNaN: true }),
  lng: fc.double({ min: -180, max: 180, noNaN: true }),
  sighted_at: timestampStrArb,
});

describe('Property 6: Heatmap re-centering on Agent sighting', () => {
  it('when no agent sightings exist within the zone, center stays at original overlord location', () => {
    fc.assert(
      fc.property(
        latitudeArb,
        longitudeArb,
        radiusArb,
        (lat, lng, radius) => {
          // Test with empty sightings array
          const center = getHeatmapCenter(lat, lng, [], radius);
          expect(center.lat).toBe(lat);
          expect(center.lng).toBe(lng);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('when agent sightings exist within the zone, center moves to the most recent one', () => {
    fc.assert(
      fc.property(
        // Use a reference point away from poles for reliable geometry
        fc.double({ min: -45, max: 45, noNaN: true }),
        fc.double({ min: -170, max: 170, noNaN: true }),
        fc.double({ min: 1000, max: 5000, noNaN: true }), // large enough radius
        fc.array(timestampStrArb, { minLength: 2, maxLength: 10 }),
        (refLat, refLng, radius, timestamps) => {
          // Create sightings very close to the overlord location (guaranteed within radius)
          // Small offsets (< 0.001 degrees ≈ ~111m) guarantee they're within any radius ≥ 1000m
          const sightings = timestamps.map((ts, i) => ({
            lat: refLat + (i + 1) * 0.0001,
            lng: refLng + (i + 1) * 0.0001,
            sighted_at: ts,
          }));

          // Verify all sightings are actually within radius
          const allWithin = sightings.every(
            (s) => haversineDistance(refLat, refLng, s.lat, s.lng) <= radius
          );
          if (!allWithin) return; // Skip if geometry doesn't work out

          const center = getHeatmapCenter(refLat, refLng, sightings, radius);

          // Find the most recent sighting
          const mostRecent = sightings.reduce((latest, current) =>
            new Date(current.sighted_at).getTime() > new Date(latest.sighted_at).getTime()
              ? current
              : latest
          );

          expect(center.lat).toBe(mostRecent.lat);
          expect(center.lng).toBe(mostRecent.lng);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('the returned center is always either the original or one of the sightings within the zone', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -45, max: 45, noNaN: true }),
        fc.double({ min: -170, max: 170, noNaN: true }),
        fc.double({ min: 500, max: 5000, noNaN: true }),
        fc.array(agentSightingArb, { minLength: 0, maxLength: 10 }),
        (refLat, refLng, radius, sightings) => {
          const center = getHeatmapCenter(refLat, refLng, sightings, radius);

          // Determine which sightings are within the zone
          const sightingsWithinZone = sightings.filter(
            (s) => haversineDistance(refLat, refLng, s.lat, s.lng) <= radius
          );

          // The center must be either the original location or one of the sightings within zone
          const isOriginal = center.lat === refLat && center.lng === refLng;
          const isOneSighting = sightingsWithinZone.some(
            (s) => center.lat === s.lat && center.lng === s.lng
          );

          expect(isOriginal || isOneSighting).toBe(true);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('agent sightings outside the radius do not affect the center', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -45, max: 45, noNaN: true }),
        fc.double({ min: -90, max: 90, noNaN: true }),
        fc.double({ min: 200, max: 2000, noNaN: true }), // smaller radius for easier outside placement
        fc.array(timestampStrArb, { minLength: 1, maxLength: 5 }),
        (refLat, refLng, radius, timestamps) => {
          // Create sightings that are far outside the radius
          // Offset by ~0.5 degrees in latitude ≈ ~55km, always outside a ≤2km radius
          const outsideSightings = timestamps.map((ts, i) => ({
            lat: Math.min(90, refLat + 0.5 + i * 0.1),
            lng: refLng,
            sighted_at: ts,
          }));

          // Verify all sightings are actually outside radius
          const allOutside = outsideSightings.every(
            (s) => haversineDistance(refLat, refLng, s.lat, s.lng) > radius
          );
          if (!allOutside) return; // Skip if geometry doesn't work

          const center = getHeatmapCenter(refLat, refLng, outsideSightings, radius);

          // Center should remain at original overlord location
          expect(center.lat).toBe(refLat);
          expect(center.lng).toBe(refLng);
        }
      ),
      { numRuns: 500 }
    );
  });
});
