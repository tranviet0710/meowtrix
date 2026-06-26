/**
 * Trait tag merging logic for multi-photo records.
 *
 * When multiple photos are uploaded for a single Overlord or Agent record,
 * trait tags from each photo are merged into a single consolidated set by:
 * - Selecting the most frequently occurring value for single-value fields
 *   (primary_color, pattern_type, fur_length, breed_estimate)
 * - Combining all unique distinguishing features, selecting the 5 most
 *   frequently mentioned if the total exceeds 5
 * - When two or more values tie in frequency for a single-value field,
 *   the value from the most recently uploaded photo wins (last in array)
 *
 * Requirements: 4.3, 4.7
 */
import type { TraitTags, PatternType, FurLength } from "@/types";

/**
 * Selects the most frequent value from an array of strings.
 * On ties, the value that appears last in the original array wins (most recent photo).
 */
function selectMostFrequent(values: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];

  const frequencyMap = new Map<string, number>();
  const lastIndex = new Map<string, number>();

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    frequencyMap.set(val, (frequencyMap.get(val) || 0) + 1);
    lastIndex.set(val, i);
  }

  let bestValue = values[0];
  let bestCount = 0;
  let bestLastIdx = -1;

  for (const [val, count] of frequencyMap) {
    const idx = lastIndex.get(val)!;
    if (
      count > bestCount ||
      (count === bestCount && idx > bestLastIdx)
    ) {
      bestValue = val;
      bestCount = count;
      bestLastIdx = idx;
    }
  }

  return bestValue;
}

/**
 * Merges an array of TraitTags from multiple photos into a single consolidated set.
 *
 * @param tagsArray - Array of TraitTags, ordered by upload time (oldest first, most recent last)
 * @returns Merged TraitTags, or null if the input array is empty
 */
export function mergeTraitTags(tagsArray: TraitTags[]): TraitTags | null {
  if (tagsArray.length === 0) return null;
  if (tagsArray.length === 1) return { ...tagsArray[0] };

  // Merge single-value fields using frequency-based selection
  const primaryColors = tagsArray.map((t) => t.primary_color);
  const patternTypes = tagsArray.map((t) => t.pattern_type);
  const furLengths = tagsArray.map((t) => t.fur_length);
  const breedEstimates = tagsArray.map((t) => t.breed_estimate);

  // Merge secondary_color: filter out nulls, then frequency-select; if all null, result is null
  const secondaryColors = tagsArray
    .map((t) => t.secondary_color)
    .filter((c): c is string => c !== null);

  // Merge distinguishing_features: combine all unique, then select top 5 by frequency
  const allFeatures: string[] = [];
  for (const tags of tagsArray) {
    for (const feature of tags.distinguishing_features) {
      allFeatures.push(feature);
    }
  }

  // Count feature frequencies and pick top 5
  const featureFrequency = new Map<string, number>();
  const featureLastIndex = new Map<string, number>();
  for (let i = 0; i < allFeatures.length; i++) {
    const f = allFeatures[i];
    featureFrequency.set(f, (featureFrequency.get(f) || 0) + 1);
    featureLastIndex.set(f, i);
  }

  // Sort by frequency descending, then by last occurrence descending for ties
  const uniqueFeatures = [...featureFrequency.keys()];
  uniqueFeatures.sort((a, b) => {
    const freqDiff = featureFrequency.get(b)! - featureFrequency.get(a)!;
    if (freqDiff !== 0) return freqDiff;
    return featureLastIndex.get(b)! - featureLastIndex.get(a)!;
  });

  const mergedFeatures = uniqueFeatures.slice(0, 5);

  return {
    primary_color: selectMostFrequent(primaryColors),
    secondary_color: secondaryColors.length > 0
      ? selectMostFrequent(secondaryColors)
      : null,
    pattern_type: selectMostFrequent(patternTypes) as PatternType,
    fur_length: selectMostFrequent(furLengths) as FurLength,
    breed_estimate: selectMostFrequent(breedEstimates),
    distinguishing_features: mergedFeatures,
  };
}
