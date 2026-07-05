// lib/aiScreenshotExtractor.ts — Gemini-backed screenshot → structured fields.
//
// See `.kiro/specs/create-report-with-ai/design.md` ("Server Modules" section)
// for the authoritative behaviour. Responsibilities:
//
//   1. Send a screenshot buffer to Gemini vision with a structured prompt.
//   2. Enforce a 30-second timeout per call with a single retry
//      (60 s worst case) — mirrors the pattern in `lib/gemini.ts`.
//   3. Strip markdown fences from the raw text response.
//   4. Recursively delete any key whose lowercased name contains
//      "verification" before validating the shape — defense in depth against
//      the vision model ever leaking ownership-verification data
//      (Requirement 8.2).
//   5. Validate the stripped shape against `extractedResponseSchema.strict()`,
//      rejecting unknown keys as an additional guard.
//   6. Return the split `{ fields, confidences, pet_regions }` shape the route
//      handler wants.
//   7. Throw on repeated failure so the route can return `extraction_error`.

import { GoogleGenerativeAI } from '@google/generative-ai';

import {
  extractedResponseSchema,
  type ExtractedFieldConfidences,
  type ExtractedFields,
} from '@/types/ai';

// --- Constants ----------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2; // initial + one retry (Requirements 4.6–4.8)
const GEMINI_MODEL = 'gemini-2.5-flash';

// --- Types --------------------------------------------------------------------

export interface PetRegionBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ScreenshotExtractionResult {
  fields: ExtractedFields;
  confidences: ExtractedFieldConfidences;
  pet_regions: PetRegionBox[];
}

// --- Prompt -------------------------------------------------------------------

const EXTRACTION_PROMPT = `You are analyzing a screenshot of a social-media post (Facebook, Instagram,
Zalo, etc.) about a missing or spotted pet. The post text may be in English
or Vietnamese. Extract structured information about the pet and the post.

Return ONLY valid JSON with the following shape (no code fences, no prose):

{
  "pet_name": string | null,
  "pet_type": "cat" | "dog" | null,
  "description": string | null,
  "last_seen_address_text": string | null,
  "last_seen_at": string | null,
  "contact_phone": string | null,
  "contact_name": string | null,
  "confidences": {
    "pet_name": "high" | "medium" | "low" | null,
    "pet_type": "high" | "medium" | "low" | null,
    "description": "high" | "medium" | "low" | null,
    "last_seen_address_text": "high" | "medium" | "low" | null,
    "last_seen_at": "high" | "medium" | "low" | null,
    "contact_phone": "high" | "medium" | "low" | null,
    "contact_name": "high" | "medium" | "low" | null
  },
  "pet_regions": [
    { "x": number, "y": number, "w": number, "h": number }
  ]
}

Field rules:
- pet_name: name of the missing or spotted pet, 1–50 chars. null if not stated.
- pet_type: "cat" or "dog" only. null if the post is about a different animal
  or is ambiguous.
- description: 1–500 chars of plain prose describing the pet and situation.
  NEVER include the poster's phone number, contact name, or any personal
  contact information inside the description.
- last_seen_address_text: the address or place-name as written in the post
  (preserve the original Vietnamese or English wording). null if none.
- last_seen_at: ISO-8601 datetime or date, best effort. null if not stated.
- contact_phone: phone number as printed (do not normalize).
- contact_name: contact/poster name as printed.
- confidences: one of "high" | "medium" | "low" per field. null when the
  field itself is null.
- pet_regions: up to 5 normalized bounding boxes (each value in [0, 1]) that
  cover clearly visible pet photos in the screenshot. Empty array if no
  clear pet photo is present. Do not include the poster's avatar.

Hard rules:
- If a field is not clearly present, use null and set its confidence to null.
- Never include the poster's phone or name inside the description.
- Never emit fields not listed above. Do not include ownership-verification
  fields, do not add commentary, and do not wrap the response in code fences.`;

// --- Markdown fence stripping -------------------------------------------------

/** Strip a leading ```json / trailing ``` code fence if present. */
function stripMarkdownFence(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, '')
      .replace(/\n?```\s*$/, '');
  }
  return cleaned;
}

// --- Verification-field stripper ---------------------------------------------

/**
 * Recursively delete any key whose lowercased name contains the substring
 * "verification". Mutates and returns the input for convenience.
 *
 * This is the belt-and-suspenders layer for Requirement 8.2: the prompt
 * already tells the model not to emit these keys, and `extractedResponseSchema`
 * is `.strict()` so unknown keys would be rejected — but if the model ever
 * hallucinates a `verification_*` key we strip it *before* Zod runs so a
 * well-meaning parser can't accidentally propagate it.
 */
export function stripVerificationKeys<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      stripVerificationKeys(item);
    }
    return value;
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key.toLowerCase().includes('verification')) {
      delete record[key];
      continue;
    }
    stripVerificationKeys(record[key]);
  }
  return value;
}

// --- Parsing ------------------------------------------------------------------

/**
 * Parse the raw Gemini text into the validated
 * `{ fields, confidences, pet_regions }` shape.
 *
 * Throws when the response is not JSON, when unknown keys survive after
 * verification stripping, or when the shape fails schema validation.
 */
function parseExtractionResponse(text: string): ScreenshotExtractionResult {
  const cleaned = stripMarkdownFence(text);
  const parsed: unknown = JSON.parse(cleaned);

  // Defense in depth: strip any verification-shaped keys before Zod parses.
  stripVerificationKeys(parsed);

  const validated = extractedResponseSchema.parse(parsed);

  const fields: ExtractedFields = {
    pet_name: validated.pet_name,
    pet_type: validated.pet_type,
    description: validated.description,
    last_seen_address_text: validated.last_seen_address_text,
    last_seen_at: validated.last_seen_at,
    contact_phone: validated.contact_phone,
    contact_name: validated.contact_name,
  };

  const confidences: ExtractedFieldConfidences = {
    pet_name: validated.confidences.pet_name,
    pet_type: validated.confidences.pet_type,
    description: validated.confidences.description,
    last_seen_address_text: validated.confidences.last_seen_address_text,
    last_seen_at: validated.confidences.last_seen_at,
    contact_phone: validated.confidences.contact_phone,
    contact_name: validated.confidences.contact_name,
  };

  return {
    fields,
    confidences,
    pet_regions: validated.pet_regions,
  };
}

// --- Gemini call --------------------------------------------------------------

/**
 * One Gemini call with a 30-second timeout. Returns the raw text response
 * or throws on timeout / API error.
 */
async function callGeminiWithTimeout(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const imagePart = {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType,
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const result = await Promise.race([
      model.generateContent([EXTRACTION_PROMPT, imagePart]),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(
            new Error('Gemini API request timed out after 30 seconds')
          );
        });
      }),
    ]);

    return result.response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Public entry point -------------------------------------------------------

/**
 * Extract structured fields from a screenshot using Gemini vision.
 *
 * Performs one initial attempt and up to one retry (60 s worst case) before
 * throwing, so the route handler can translate a throw into the
 * `extraction_error` response (Requirements 4.6, 4.7, 4.8, 4.9).
 *
 * @param buffer - Raw screenshot bytes.
 * @param mimeType - `image/jpeg`, `image/png`, or `image/webp`.
 *   The caller is responsible for validating MIME upstream.
 */
export async function extractFromScreenshot(
  buffer: Buffer,
  mimeType: string
): Promise<ScreenshotExtractionResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const text = await callGeminiWithTimeout(buffer, mimeType);
      return parseExtractionResponse(text);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Fall through to retry loop; on the second failure we throw below.
    }
  }

  throw lastError ?? new Error('Gemini extraction failed after retry');
}
