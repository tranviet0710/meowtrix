import { GoogleGenerativeAI } from "@google/generative-ai";
import type { TraitTags, PatternType, FurLength } from "@/types";

const GEMINI_PROMPT = `Analyze this pet photo (cat or dog) and extract the following traits in JSON format:
- primary_color: main body color
- secondary_color: secondary color if present, null otherwise
- pattern_type: one of [solid, tabby, calico, bicolor, tortoiseshell, pointed, tuxedo, merle, brindle, spotted, sable, harlequin]
- fur_length: one of [short, medium, long]
- breed_estimate: best guess or "unknown"
- distinguishing_features: up to 5 notable physical features (eye color, ear shape, tail type, etc.)

Respond ONLY with valid JSON, no markdown formatting or code blocks.`;

const VALID_PATTERN_TYPES: PatternType[] = [
  "solid",
  "tabby",
  "calico",
  "bicolor",
  "tortoiseshell",
  "pointed",
  "tuxedo",
  "merle",
  "brindle",
  "spotted",
  "sable",
  "harlequin",
];

const VALID_FUR_LENGTHS: FurLength[] = ["short", "medium", "long"];

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Parses raw text from Gemini into a validated TraitTags object.
 * Returns null if the response cannot be parsed or is missing required fields.
 */
export function parseGeminiResponse(text: string): TraitTags | null {
  try {
    // Strip potential markdown code block wrappers
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    const parsed = JSON.parse(cleaned);

    // Validate required fields exist
    if (!parsed.primary_color || !parsed.pattern_type || !parsed.fur_length) {
      return null;
    }

    // Validate and normalize pattern_type
    const patternType = String(parsed.pattern_type).toLowerCase() as PatternType;
    if (!VALID_PATTERN_TYPES.includes(patternType)) {
      return null;
    }

    // Validate and normalize fur_length
    const furLength = String(parsed.fur_length).toLowerCase() as FurLength;
    if (!VALID_FUR_LENGTHS.includes(furLength)) {
      return null;
    }

    // Normalize distinguishing_features to array of strings, max 5
    let features: string[] = [];
    if (Array.isArray(parsed.distinguishing_features)) {
      features = parsed.distinguishing_features
        .filter((f: unknown) => typeof f === "string" && f.trim().length > 0)
        .map((f: string) => f.trim())
        .slice(0, 5);
    }

    const traitTags: TraitTags = {
      primary_color: String(parsed.primary_color).trim(),
      secondary_color: parsed.secondary_color
        ? String(parsed.secondary_color).trim()
        : null,
      pattern_type: patternType,
      fur_length: furLength,
      breed_estimate: parsed.breed_estimate
        ? String(parsed.breed_estimate).trim()
        : "unknown",
      distinguishing_features: features,
    };

    return traitTags;
  } catch (parseError) {
    const errMsg = parseError instanceof Error ? parseError.message : String(parseError);
    console.error(`[Gemini] parseGeminiResponse failed: ${errMsg}. Raw text (first 500 chars): ${text.slice(0, 500)}`);
    return null;
  }
}

/**
 * Merges an array of TraitTags (one per photo, ordered from oldest to newest upload)
 * into a single consolidated TraitTags object.
 *
 * For single-value fields: selects the most frequently occurring value.
 * On tie: selects the value from the most recently uploaded photo (last in array).
 *
 * For distinguishing_features: combines all unique features, selecting the 5 most
 * frequently mentioned if the total exceeds 5. On frequency tie: prefers features
 * from more recent photos.
 *
 * @throws Error if the input array is empty
 */
export function mergeTraitTags(tagsArray: TraitTags[]): TraitTags {
  if (tagsArray.length === 0) {
    throw new Error("Cannot merge an empty array of TraitTags");
  }

  if (tagsArray.length === 1) {
    return tagsArray[0];
  }

  return {
    primary_color: selectMostFrequent(tagsArray.map((t) => t.primary_color)),
    secondary_color: selectMostFrequentNullable(tagsArray.map((t) => t.secondary_color)),
    pattern_type: selectMostFrequent(tagsArray.map((t) => t.pattern_type)) as TraitTags["pattern_type"],
    fur_length: selectMostFrequent(tagsArray.map((t) => t.fur_length)) as TraitTags["fur_length"],
    breed_estimate: selectMostFrequent(tagsArray.map((t) => t.breed_estimate)),
    distinguishing_features: mergeFeatures(tagsArray),
  };
}

/**
 * Selects the most frequently occurring value from an array of strings.
 * Values are ordered from oldest (index 0) to newest (last index).
 * On frequency tie, the value from the most recent position (highest index) wins.
 */
function selectMostFrequent(values: string[]): string {
  // Track frequency and the latest index where each value appears
  const frequencyMap = new Map<string, { count: number; lastIndex: number }>();

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    const existing = frequencyMap.get(val);
    if (existing) {
      existing.count++;
      existing.lastIndex = i;
    } else {
      frequencyMap.set(val, { count: 1, lastIndex: i });
    }
  }

  let bestValue = values[0];
  let bestCount = 0;
  let bestLastIndex = -1;

  for (const [val, { count, lastIndex }] of frequencyMap) {
    if (
      count > bestCount ||
      (count === bestCount && lastIndex > bestLastIndex)
    ) {
      bestValue = val;
      bestCount = count;
      bestLastIndex = lastIndex;
    }
  }

  return bestValue;
}

/**
 * Selects the most frequently occurring nullable value from an array.
 * If the most frequent value is null, returns null.
 * On frequency tie, the value from the most recent position wins.
 */
function selectMostFrequentNullable(values: (string | null)[]): string | null {
  const frequencyMap = new Map<string | null, { count: number; lastIndex: number }>();

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    const key = val; // null is a valid Map key
    const existing = frequencyMap.get(key);
    if (existing) {
      existing.count++;
      existing.lastIndex = i;
    } else {
      frequencyMap.set(key, { count: 1, lastIndex: i });
    }
  }

  let bestValue: string | null = values[0];
  let bestCount = 0;
  let bestLastIndex = -1;

  for (const [val, { count, lastIndex }] of frequencyMap) {
    if (
      count > bestCount ||
      (count === bestCount && lastIndex > bestLastIndex)
    ) {
      bestValue = val;
      bestCount = count;
      bestLastIndex = lastIndex;
    }
  }

  return bestValue;
}

/**
 * Merges distinguishing_features from all tags.
 * Combines all unique features across photos, counts frequency, and returns
 * the top 5 by frequency. On frequency tie, features from more recent photos
 * (higher index in the tagsArray) are preferred.
 */
function mergeFeatures(tagsArray: TraitTags[]): string[] {
  // Track frequency and the latest photo index for each unique feature
  const featureMap = new Map<string, { count: number; lastPhotoIndex: number }>();

  for (let photoIndex = 0; photoIndex < tagsArray.length; photoIndex++) {
    const features = tagsArray[photoIndex].distinguishing_features;
    for (const feature of features) {
      const normalized = feature.toLowerCase().trim();
      const existing = featureMap.get(normalized);
      if (existing) {
        existing.count++;
        existing.lastPhotoIndex = photoIndex;
      } else {
        featureMap.set(normalized, { count: 1, lastPhotoIndex: photoIndex });
      }
    }
  }

  // Sort features: higher count first, then by later photo index for ties
  const sorted = Array.from(featureMap.entries()).sort((a, b) => {
    if (b[1].count !== a[1].count) {
      return b[1].count - a[1].count;
    }
    return b[1].lastPhotoIndex - a[1].lastPhotoIndex;
  });

  // Find the original-cased version for each selected feature
  // We use a map from normalized -> first original-case occurrence from the most recent photo
  const originalCaseMap = new Map<string, string>();
  for (let photoIndex = tagsArray.length - 1; photoIndex >= 0; photoIndex--) {
    const features = tagsArray[photoIndex].distinguishing_features;
    for (const feature of features) {
      const normalized = feature.toLowerCase().trim();
      if (!originalCaseMap.has(normalized)) {
        originalCaseMap.set(normalized, feature.trim());
      }
    }
  }

  return sorted
    .slice(0, 5)
    .map(([normalized]) => originalCaseMap.get(normalized) ?? normalized);
}

function buildValidatedImageUrl(imageUrl: string): string {
  try {
    // Minimal path validation
    if (imageUrl.includes('/../') || /\/%2e%2e\//i.test(imageUrl)) {
      throw new Error('Invalid path');
    }
    
    const url = new URL(imageUrl);
    
    // Protocol check
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }
    
    return url.href;
  } catch {
    throw new Error('Invalid URL');
  }
}

/**
 * Fetches an image from a URL and returns its base64 data and MIME type.
 */
async function fetchImageAsBase64(
  imageUrl: string
): Promise<{ base64: string; mimeType: string }> {
  const validatedUrl = buildValidatedImageUrl(imageUrl);
  const response = await fetch(validatedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  return { base64, mimeType: contentType };
}

/**
 * Sends an image to the Gemini API with a timeout.
 * Returns the raw text response or throws on timeout/error.
 */
async function callGeminiWithTimeout(imageUrl: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const { base64, mimeType } = await fetchImageAsBase64(imageUrl);

  const imagePart = {
    inlineData: {
      data: base64,
      mimeType,
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const result = await Promise.race([
      model.generateContent([GEMINI_PROMPT, imagePart]),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error("Gemini API request timed out after 30 seconds"));
        });
      }),
    ]);

    const response = result.response;
    const text = response.text();
    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extracts trait tags from a pet image using the Gemini API.
 * Implements 30-second timeout with a single retry on failure.
 *
 * @throws Error if both attempts fail (caller should mark as manual_review)
 * @returns TraitTags on success, or null if response is incomplete
 */
export async function extractTraitsFromImage(
  imageUrl: string
): Promise<TraitTags | null> {
  let lastError: Error | null = null;

  // Attempt up to 2 times (initial + 1 retry)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callGeminiWithTimeout(imageUrl);
      const traits = parseGeminiResponse(text);
      // traits can be null if response is incomplete — that's a valid return
      return traits;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to retry on first failure
    }
  }

  // Both attempts failed — throw so caller can mark as manual_review
  throw lastError ?? new Error("Gemini API failed after retry");
}
