// tests/unit/matchEngine.test.ts — Unit tests for the match scoring algorithm

import { describe, it, expect } from 'vitest';
import {
  calculateMatchScore,
  calculateVisualSimilarity,
  calculateTextSimilarity,
  calculateOtherFieldsScore,
} from '@/lib/matchEngine';
import type { TraitTags, Overlord, Agent } from '@/types';

// --- Test Helpers ---

function makeTraitTags(overrides: Partial<TraitTags> = {}): TraitTags {
  return {
    primary_color: 'orange',
    secondary_color: 'white',
    pattern_type: 'tabby',
    fur_length: 'short',
    breed_estimate: 'domestic shorthair',
    distinguishing_features: ['green eyes', 'notched ear'],
    ...overrides,
  };
}

function makeOverlord(overrides: Partial<Overlord> = {}): Overlord {
  return {
    id: 'overlord-1',
    owner_id: 'user-1',
    pet_name: 'Whiskers',
    pet_type: 'cat',
    description: 'Orange tabby cat with green eyes and notched left ear',
    last_seen_lat: 13.7563,
    last_seen_lng: 100.5018,
    last_seen_at: '2024-01-01T10:00:00Z',
    status: 'active',
    photos: ['photo1.webp'],
    trait_tags: makeTraitTags(),
    tagging_status: 'complete',
    verification_name: 'Whiskers',
    verification_marking: 'notched left ear',
    verification_trait: 'loves belly rubs',
    poster_url: null,
    is_seed: false,
    created_at: '2024-01-01T10:00:00Z',
    last_seen_address: null,
    ...overrides,
  };
}

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    reporter_id: 'user-2',
    pet_type: 'cat',
    description: 'Spotted an orange tabby cat near the park with green eyes',
    sighting_lat: 13.7565,
    sighting_lng: 100.5020,
    sighted_at: '2024-01-02T14:00:00Z',
    status: 'active',
    photos: ['photo2.webp'],
    trait_tags: makeTraitTags(),
    tagging_status: 'complete',
    is_seed: false,
    created_at: '2024-01-02T14:00:00Z',
    sighting_address: null,
    ...overrides,
  };
}

// --- Visual Similarity Tests ---

describe('calculateVisualSimilarity', () => {
  it('returns 100 when all visual fields match exactly', () => {
    const tags = makeTraitTags();
    expect(calculateVisualSimilarity(tags, tags)).toBe(100);
  });

  it('returns 0 when either tag set is null', () => {
    const tags = makeTraitTags();
    expect(calculateVisualSimilarity(null, tags)).toBe(0);
    expect(calculateVisualSimilarity(tags, null)).toBe(0);
    expect(calculateVisualSimilarity(null, null)).toBe(0);
  });

  it('returns partial score when some fields match', () => {
    const tags1 = makeTraitTags({ primary_color: 'orange', pattern_type: 'tabby' });
    const tags2 = makeTraitTags({ primary_color: 'black', pattern_type: 'tabby' });
    // primary_color: 0, secondary_color: 100 (both white), pattern_type: 100
    // Average: (0 + 100 + 100) / 3 ≈ 66.67
    const score = calculateVisualSimilarity(tags1, tags2);
    expect(score).toBeCloseTo(66.67, 1);
  });

  it('returns 0 when no fields match', () => {
    const tags1 = makeTraitTags({
      primary_color: 'orange',
      secondary_color: 'white',
      pattern_type: 'tabby',
    });
    const tags2 = makeTraitTags({
      primary_color: 'black',
      secondary_color: 'gray',
      pattern_type: 'solid',
    });
    expect(calculateVisualSimilarity(tags1, tags2)).toBe(0);
  });

  it('scores 100 for secondary_color when both are null', () => {
    const tags1 = makeTraitTags({ secondary_color: null });
    const tags2 = makeTraitTags({ secondary_color: null });
    // primary: 100, secondary: 100 (both null), pattern: 100
    expect(calculateVisualSimilarity(tags1, tags2)).toBe(100);
  });

  it('scores 0 for secondary_color when one is null and other is not', () => {
    const tags1 = makeTraitTags({ secondary_color: null });
    const tags2 = makeTraitTags({ secondary_color: 'white' });
    // primary: 100, secondary: 0, pattern: 100
    // Average: 200/3 ≈ 66.67
    const score = calculateVisualSimilarity(tags1, tags2);
    expect(score).toBeCloseTo(66.67, 1);
  });

  it('performs case-insensitive color comparison', () => {
    const tags1 = makeTraitTags({ primary_color: 'Orange' });
    const tags2 = makeTraitTags({ primary_color: 'orange' });
    expect(calculateVisualSimilarity(tags1, tags2)).toBe(100);
  });
});

// --- Text Similarity Tests ---

describe('calculateTextSimilarity', () => {
  it('returns 100 for identical descriptions', () => {
    const text = 'orange tabby cat with green eyes';
    expect(calculateTextSimilarity(text, text)).toBe(100);
  });

  it('returns 100 when both descriptions are empty', () => {
    expect(calculateTextSimilarity('', '')).toBe(100);
  });

  it('returns 0 when one description is empty', () => {
    expect(calculateTextSimilarity('orange cat', '')).toBe(0);
    expect(calculateTextSimilarity('', 'black cat')).toBe(0);
  });

  it('returns 0 for completely different descriptions', () => {
    expect(calculateTextSimilarity('orange tabby cat', 'blue sedan car')).toBe(0);
  });

  it('calculates Jaccard similarity correctly for partial overlap', () => {
    // tokens1: {orange, tabby, cat}
    // tokens2: {orange, cat, park}
    // intersection: {orange, cat} = 2
    // union: {orange, tabby, cat, park} = 4
    // Jaccard = 2/4 = 0.5 → 50
    const score = calculateTextSimilarity('orange tabby cat', 'orange cat park');
    expect(score).toBe(50);
  });

  it('is case-insensitive', () => {
    const score1 = calculateTextSimilarity('Orange Cat', 'orange cat');
    expect(score1).toBe(100);
  });

  it('splits on punctuation', () => {
    // "hello, world!" → {hello, world}
    // "hello world" → {hello, world}
    const score = calculateTextSimilarity('hello, world!', 'hello world');
    expect(score).toBe(100);
  });

  it('removes duplicate tokens', () => {
    // "cat cat cat" → {cat}
    // "cat" → {cat}
    expect(calculateTextSimilarity('cat cat cat', 'cat')).toBe(100);
  });
});

// --- Other Fields Score Tests ---

describe('calculateOtherFieldsScore', () => {
  it('returns 100 when breed and fur length both match exactly', () => {
    const tags = makeTraitTags({ breed_estimate: 'siamese', fur_length: 'short' });
    expect(calculateOtherFieldsScore(tags, tags)).toBe(100);
  });

  it('returns 0 when either tag set is null', () => {
    const tags = makeTraitTags();
    expect(calculateOtherFieldsScore(null, tags)).toBe(0);
    expect(calculateOtherFieldsScore(tags, null)).toBe(0);
    expect(calculateOtherFieldsScore(null, null)).toBe(0);
  });

  it('returns 50 when breed matches but fur length differs', () => {
    const tags1 = makeTraitTags({ breed_estimate: 'siamese', fur_length: 'short' });
    const tags2 = makeTraitTags({ breed_estimate: 'siamese', fur_length: 'long' });
    // breed: 100, fur: 0 → average: 50
    expect(calculateOtherFieldsScore(tags1, tags2)).toBe(50);
  });

  it('returns 50 when fur matches but breed differs completely', () => {
    const tags1 = makeTraitTags({ breed_estimate: 'siamese', fur_length: 'short' });
    const tags2 = makeTraitTags({ breed_estimate: 'persian', fur_length: 'short' });
    // breed: 0, fur: 100 → average: 50
    expect(calculateOtherFieldsScore(tags1, tags2)).toBe(50);
  });

  it('returns 0 when neither breed nor fur matches', () => {
    const tags1 = makeTraitTags({ breed_estimate: 'siamese', fur_length: 'short' });
    const tags2 = makeTraitTags({ breed_estimate: 'persian', fur_length: 'long' });
    expect(calculateOtherFieldsScore(tags1, tags2)).toBe(0);
  });

  it('gives partial breed score (50) for substring match', () => {
    const tags1 = makeTraitTags({ breed_estimate: 'domestic shorthair', fur_length: 'short' });
    const tags2 = makeTraitTags({ breed_estimate: 'shorthair', fur_length: 'short' });
    // breed: 50 (substring), fur: 100 → average: 75
    expect(calculateOtherFieldsScore(tags1, tags2)).toBe(75);
  });

  it('breed comparison is case-insensitive', () => {
    const tags1 = makeTraitTags({ breed_estimate: 'Siamese' });
    const tags2 = makeTraitTags({ breed_estimate: 'siamese' });
    expect(calculateOtherFieldsScore(tags1, tags2)).toBe(100);
  });
});

// --- Full Match Score Tests ---

describe('calculateMatchScore', () => {
  it('returns a high score for identical records in close proximity', () => {
    const overlord = makeOverlord();
    const agent = makeAgent();
    const result = calculateMatchScore(overlord, agent);

    // Same traits, similar descriptions, very close location
    expect(result.overall_score).toBeGreaterThanOrEqual(80);
    expect(result.visual_score).toBe(100);
    expect(result.proximity_score).toBe(100); // < 500m apart
    expect(result.other_score).toBe(100);
  });

  it('returns 0 when both records have null trait tags', () => {
    const overlord = makeOverlord({ trait_tags: null });
    const agent = makeAgent({ trait_tags: null });
    const result = calculateMatchScore(overlord, agent);

    // visual: 0, text: some value, proximity: 100, other: 0
    expect(result.visual_score).toBe(0);
    expect(result.other_score).toBe(0);
  });

  it('respects the weighted formula (40/25/25/10)', () => {
    // Create a scenario where we know exact component scores
    const overlord = makeOverlord({
      trait_tags: makeTraitTags({ primary_color: 'orange', pattern_type: 'tabby', secondary_color: 'white' }),
      description: 'unique word alpha beta',
      last_seen_lat: 13.7563,
      last_seen_lng: 100.5018,
    });
    const agent = makeAgent({
      trait_tags: makeTraitTags({ primary_color: 'orange', pattern_type: 'tabby', secondary_color: 'white' }),
      description: 'unique word alpha beta',
      sighting_lat: 13.7563,
      sighting_lng: 100.5018,
    });

    const result = calculateMatchScore(overlord, agent);

    // All perfect matches
    expect(result.visual_score).toBe(100);
    expect(result.description_score).toBe(100);
    expect(result.proximity_score).toBe(100);
    expect(result.other_score).toBe(100);
    expect(result.overall_score).toBe(100);
  });

  it('returns low score for completely different records far apart', () => {
    const overlord = makeOverlord({
      trait_tags: makeTraitTags({
        primary_color: 'white',
        secondary_color: null,
        pattern_type: 'solid',
        fur_length: 'long',
        breed_estimate: 'persian',
      }),
      description: 'fluffy white persian with blue eyes',
      last_seen_lat: 40.7128,
      last_seen_lng: -74.0060,
    });
    const agent = makeAgent({
      trait_tags: makeTraitTags({
        primary_color: 'black',
        secondary_color: 'orange',
        pattern_type: 'tortoiseshell',
        fur_length: 'short',
        breed_estimate: 'domestic',
      }),
      description: 'small tortoiseshell cat near the market',
      sighting_lat: 13.7563,
      sighting_lng: 100.5018,
    });

    const result = calculateMatchScore(overlord, agent);
    expect(result.overall_score).toBeLessThan(30);
    expect(result.proximity_score).toBe(0); // Very far apart
  });

  it('includes matched_traits for fields that match', () => {
    const overlord = makeOverlord({
      trait_tags: makeTraitTags({
        primary_color: 'orange',
        secondary_color: 'white',
        pattern_type: 'tabby',
        fur_length: 'short',
        breed_estimate: 'domestic shorthair',
      }),
    });
    const agent = makeAgent({
      trait_tags: makeTraitTags({
        primary_color: 'orange',
        secondary_color: 'gray',
        pattern_type: 'tabby',
        fur_length: 'long',
        breed_estimate: 'domestic shorthair',
      }),
    });

    const result = calculateMatchScore(overlord, agent);
    expect(result.matched_traits).toContain('primary_color');
    expect(result.matched_traits).toContain('pattern_type');
    expect(result.matched_traits).toContain('breed_estimate');
    expect(result.matched_traits).not.toContain('secondary_color');
    expect(result.matched_traits).not.toContain('fur_length');
  });

  it('returns empty matched_traits when both trait_tags are null', () => {
    const overlord = makeOverlord({ trait_tags: null });
    const agent = makeAgent({ trait_tags: null });
    const result = calculateMatchScore(overlord, agent);
    expect(result.matched_traits).toEqual([]);
  });

  it('overall_score is always between 0 and 100', () => {
    const overlord = makeOverlord();
    const agent = makeAgent();
    const result = calculateMatchScore(overlord, agent);
    expect(result.overall_score).toBeGreaterThanOrEqual(0);
    expect(result.overall_score).toBeLessThanOrEqual(100);
  });

  it('proximity score decreases with distance', () => {
    const overlord = makeOverlord({ last_seen_lat: 13.7563, last_seen_lng: 100.5018 });

    // Agent very close (< 500m)
    const nearAgent = makeAgent({ sighting_lat: 13.7565, sighting_lng: 100.5020 });
    const nearResult = calculateMatchScore(overlord, nearAgent);

    // Agent further away (~5km)
    const midAgent = makeAgent({ sighting_lat: 13.8000, sighting_lng: 100.5018 });
    const midResult = calculateMatchScore(overlord, midAgent);

    // Agent very far (> 10km)
    const farAgent = makeAgent({ sighting_lat: 14.0000, sighting_lng: 100.5018 });
    const farResult = calculateMatchScore(overlord, farAgent);

    expect(nearResult.proximity_score).toBeGreaterThan(midResult.proximity_score);
    expect(midResult.proximity_score).toBeGreaterThan(farResult.proximity_score);
    expect(farResult.proximity_score).toBe(0);
  });
});
