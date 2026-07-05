// types/ai.ts — Shared types for the AI-assisted "Create report" flow.
//
// See `.kiro/specs/create-report-with-ai/design.md` (Data Models section) for the
// authoritative shapes. All values are exchanged between the client modal and the
// `POST /api/ai/extract-report` route.

import { z } from 'zod';

// --- Confidence ---------------------------------------------------------------

export type ConfidenceLabel = 'high' | 'medium' | 'low';

// --- Extracted fields ---------------------------------------------------------

/**
 * All fields the AI attempts to read from the screenshot.
 * Every field is nullable — the AI returns `null` when it cannot infer a value.
 *
 * NOTE: verification_name / verification_marking / verification_trait are
 * intentionally absent (Requirement 8). The AI never fills ownership-
 * verification fields; those keys must remain unreachable through this type
 * contract so they cannot be forwarded to the form's imperative handle.
 */
export interface ExtractedFields {
  pet_name: string | null;
  pet_type: 'cat' | 'dog' | null;
  description: string | null;
  /** Raw address string as read from the post. */
  last_seen_address_text: string | null;
  /** ISO-8601, may be a date-only. */
  last_seen_at: string | null;
  /** Reference only (Requirement 9); never written to an owner contact field. */
  contact_phone: string | null;
  /** Reference only (Requirement 9); never written to an owner contact field. */
  contact_name: string | null;
}

export type ExtractedFieldConfidences = {
  [K in keyof ExtractedFields]: ConfidenceLabel | null;
};

// --- Pet-photo regions --------------------------------------------------------

/** A candidate pet-photo region detected in the screenshot (or the full preview). */
export interface PetRegion {
  /** Stable per response (e.g. "crop-1", "crop-2", "full"). */
  id: string;
  /** "data:image/webp;base64,..." — small preview safe to embed in JSON. */
  data_url: string;
  mime_type: 'image/webp';
  width: number;
  height: number;
}

// --- Server → client responses -----------------------------------------------

export interface ExtractionSuccess {
  status: 'ok';
  fields: ExtractedFields;
  confidences: ExtractedFieldConfidences;
  /** 0 to 5 items (Requirement 6.1). */
  regions: PetRegion[];
  /** Always present so the user can pick "the whole post" (Requirement 6.4). */
  full_screenshot: PetRegion;
  geocode: {
    address_text: string | null;
    lat: number | null;
    lng: number | null;
    reason:
      | 'matched' // coords resolved successfully
      | 'no_address' // AI returned null address; no geocoding attempted
      | 'no_results' // Nominatim returned zero hits
      | 'geocoder_unavailable'; // network / timeout / service error
  };
  quota: {
    /** 0..5 after this call. */
    remaining: number;
    /** ISO-8601 (approximately 24 h after the oldest in-window event). */
    resets_at: string;
  };
}

export interface ExtractionError {
  status: 'extraction_error' | 'rate_limited' | 'invalid_input';
  /** User-facing message (already localized-ready). */
  message: string;
}

export type ExtractionResponse = ExtractionSuccess | ExtractionError;

// --- Zod schema for the raw Gemini response ----------------------------------

/**
 * Validates the raw JSON returned by the Gemini vision model in
 * `lib/aiScreenshotExtractor.ts` before it is mapped into `ExtractedFields`.
 *
 * `.strict()` on every object rejects unknown keys — this is the schema-layer
 * defense against verification-shaped keys sneaking through (Requirement 8.2).
 * The extractor also runs a name-based stripper before parsing; the strict
 * schema is the belt-and-suspenders layer.
 */
const confidenceLabelSchema = z.enum(['high', 'medium', 'low']);

const extractedFieldsSchema = z
  .object({
    pet_name: z.string().min(1).max(50).nullable(),
    pet_type: z.enum(['cat', 'dog']).nullable(),
    description: z.string().min(1).max(500).nullable(),
    last_seen_address_text: z.string().min(1).max(500).nullable(),
    last_seen_at: z.string().min(1).max(64).nullable(),
    contact_phone: z.string().min(1).max(64).nullable(),
    contact_name: z.string().min(1).max(120).nullable(),
  })
  .strict();

const extractedFieldConfidencesSchema = z
  .object({
    pet_name: confidenceLabelSchema.nullable(),
    pet_type: confidenceLabelSchema.nullable(),
    description: confidenceLabelSchema.nullable(),
    last_seen_address_text: confidenceLabelSchema.nullable(),
    last_seen_at: confidenceLabelSchema.nullable(),
    contact_phone: confidenceLabelSchema.nullable(),
    contact_name: confidenceLabelSchema.nullable(),
  })
  .strict();

const petRegionBoxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  })
  .strict();

export const extractedResponseSchema = extractedFieldsSchema
  .extend({
    confidences: extractedFieldConfidencesSchema,
    pet_regions: z.array(petRegionBoxSchema).max(5),
  })
  .strict();

export type ExtractedResponse = z.infer<typeof extractedResponseSchema>;
