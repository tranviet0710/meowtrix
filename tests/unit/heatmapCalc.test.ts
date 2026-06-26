// tests/unit/heatmapCalc.test.ts — Unit tests for heatmap radius calculation and re-centering

import { describe, it, expect } from 'vitest';
import { calculateHeatmapRadius, getHeatmapCenter } from '@/lib/heatmapCalc';

// --- calculateHeatmapRadius tests ---

describe('calculateHeatmapRadius', () => {
  it('returns null when elapsed time is 0 minutes', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    const lastSeen = new Date('2024-01-15T12:00:00Z');
    expect(calculateHeatmapRadius(lastSeen, now)).toBeNull();
  });

  it('returns null when elapsed time is exactly 30 minutes', () => {
    const now = new Date('2024-01-15T12:30:00Z');
    const lastSeen = new Date('2024-01-15T12:00:00Z');
    expect(calculateHeatmapRadius(lastSeen, now)).toBeNull();
  });

  it('returns null when elapsed time is 15 minutes', () => {
    const now = new Date('2024-01-15T12:15:00Z');
    const lastSeen = new Date('2024-01-15T12:00:00Z');
    expect(calculateHeatmapRadius(lastSeen, now)).toBeNull();
  });

  it('returns a radius just above 200m when elapsed is just over 30 minutes', () => {
    // 31 minutes = 31/60 hours ≈ 0.5167 hours → 250 * 0.5167 ≈ 129.17 → max(200, ...) = 200
    const now = new Date('2024-01-15T12:31:00Z');
    const lastSeen = new Date('2024-01-15T12:00:00Z');
    expect(calculateHeatmapRadius(lastSeen, now)).toBe(200);
  });

  it('returns minimum radius of 200m for short elapsed times', () => {
    // 45 minutes = 0.75 hours → 250 * 0.75 = 187.5 → max(200, 187.5) = 200
    const now = new Date('2024-01-15T12:45:00Z');
    const lastSeen = new Date('2024-01-15T12:00:00Z');
    expect(calculateHeatmapRadius(lastSeen, now)).toBe(200);
  });

  it('returns 250m at exactly 1 hour elapsed', () => {
    // 1 hour → 250 * 1 = 250 → max(200, min(5000, 250)) = 250
    const now = new Date('2024-01-15T13:00:00Z');
    const lastSeen = new Date('2024-01-15T12:00:00Z');
    expect(calculateHeatmapRadius(lastSeen, now)).toBe(250);
  });

  it('returns 500m at exactly 2 hours elapsed', () => {
    // 2 hours → 250 * 2 = 500
    const now = new Date('2024-01-15T14:00:00Z');
    const lastSeen = new Date('2024-01-15T12:00:00Z');
    expect(calculateHeatmapRadius(lastSeen, now)).toBe(500);
  });

  it('returns 1000m at exactly 4 hours elapsed', () => {
    // 4 hours → 250 * 4 = 1000
    const now = new Date('2024-01-15T16:00:00Z');
    const lastSeen = new Date('2024-01-15T12:00:00Z');
    expect(calculateHeatmapRadius(lastSeen, now)).toBe(1000);
  });

  it('returns 2500m at exactly 10 hours elapsed', () => {
    // 10 hours → 250 * 10 = 2500
    const now = new Date('2024-01-15T22:00:00Z');
    const lastSeen = new Date('2024-01-15T12:00:00Z');
    expect(calculateHeatmapRadius(lastSeen, now)).toBe(2500);
  });

  it('returns 5000m (max) at exactly 20 hours elapsed', () => {
    // 20 hours → 250 * 20 = 5000 → min(5000, 5000) = 5000
    const now = new Date('2024-01-16T08:00:00Z');
    const lastSeen = new Date('2024-01-15T12:00:00Z');
    expect(calculateHeatmapRadius(lastSeen, now)).toBe(5000);
  });

  it('caps at maximum 5000m for very long elapsed times', () => {
    // 48 hours → 250 * 48 = 12000 → min(5000, 12000) = 5000
    const now = new Date('2024-01-17T12:00:00Z');
    const lastSeen = new Date('2024-01-15T12:00:00Z');
    expect(calculateHeatmapRadius(lastSeen, now)).toBe(5000);
  });

  it('caps at maximum 5000m for 7 days elapsed', () => {
    const now = new Date('2024-01-22T12:00:00Z');
    const lastSeen = new Date('2024-01-15T12:00:00Z');
    expect(calculateHeatmapRadius(lastSeen, now)).toBe(5000);
  });

  it('uses current Date when now parameter is not provided', () => {
    // Create a lastSeen time 2 hours ago
    const lastSeen = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const result = calculateHeatmapRadius(lastSeen);
    // Should be approximately 500m (250 * 2)
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThanOrEqual(490);
    expect(result).toBeLessThanOrEqual(510);
  });

  it('returns correct radius for fractional hours', () => {
    // 1.5 hours → 250 * 1.5 = 375
    const now = new Date('2024-01-15T13:30:00Z');
    const lastSeen = new Date('2024-01-15T12:00:00Z');
    expect(calculateHeatmapRadius(lastSeen, now)).toBe(375);
  });

  it('returns 200 as minimum even when formula would give less', () => {
    // At 48 minutes = 0.8 hours → 250 * 0.8 = 200, exactly the minimum
    const now = new Date('2024-01-15T12:48:00Z');
    const lastSeen = new Date('2024-01-15T12:00:00Z');
    expect(calculateHeatmapRadius(lastSeen, now)).toBe(200);
  });
});

// --- getHeatmapCenter tests ---

describe('getHeatmapCenter', () => {
  const overlordLat = 13.7563;
  const overlordLng = 100.5018;

  it('returns original overlord location when no agent sightings', () => {
    const result = getHeatmapCenter(overlordLat, overlordLng, [], 1000);
    expect(result).toEqual({ lat: overlordLat, lng: overlordLng });
  });

  it('returns original overlord location when all sightings are outside radius', () => {
    // Sighting 50km away (well outside any radius ≤ 5000m)
    const sightings = [
      { lat: 14.2, lng: 101.0, sighted_at: '2024-01-15T14:00:00Z' },
    ];
    const result = getHeatmapCenter(overlordLat, overlordLng, sightings, 1000);
    expect(result).toEqual({ lat: overlordLat, lng: overlordLng });
  });

  it('re-centers on agent sighting when it falls within radius', () => {
    // Sighting very close to overlord (within 500m)
    const sightings = [
      { lat: 13.757, lng: 100.502, sighted_at: '2024-01-15T14:00:00Z' },
    ];
    const result = getHeatmapCenter(overlordLat, overlordLng, sightings, 1000);
    expect(result).toEqual({ lat: 13.757, lng: 100.502 });
  });

  it('re-centers on the most recent sighting when multiple are within radius', () => {
    const sightings = [
      { lat: 13.757, lng: 100.502, sighted_at: '2024-01-15T13:00:00Z' },
      { lat: 13.758, lng: 100.503, sighted_at: '2024-01-15T15:00:00Z' }, // most recent
      { lat: 13.756, lng: 100.501, sighted_at: '2024-01-15T14:00:00Z' },
    ];
    const result = getHeatmapCenter(overlordLat, overlordLng, sightings, 2000);
    expect(result).toEqual({ lat: 13.758, lng: 100.503 });
  });

  it('ignores sightings outside radius even if more recent', () => {
    const sightings = [
      { lat: 13.757, lng: 100.502, sighted_at: '2024-01-15T13:00:00Z' }, // within
      { lat: 14.0, lng: 101.0, sighted_at: '2024-01-15T16:00:00Z' },     // outside, more recent
    ];
    const result = getHeatmapCenter(overlordLat, overlordLng, sightings, 1000);
    expect(result).toEqual({ lat: 13.757, lng: 100.502 });
  });

  it('handles sighting at exact overlord location', () => {
    const sightings = [
      { lat: overlordLat, lng: overlordLng, sighted_at: '2024-01-15T14:00:00Z' },
    ];
    const result = getHeatmapCenter(overlordLat, overlordLng, sightings, 500);
    expect(result).toEqual({ lat: overlordLat, lng: overlordLng });
  });

  it('handles sighting at edge of radius', () => {
    // With radius 1000m, a point ~900m away should be within zone
    // At lat 13.7563, 0.009 degrees lat ≈ ~1000m
    const sightings = [
      { lat: 13.7643, lng: 100.5018, sighted_at: '2024-01-15T14:00:00Z' }, // ~890m away
    ];
    const result = getHeatmapCenter(overlordLat, overlordLng, sightings, 1000);
    expect(result).toEqual({ lat: 13.7643, lng: 100.5018 });
  });

  it('selects the latest sighting by timestamp, not position in array', () => {
    const sightings = [
      { lat: 13.758, lng: 100.503, sighted_at: '2024-01-15T16:00:00Z' }, // latest
      { lat: 13.757, lng: 100.502, sighted_at: '2024-01-15T12:00:00Z' },
      { lat: 13.756, lng: 100.501, sighted_at: '2024-01-15T14:00:00Z' },
    ];
    const result = getHeatmapCenter(overlordLat, overlordLng, sightings, 2000);
    expect(result).toEqual({ lat: 13.758, lng: 100.503 });
  });

  it('works with large radius (5000m) and distant sightings', () => {
    // Point about 4km away
    const sightings = [
      { lat: 13.792, lng: 100.502, sighted_at: '2024-01-15T14:00:00Z' }, // ~4km away
    ];
    const result = getHeatmapCenter(overlordLat, overlordLng, sightings, 5000);
    expect(result).toEqual({ lat: 13.792, lng: 100.502 });
  });

  it('works with minimum radius (200m) and very close sighting', () => {
    // Point about 100m away (0.001 degrees ≈ 111m)
    const sightings = [
      { lat: 13.7573, lng: 100.5018, sighted_at: '2024-01-15T14:00:00Z' },
    ];
    const result = getHeatmapCenter(overlordLat, overlordLng, sightings, 200);
    expect(result).toEqual({ lat: 13.7573, lng: 100.5018 });
  });
});
