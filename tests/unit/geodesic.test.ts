// tests/unit/geodesic.test.ts — Unit tests for geodesic distance and proximity scoring

import { describe, it, expect } from 'vitest';
import { haversineDistance, calculateProximityScore } from '@/lib/geodesic';

// --- haversineDistance tests ---

describe('haversineDistance', () => {
  it('returns 0 for the same point', () => {
    const distance = haversineDistance(13.7563, 100.5018, 13.7563, 100.5018);
    expect(distance).toBe(0);
  });

  it('returns 0 for identical coordinates at different location', () => {
    const distance = haversineDistance(48.8566, 2.3522, 48.8566, 2.3522);
    expect(distance).toBe(0);
  });

  it('calculates known distance: London to Paris (~340km)', () => {
    // London: 51.5074, -0.1278
    // Paris: 48.8566, 2.3522
    const distance = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
    // Known distance is approximately 340-344 km
    expect(distance).toBeGreaterThan(330_000);
    expect(distance).toBeLessThan(350_000);
  });

  it('calculates known distance: New York to Los Angeles (~3940km)', () => {
    // New York: 40.7128, -74.0060
    // Los Angeles: 34.0522, -118.2437
    const distance = haversineDistance(40.7128, -74.0060, 34.0522, -118.2437);
    // Known distance is approximately 3940 km
    expect(distance).toBeGreaterThan(3_900_000);
    expect(distance).toBeLessThan(4_000_000);
  });

  it('calculates known distance: Bangkok to Chiang Mai (~580km)', () => {
    // Bangkok: 13.7563, 100.5018
    // Chiang Mai: 18.7883, 98.9853
    const distance = haversineDistance(13.7563, 100.5018, 18.7883, 98.9853);
    // Known distance is approximately 580 km
    expect(distance).toBeGreaterThan(570_000);
    expect(distance).toBeLessThan(600_000);
  });

  it('is symmetric (distance A→B equals B→A)', () => {
    const ab = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
    const ba = haversineDistance(48.8566, 2.3522, 51.5074, -0.1278);
    expect(ab).toBeCloseTo(ba, 6);
  });

  it('handles points on the equator', () => {
    // Two points on the equator, 1 degree apart in longitude
    // At the equator, 1 degree of longitude ≈ 111.32 km
    const distance = haversineDistance(0, 0, 0, 1);
    expect(distance).toBeGreaterThan(110_000);
    expect(distance).toBeLessThan(112_000);
  });

  it('handles antipodal points (maximum distance)', () => {
    // North Pole to South Pole
    const distance = haversineDistance(90, 0, -90, 0);
    // Should be approximately half the Earth's circumference (~20,015 km)
    expect(distance).toBeGreaterThan(20_000_000);
    expect(distance).toBeLessThan(20_100_000);
  });

  it('handles short distances accurately', () => {
    // Two points approximately 100m apart
    // At latitude 0, 0.001 degrees longitude ≈ 111 meters
    const distance = haversineDistance(0, 0, 0, 0.001);
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(120);
  });

  it('handles negative latitudes and longitudes', () => {
    // Sydney: -33.8688, 151.2093
    // Melbourne: -37.8136, 144.9631
    const distance = haversineDistance(-33.8688, 151.2093, -37.8136, 144.9631);
    // Known distance is approximately 714 km
    expect(distance).toBeGreaterThan(700_000);
    expect(distance).toBeLessThan(730_000);
  });

  it('handles crossing the international date line', () => {
    // Points on either side of the date line
    const distance = haversineDistance(0, 179, 0, -179);
    // Should be about 2 degrees of longitude at equator ≈ 222 km
    expect(distance).toBeGreaterThan(220_000);
    expect(distance).toBeLessThan(225_000);
  });
});

// --- calculateProximityScore tests ---

describe('calculateProximityScore', () => {
  it('returns 100 for 0 meters', () => {
    expect(calculateProximityScore(0)).toBe(100);
  });

  it('returns 100 for exactly 500 meters', () => {
    expect(calculateProximityScore(500)).toBe(100);
  });

  it('returns 100 for distances under 500 meters', () => {
    expect(calculateProximityScore(100)).toBe(100);
    expect(calculateProximityScore(250)).toBe(100);
    expect(calculateProximityScore(499)).toBe(100);
  });

  it('returns 0 for exactly 10,000 meters', () => {
    expect(calculateProximityScore(10_000)).toBe(0);
  });

  it('returns 0 for distances over 10,000 meters', () => {
    expect(calculateProximityScore(10_001)).toBe(0);
    expect(calculateProximityScore(50_000)).toBe(0);
    expect(calculateProximityScore(1_000_000)).toBe(0);
  });

  it('returns 50 at the midpoint (5,250m)', () => {
    // Midpoint between 500m and 10,000m is (500 + 10000) / 2 = 5250m
    const score = calculateProximityScore(5_250);
    expect(score).toBeCloseTo(50, 1);
  });

  it('returns approximately 75 at 2,875m', () => {
    // At 2875m: 100 * (10000 - 2875) / (10000 - 500) = 100 * 7125 / 9500 = 75
    const score = calculateProximityScore(2_875);
    expect(score).toBeCloseTo(75, 1);
  });

  it('returns approximately 25 at 7,625m', () => {
    // At 7625m: 100 * (10000 - 7625) / (10000 - 500) = 100 * 2375 / 9500 = 25
    const score = calculateProximityScore(7_625);
    expect(score).toBeCloseTo(25, 1);
  });

  it('decreases linearly in the interpolation range', () => {
    const score1 = calculateProximityScore(1_000);
    const score2 = calculateProximityScore(3_000);
    const score3 = calculateProximityScore(5_000);
    const score4 = calculateProximityScore(7_000);
    const score5 = calculateProximityScore(9_000);

    // Scores should strictly decrease
    expect(score1).toBeGreaterThan(score2);
    expect(score2).toBeGreaterThan(score3);
    expect(score3).toBeGreaterThan(score4);
    expect(score4).toBeGreaterThan(score5);

    // Differences between equally spaced points should be approximately equal (linearity)
    const diff12 = score1 - score2;
    const diff23 = score2 - score3;
    const diff34 = score3 - score4;
    const diff45 = score4 - score5;

    expect(diff12).toBeCloseTo(diff23, 1);
    expect(diff23).toBeCloseTo(diff34, 1);
    expect(diff34).toBeCloseTo(diff45, 1);
  });

  it('score is always between 0 and 100 for the interpolation range', () => {
    // Test several points in the interpolation range
    for (let d = 501; d < 10_000; d += 500) {
      const score = calculateProximityScore(d);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    }
  });

  it('handles boundary transition at 500m smoothly', () => {
    const at500 = calculateProximityScore(500);
    const justOver500 = calculateProximityScore(501);

    expect(at500).toBe(100);
    // Just over 500 should be very close to 100 but less
    expect(justOver500).toBeLessThan(100);
    expect(justOver500).toBeGreaterThan(99);
  });

  it('handles boundary transition at 10,000m smoothly', () => {
    const justUnder10000 = calculateProximityScore(9_999);
    const at10000 = calculateProximityScore(10_000);

    // Just under 10000 should be very close to 0 but greater
    expect(justUnder10000).toBeGreaterThan(0);
    expect(justUnder10000).toBeLessThan(1);
    expect(at10000).toBe(0);
  });
});
