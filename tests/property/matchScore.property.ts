/**
 * Property-based tests for match score weighted formula.
 *
 * **Validates: Requirements 8.1**
 *
 * Tests that the calculateMatchScore function correctly:
 * 1. Overall score is always between 0 and 100 (inclusive)
 * 2. Overall score equals round(visual×0.40 + text×0.25 + proximity×0.25 + other×0.10)
 * 3. When all component scores are 100, overall should be 100
 * 4. When all component scores are 0, overall should be 0
 * 5. Each component score is between 0 and 100
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateMatchScore } from '@/lib/matchEngine';
import type { Overlord, Agent, TraitTags, PatternType, FurLength } from '@/types';
import {
  latitudeArb,
  longitudeArb,
  patternTypeArb,
  furLengthArb,
} from '../helpers/arbitraries';

// --- Generators ---

const colorArb = fc.constantFrom(
  'black',
  'white',
  'orange',
  'gray',
  'brown',
  'cream',
  'ginger',
  'blue'
);

const breedArb = fc.constantFrom(
  'unknown',
  'persian',
  'siamese',
  'maine coon',
  'british shorthair',
  'ragdoll',
  'bengal',
  'sphynx'
);

const featureArb = fc.constantFrom(
  'green eyes',
  'blue eyes',
  'folded ears',
  'long tail',
  'short tail',
  'round face',
  'large body',
  'small body'
);

const traitTagsArb: fc.Arbitrary<TraitTags> = fc.record({
  primary_color: colorArb,
  secondary_color: fc.oneof(colorArb, fc.constant(null)),
  pattern_type: patternTypeArb,
  fur_length: furLengthArb,
  breed_estimate: breedArb,
  distinguishing_features: fc.array(featureArb, { minLength: 0, maxLength: 5 }),
});

const descriptionWordArb = fc.constantFrom(
  'fluffy',
  'cat',
  'friendly',
  'shy',
  'playful',
  'spotted',
  'near',
  'park',
  'street',
  'lost',
  'found'
);

const descriptionArb = fc
  .array(descriptionWordArb, { minLength: 0, maxLength: 10 })
  .map((words) => words.join(' '));

function makeOverlordArb(traitTags: fc.Arbitrary<TraitTags | null>): fc.Arbitrary<Overlord> {
  return fc.record({
    id: fc.uuid(),
    owner_id: fc.uuid(),
    cat_name: fc.string({ minLength: 1, maxLength: 50 }),
    description: descriptionArb,
    last_seen_lat: latitudeArb,
    last_seen_lng: longitudeArb,
    last_seen_at: fc.constant(new Date().toISOString()),
    status: fc.constant('active' as const),
    photos: fc.constant(['photo1.jpg']),
    trait_tags: traitTags,
    tagging_status: fc.constant('complete' as const),
    verification_name: fc.constant('Whiskers'),
    verification_marking: fc.constant('white spot on chest'),
    verification_trait: fc.constant('likes belly rubs'),
    poster_url: fc.constant(null),
    is_seed: fc.constant(false),
    created_at: fc.constant(new Date().toISOString()),
  });
}

function makeAgentArb(traitTags: fc.Arbitrary<TraitTags | null>): fc.Arbitrary<Agent> {
  return fc.record({
    id: fc.uuid(),
    reporter_id: fc.uuid(),
    description: descriptionArb,
    sighting_lat: latitudeArb,
    sighting_lng: longitudeArb,
    sighted_at: fc.constant(new Date().toISOString()),
    status: fc.constant('active' as const),
    photos: fc.constant(['photo1.jpg']),
    trait_tags: traitTags,
    tagging_status: fc.constant('complete' as const),
    is_seed: fc.constant(false),
    created_at: fc.constant(new Date().toISOString()),
  });
}

// Standard generators with valid trait tags
const overlordArb = makeOverlordArb(traitTagsArb);
const agentArb = makeAgentArb(traitTagsArb);

describe('Property 8: Match score weighted formula', () => {
  it('overall score is always between 0 and 100 (inclusive)', () => {
    fc.assert(
      fc.property(overlordArb, agentArb, (overlord, agent) => {
        const result = calculateMatchScore(overlord, agent);
        return result.overall_score >= 0 && result.overall_score <= 100;
      }),
      { numRuns: 500 }
    );
  });

  it('overall score equals round(visual×0.40 + text×0.25 + proximity×0.25 + other×0.10) within rounding tolerance', () => {
    // The implementation computes overall from raw (non-rounded) component scores,
    // then rounds each component independently for display. Since we only observe
    // rounded components, the formula may differ by at most 1 due to rounding.
    fc.assert(
      fc.property(overlordArb, agentArb, (overlord, agent) => {
        const result = calculateMatchScore(overlord, agent);
        const recomputed = Math.round(
          result.visual_score * 0.40 +
            result.description_score * 0.25 +
            result.proximity_score * 0.25 +
            result.other_score * 0.10
        );
        // The difference should be at most 1 due to individual component rounding
        return Math.abs(result.overall_score - recomputed) <= 1;
      }),
      { numRuns: 500 }
    );
  });

  it('when all component scores are 100, overall should be 100', () => {
    // Create identical traits, identical descriptions, and same location
    fc.assert(
      fc.property(traitTagsArb, descriptionArb, latitudeArb, longitudeArb, (tags, desc, lat, lng) => {
        const overlord: Overlord = {
          id: 'overlord-1',
          owner_id: 'owner-1',
          cat_name: 'Test Cat',
          description: desc.length > 0 ? desc : 'a cat',
          last_seen_lat: lat,
          last_seen_lng: lng,
          last_seen_at: new Date().toISOString(),
          status: 'active',
          photos: ['photo1.jpg'],
          trait_tags: tags,
          tagging_status: 'complete',
          verification_name: 'Test',
          verification_marking: 'mark',
          verification_trait: 'trait',
          poster_url: null,
          is_seed: false,
          created_at: new Date().toISOString(),
        };
        const agent: Agent = {
          id: 'agent-1',
          reporter_id: 'reporter-1',
          description: desc.length > 0 ? desc : 'a cat',
          sighting_lat: lat,
          sighting_lng: lng,
          sighted_at: new Date().toISOString(),
          status: 'active',
          photos: ['photo1.jpg'],
          trait_tags: tags,
          tagging_status: 'complete',
          is_seed: false,
          created_at: new Date().toISOString(),
        };

        const result = calculateMatchScore(overlord, agent);
        // All components should be 100, overall should be 100
        return result.overall_score === 100;
      }),
      { numRuns: 200 }
    );
  });

  it('when all component scores are 0, overall should be 0', () => {
    // No trait tags → visual=0 and other=0
    // Empty description on one side → text=0
    // Very far apart locations → proximity=0
    const overlordNoTags = makeOverlordArb(fc.constant(null));
    const agentNoTags = makeAgentArb(fc.constant(null));

    fc.assert(
      fc.property(overlordNoTags, agentNoTags, (overlord, agent) => {
        // Force empty description on one side only (other non-empty) → text score = 0
        const o = { ...overlord, description: '' };
        const a = { ...agent, description: 'something here' };
        // Force far apart locations (>10km) → proximity = 0
        // Place overlord at North Pole, agent at South Pole
        const oFar = { ...o, last_seen_lat: 90, last_seen_lng: 0 };
        const aFar = { ...a, sighting_lat: -90, sighting_lng: 0 };

        const result = calculateMatchScore(oFar, aFar);
        return result.overall_score === 0;
      }),
      { numRuns: 200 }
    );
  });

  it('each component score is between 0 and 100', () => {
    fc.assert(
      fc.property(overlordArb, agentArb, (overlord, agent) => {
        const result = calculateMatchScore(overlord, agent);
        return (
          result.visual_score >= 0 &&
          result.visual_score <= 100 &&
          result.description_score >= 0 &&
          result.description_score <= 100 &&
          result.proximity_score >= 0 &&
          result.proximity_score <= 100 &&
          result.other_score >= 0 &&
          result.other_score <= 100
        );
      }),
      { numRuns: 500 }
    );
  });
});
