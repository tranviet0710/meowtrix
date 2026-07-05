// lib/matchEngine.ts — Match scoring algorithm for comparing Overlord and Agent records

import { haversineDistance, calculateProximityScore } from '@/lib/geodesic';
import type { TraitTags, Overlord, Agent } from '@/types';

/**
 * Result of a match score calculation, including the overall score
 * and individual component scores.
 */
export interface MatchScoreResult {
  overall_score: number;
  visual_score: number;
  description_score: number;
  proximity_score: number;
  other_score: number;
  matched_traits: string[];
}

/**
 * Color similarity groups for fuzzy matching.
 * Colors in the same group get a partial score instead of 0.
 */
const COLOR_SIMILARITY_GROUPS: Record<string, string[]> = {
  light: ['white', 'cream', 'ivory', 'beige', 'silver', 'fawn'],
  grey: ['grey', 'gray', 'charcoal', 'slate'],
  brown: ['brown', 'chocolate', 'tan', 'liver', 'chestnut'],
  orange: ['orange', 'ginger', 'red', 'rust', 'cinnamon', 'apricot'],
  black: ['black', 'ebony'],
  golden: ['golden', 'yellow', 'buff'],
};

/**
 * Calculate color similarity between two color strings.
 * - Exact match (case-insensitive): 100
 * - Same color group: 60
 * - No match: 0
 */
function calculateColorSimilarity(color1: string, color2: string): number {
  const c1 = color1.toLowerCase().trim();
  const c2 = color2.toLowerCase().trim();

  if (c1 === c2) return 100;

  // Same color group
  for (const group of Object.values(COLOR_SIMILARITY_GROUPS)) {
    if (group.includes(c1) && group.includes(c2)) {
      return 60;
    }
  }

  return 0;
}

/**
 * Calculate the visual similarity between two sets of trait tags.
 *
 * Simple equal-weighted average of three visual fields:
 * - primary_color, secondary_color, pattern_type
 *
 * Special cases:
 * - Either tag set null → 0
 * - Both secondary_colors null → treated as a match (100)
 * - One secondary_color null, the other not → 0
 *
 * @param tags1 - First set of trait tags (or null)
 * @param tags2 - Second set of trait tags (or null)
 * @returns Score from 0 to 100
 */
export function calculateVisualSimilarity(
  tags1: TraitTags | null,
  tags2: TraitTags | null
): number {
  if (!tags1 || !tags2) {
    return 0;
  }

  // Primary color comparison
  const primaryScore = calculateColorSimilarity(
    tags1.primary_color,
    tags2.primary_color
  );

  // Secondary color comparison (both null = match)
  const sec1 = tags1.secondary_color?.toLowerCase().trim() ?? null;
  const sec2 = tags2.secondary_color?.toLowerCase().trim() ?? null;
  let secondaryScore: number;
  if (sec1 === null && sec2 === null) {
    secondaryScore = 100;
  } else if (sec1 !== null && sec2 !== null) {
    secondaryScore = calculateColorSimilarity(sec1, sec2);
  } else {
    secondaryScore = 0;
  }

  // Pattern type comparison — exact match only
  const patternScore = tags1.pattern_type === tags2.pattern_type ? 100 : 0;

  // Equal-weighted average
  return (primaryScore + secondaryScore + patternScore) / 3;
}

/**
 * Tokenize a text string by splitting on whitespace and punctuation,
 * converting to lowercase, and removing duplicates.
 *
 * @param text - Input text to tokenize
 * @returns Set of unique lowercase tokens
 */
function tokenize(text: string): Set<string> {
  if (!text || text.trim().length === 0) {
    return new Set();
  }

  const tokens = text
    .toLowerCase()
    .split(/[\s\p{P}]+/u)
    .filter((token) => token.length > 0);

  return new Set(tokens);
}

/**
 * Calculate text similarity between two descriptions using Jaccard token overlap.
 * Jaccard similarity = |intersection| / |union|, scaled to 0-100.
 *
 * @param text1 - First description text
 * @param text2 - Second description text
 * @returns Score from 0 to 100
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  // If both are empty, consider them fully similar
  if (tokens1.size === 0 && tokens2.size === 0) {
    return 100;
  }

  // If only one is empty, no similarity
  if (tokens1.size === 0 || tokens2.size === 0) {
    return 0;
  }

  // Calculate intersection
  let intersectionSize = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) {
      intersectionSize++;
    }
  }

  // Calculate union size: |A| + |B| - |A ∩ B|
  const unionSize = tokens1.size + tokens2.size - intersectionSize;

  if (unionSize === 0) {
    return 0;
  }

  // Jaccard similarity scaled to 0-100
  return (intersectionSize / unionSize) * 100;
}

/**
 * Calculate similarity score for other fields (breed_estimate and fur_length).
 *
 * Simple equal-weighted average of two fields:
 * - breed_estimate: exact (case-insensitive) match = 100, substring match = 50, else = 0
 * - fur_length: exact match = 100, else = 0
 *
 * @param tags1 - First set of trait tags (or null)
 * @param tags2 - Second set of trait tags (or null)
 * @returns Score from 0 to 100
 */
export function calculateOtherFieldsScore(
  tags1: TraitTags | null,
  tags2: TraitTags | null
): number {
  if (!tags1 || !tags2) {
    return 0;
  }

  // Breed estimate scoring
  const breed1 = tags1.breed_estimate.toLowerCase().trim();
  const breed2 = tags2.breed_estimate.toLowerCase().trim();

  let breedScore: number;
  if (breed1 === breed2) {
    breedScore = 100;
  } else if (
    breed1.length > 0 &&
    breed2.length > 0 &&
    (breed1.includes(breed2) || breed2.includes(breed1))
  ) {
    breedScore = 50;
  } else {
    breedScore = 0;
  }

  // Fur length scoring — exact match only
  const furScore = tags1.fur_length === tags2.fur_length ? 100 : 0;

  // Equal-weighted average
  return (breedScore + furScore) / 2;
}

/**
 * Calculate the overall match score between an Overlord and an Agent.
 *
 * Weighted formula (from design spec):
 * - Visual similarity: 40%
 * - Text description similarity: 25%
 * - Geographical proximity: 25%
 * - Other fields (breed, fur length): 10%
 *
 * @param overlord - The lost pet record
 * @param agent - The found pet record
 * @returns MatchScoreResult with overall and component scores
 */
export function calculateMatchScore(
  overlord: Overlord,
  agent: Agent
): MatchScoreResult {
  const visualScore = calculateVisualSimilarity(
    overlord.trait_tags,
    agent.trait_tags
  );

  const descriptionScore = calculateTextSimilarity(
    overlord.description,
    agent.description
  );

  const distance = haversineDistance(
    overlord.last_seen_lat,
    overlord.last_seen_lng,
    agent.sighting_lat,
    agent.sighting_lng
  );
  const proximityScore = calculateProximityScore(distance);

  const otherScore = calculateOtherFieldsScore(
    overlord.trait_tags,
    agent.trait_tags
  );

  // Weighted formula: visual 40%, text 25%, proximity 25%, other 10%
  const overall =
    visualScore * 0.4 +
    descriptionScore * 0.25 +
    proximityScore * 0.25 +
    otherScore * 0.1;

  const overall_score = Math.max(0, Math.min(100, Math.round(overall)));

  // Determine which traits matched for the matched_traits field
  const matched_traits: string[] = [];
  if (overlord.trait_tags && agent.trait_tags) {
    if (
      calculateColorSimilarity(
        overlord.trait_tags.primary_color,
        agent.trait_tags.primary_color
      ) >= 60
    ) {
      matched_traits.push('primary_color');
    }
    const sec1 = overlord.trait_tags.secondary_color?.toLowerCase() ?? null;
    const sec2 = agent.trait_tags.secondary_color?.toLowerCase() ?? null;
    if (sec1 !== null && sec2 !== null && calculateColorSimilarity(sec1, sec2) >= 60) {
      matched_traits.push('secondary_color');
    } else if (sec1 === null && sec2 === null) {
      matched_traits.push('secondary_color');
    }
    if (overlord.trait_tags.pattern_type === agent.trait_tags.pattern_type) {
      matched_traits.push('pattern_type');
    }
    if (overlord.trait_tags.fur_length === agent.trait_tags.fur_length) {
      matched_traits.push('fur_length');
    }
    if (
      overlord.trait_tags.breed_estimate.toLowerCase() ===
      agent.trait_tags.breed_estimate.toLowerCase()
    ) {
      matched_traits.push('breed_estimate');
    }
  }

  return {
    overall_score,
    visual_score: Math.round(visualScore),
    description_score: Math.round(descriptionScore),
    proximity_score: Math.round(proximityScore),
    other_score: Math.round(otherScore),
    matched_traits,
  };
}
