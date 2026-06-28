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
  light: ['white', 'cream', 'ivory', 'beige', 'light grey', 'silver', 'fawn'],
  grey: ['grey', 'gray', 'silver', 'blue', 'charcoal', 'slate'],
  brown: ['brown', 'chocolate', 'tan', 'fawn', 'liver', 'chestnut'],
  orange: ['orange', 'ginger', 'red', 'rust', 'cinnamon', 'apricot', 'cream'],
  black: ['black', 'dark', 'ebony'],
  golden: ['golden', 'yellow', 'buff', 'cream', 'apricot', 'fawn'],
};

/**
 * Calculate fuzzy color similarity between two color strings.
 * - Exact match: 100
 * - Same color group: 60
 * - One color appears as substring in the other: 50
 * - Cross-reference (one's primary = other's secondary): 40
 * - No match: 0
 */
function calculateColorSimilarity(color1: string, color2: string): number {
  const c1 = color1.toLowerCase().trim();
  const c2 = color2.toLowerCase().trim();

  // Exact match
  if (c1 === c2) return 100;

  // Substring match (e.g., "light grey" contains "grey")
  if (c1.includes(c2) || c2.includes(c1)) return 70;

  // Same color group
  for (const group of Object.values(COLOR_SIMILARITY_GROUPS)) {
    const c1InGroup = group.some((g) => c1.includes(g) || g.includes(c1));
    const c2InGroup = group.some((g) => c2.includes(g) || g.includes(c2));
    if (c1InGroup && c2InGroup) return 60;
  }

  return 0;
}

/**
 * Calculate the visual similarity between two sets of trait tags.
 * Uses fuzzy color matching and cross-color comparison for robustness
 * against AI vision inconsistencies.
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

  // Primary color comparison (fuzzy)
  const primaryScore = calculateColorSimilarity(
    tags1.primary_color,
    tags2.primary_color
  );

  // Secondary color comparison (fuzzy, both null = match)
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

  // Cross-color comparison: check if colors are swapped between primary/secondary
  // (AI vision often swaps which color is "primary" vs "secondary")
  let crossColorBonus = 0;
  if (primaryScore < 60 && secondaryScore < 60) {
    const crossScore1 = sec1
      ? calculateColorSimilarity(tags1.primary_color, sec1)
      : 0;
    const crossScore2 = sec2
      ? calculateColorSimilarity(tags2.primary_color, sec2)
      : 0;
    // Check if tag1.primary matches tag2.secondary and vice versa
    const primaryVsSec2 = sec2
      ? calculateColorSimilarity(tags1.primary_color, sec2)
      : 0;
    const primaryVsSec1 = sec1
      ? calculateColorSimilarity(tags2.primary_color, sec1)
      : 0;

    if (primaryVsSec2 >= 60 && primaryVsSec1 >= 60) {
      // Colors are swapped — give partial credit
      crossColorBonus = 40;
    } else if (primaryVsSec2 >= 60 || primaryVsSec1 >= 60 || crossScore1 >= 60 || crossScore2 >= 60) {
      crossColorBonus = 25;
    }
  }

  // Pattern type comparison — related patterns get partial score
  let patternScore: number;
  if (tags1.pattern_type === tags2.pattern_type) {
    patternScore = 100;
  } else {
    // Similar pattern groups — reduced from 50 to 25 because "bicolor" and "spotted"
    // are visually very different even though both are multi-colored patterns.
    const multicolorPatterns = ['bicolor', 'calico', 'spotted', 'harlequin', 'merle'];
    const solidLikePatterns = ['solid', 'sable'];
    const stripedPatterns = ['tabby', 'brindle'];

    const p1 = tags1.pattern_type;
    const p2 = tags2.pattern_type;

    const bothMulticolor = multicolorPatterns.includes(p1) && multicolorPatterns.includes(p2);
    const bothSolid = solidLikePatterns.includes(p1) && solidLikePatterns.includes(p2);
    const bothStriped = stripedPatterns.includes(p1) && stripedPatterns.includes(p2);

    if (bothMulticolor || bothSolid || bothStriped) {
      patternScore = 25;
    } else {
      patternScore = 0;
    }
  }

  // Weighted average with cross-color bonus
  const baseScore = (primaryScore * 0.35 + secondaryScore * 0.30 + patternScore * 0.35);
  return Math.min(100, baseScore + crossColorBonus);
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
 * Calculate similarity score for other fields (breed_estimate, fur_length,
 * and distinguishing_features).
 *
 * - breed_estimate: exact match = 100, partial match (word overlap) = 60,
 *   substring = 50, explicit mismatch (both have specific breeds that differ) = -20 penalty applied to final score
 * - fur_length: exact match = 100, one step away = 40, else 0
 * - distinguishing_features: overlap ratio scaled to 100
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

  // Breed estimate scoring — more lenient with word overlap
  let breedScore = 0;
  const breed1 = tags1.breed_estimate.toLowerCase();
  const breed2 = tags2.breed_estimate.toLowerCase();

  // Words that indicate "we don't know the breed" — don't penalize these
  const unknownBreedTerms = ['unknown', 'mixed', 'mutt', 'domestic', 'n/a', ''];

  const breed1IsUnknown = unknownBreedTerms.some((term) => breed1 === term || breed1 === `${term} breed`);
  const breed2IsUnknown = unknownBreedTerms.some((term) => breed2 === term || breed2 === `${term} breed`);

  if (breed1 === breed2) {
    breedScore = 100;
  } else if (breed1.includes(breed2) || breed2.includes(breed1)) {
    breedScore = 50;
  } else if (breed1IsUnknown || breed2IsUnknown) {
    // One or both breeds are unknown — neutral score, no penalty
    breedScore = 30;
  } else {
    // Both have specific breeds that differ — check word overlap
    const words1 = new Set(breed1.split(/\s+/).filter((w) => w.length > 2 && w !== 'mix'));
    const words2 = new Set(breed2.split(/\s+/).filter((w) => w.length > 2 && w !== 'mix'));
    let overlap = 0;
    for (const word of words1) {
      if (words2.has(word)) overlap++;
    }
    const totalUniqueWords = new Set([...words1, ...words2]).size;
    if (totalUniqueWords > 0 && overlap > 0) {
      breedScore = Math.round((overlap / totalUniqueWords) * 60);
    } else {
      // Explicit breed mismatch — penalize
      breedScore = -20;
    }
  }

  // Fur length scoring — adjacent lengths get partial credit
  // short <-> medium <-> long
  const furLengthOrder: Record<string, number> = { short: 0, medium: 1, long: 2 };
  const fur1 = furLengthOrder[tags1.fur_length] ?? -1;
  const fur2 = furLengthOrder[tags2.fur_length] ?? -1;
  let furScore: number;
  if (fur1 === fur2) {
    furScore = 100;
  } else if (Math.abs(fur1 - fur2) === 1) {
    furScore = 40; // Adjacent (short↔medium, medium↔long)
  } else {
    furScore = 0;
  }

  // Distinguishing features comparison — check overlap between feature arrays
  let featuresScore = 0;
  const features1 = tags1.distinguishing_features ?? [];
  const features2 = tags2.distinguishing_features ?? [];

  if (features1.length > 0 && features2.length > 0) {
    // Fuzzy matching: check if any feature from one set appears as substring in the other
    let matchCount = 0;
    for (const f1 of features1) {
      const f1Lower = f1.toLowerCase();
      for (const f2 of features2) {
        const f2Lower = f2.toLowerCase();
        if (f1Lower === f2Lower || f1Lower.includes(f2Lower) || f2Lower.includes(f1Lower)) {
          matchCount++;
          break;
        }
      }
    }
    const totalFeatures = Math.max(features1.length, features2.length);
    featuresScore = Math.round((matchCount / totalFeatures) * 100);
  } else if (features1.length === 0 && features2.length === 0) {
    featuresScore = 50; // Both have no features — neutral
  }

  // Weighted average: breed 40%, fur 30%, features 30%
  const rawScore = breedScore * 0.40 + furScore * 0.30 + featuresScore * 0.30;
  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

/**
 * Calculate the overall match score between an Overlord and an Agent.
 *
 * Weighted formula (adjusted for AI vision inconsistencies):
 * - Visual similarity: 30% (reduced — AI tags are unreliable across different photos)
 * - Text description similarity: 30% (increased — user descriptions are high-signal)
 * - Geographical proximity: 30% (increased — nearby location is strong evidence)
 * - Other fields (breed, fur): 10%
 *
 * When description + proximity are both very high (>= 70), apply a confidence
 * boost since this strongly suggests same pet despite visual AI differences.
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

  // Base weighted score
  let overall = 
    visualScore * 0.30 +
    descriptionScore * 0.30 +
    proximityScore * 0.30 +
    otherScore * 0.10;

  // Confidence boost: when both description AND proximity are strong,
  // it's very likely the same pet even if AI vision tags differ significantly.
  // This handles cases where the pet looks different (shaved, wet, dirty, etc.)
  if (descriptionScore >= 70 && proximityScore >= 70) {
    const boost = Math.min(10, (descriptionScore + proximityScore - 140) * 0.1);
    overall += boost;
  }

  const overall_score = Math.min(100, Math.round(overall));

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
