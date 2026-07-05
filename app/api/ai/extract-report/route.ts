// app/api/ai/extract-report/route.ts
//
// POST /api/ai/extract-report — AI-assisted screenshot → structured field
// extraction endpoint. Called by the "Create with AI" modal on the Lost and
// Spotted report pages.
//
// See `.kiro/specs/create-report-with-ai/design.md` → "API Design" for the
// authoritative behaviour. Guard order (all guards run before we ever spend
// Gemini quota):
//
//   1. Auth                     → 401 "Not authenticated"                 (Req 11.3)
//   2. Body-size (Content-Length)→ 413 "Screenshot must be 5MB or smaller" (Req 11.4)
//   3. Multipart parse          → 400 "invalid_input"
//   4. MIME check               → 415 "Only JPEG, PNG, or WebP images are supported"
//   5. File-size defense in depth
//                               → 413 "Screenshot must be 5MB or smaller"
//   6. Variant check            → 400 "invalid_input"
//   7. Rate-limit check         → 429 "You've reached today's AI limit…"  (Req 11.2)
//   8. extractFromScreenshot    → 500 "We couldn't read this screenshot…" (Req 4.9)
//   9. cropRegions + preparePreview
//  10. forwardGeocode           (skipped when address is null → "no_address")
//  11. recordSuccessfulExtraction  (only after Gemini success)             (Req 11.1)
//  12. Re-check quota so `remaining` / `resets_at` reflect the new event.
//  13. Return `ExtractionSuccess`.
//
// Every failure copy string below matches the design & requirements exactly.

import { NextRequest, NextResponse } from 'next/server';

import { createClient, createServiceRoleClient } from '@/lib/supabaseServer';
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '@/lib/validators';
import { extractFromScreenshot } from '@/lib/aiScreenshotExtractor';
import {
  cropRegions,
  preparePreview,
  type CroppedRegion,
} from '@/lib/aiPetCropper';
import {
  checkExtractionQuota,
  recordSuccessfulExtraction,
} from '@/lib/aiRateLimiter';
import { forwardGeocode } from '@/lib/geocoding';
import type {
  ExtractionError,
  ExtractionSuccess,
  PetRegion,
} from '@/types/ai';

// --- Copy strings (verbatim from design & requirements) ---------------------

const COPY = {
  UNAUTHENTICATED: 'Not authenticated',
  OVERSIZED: 'Screenshot must be 5MB or smaller',
  WRONG_MIME: 'Only JPEG, PNG, or WebP images are supported',
  RATE_LIMITED:
    "You've reached today's AI limit. Please try again tomorrow or fill the form manually",
  EXTRACTION_ERROR:
    "We couldn't read this screenshot. You can still fill the form manually",
  MISSING_FILE: 'No screenshot was provided',
  INVALID_VARIANT: 'Invalid report variant',
} as const;

// --- Helpers ---------------------------------------------------------------

/**
 * JSON response with the `ExtractionError` shape. Kept as a helper so every
 * failure path emits exactly the same envelope.
 */
function errorResponse(
  status: number,
  body: ExtractionError
): NextResponse<ExtractionError> {
  return NextResponse.json(body, { status });
}

/**
 * Convert a `CroppedRegion` (WebP buffer) into the client-facing `PetRegion`
 * shape by base64-encoding the buffer as a data URL.
 */
function croppedRegionToPetRegion(region: CroppedRegion): PetRegion {
  return {
    id: region.id,
    data_url: `data:image/webp;base64,${region.buffer.toString('base64')}`,
    mime_type: region.mimeType,
    width: region.width,
    height: region.height,
  };
}

/**
 * Resolve the four geocoding outcomes documented in the design:
 *
 *   - `no_address`         when the AI returned no address text.
 *   - `matched`            when Nominatim returned at least one hit.
 *   - `no_results`         when Nominatim returned an empty list.
 *   - `geocoder_unavailable` when the call threw (network / timeout / etc).
 *
 * `forwardGeocode` currently swallows errors and returns `[]`, so the
 * `geocoder_unavailable` branch here is defensive: if a future refactor lets
 * exceptions propagate we still degrade correctly. Requirement 5.4 mandates
 * we distinguish "no results" from "service unavailable" — this function is
 * the single place that mapping happens.
 */
async function resolveGeocode(
  addressText: string | null
): Promise<ExtractionSuccess['geocode']> {
  if (!addressText || addressText.trim().length === 0) {
    return { address_text: null, lat: null, lng: null, reason: 'no_address' };
  }

  try {
    const results = await forwardGeocode(addressText);
    if (results.length === 0) {
      return {
        address_text: addressText,
        lat: null,
        lng: null,
        reason: 'no_results',
      };
    }
    const top = results[0];
    return {
      address_text: addressText,
      lat: top.lat,
      lng: top.lng,
      reason: 'matched',
    };
  } catch {
    return {
      address_text: addressText,
      lat: null,
      lng: null,
      reason: 'geocoder_unavailable',
    };
  }
}

// --- Route handler ---------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Auth (401)
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(401, {
      status: 'invalid_input',
      message: COPY.UNAUTHENTICATED,
    });
  }

  // 2. Body size (413) via Content-Length header — bail before parsing.
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader != null) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SIZE_BYTES) {
      return errorResponse(413, {
        status: 'invalid_input',
        message: COPY.OVERSIZED,
      });
    }
  }

  // 3. Parse multipart body.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(400, {
      status: 'invalid_input',
      message: COPY.MISSING_FILE,
    });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return errorResponse(400, {
      status: 'invalid_input',
      message: COPY.MISSING_FILE,
    });
  }

  // 4. MIME check (415) — evaluate BEFORE the per-file size guard so the
  //    caller learns the more specific reason first.
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return errorResponse(415, {
      status: 'invalid_input',
      message: COPY.WRONG_MIME,
    });
  }

  // 5. File size — defense in depth in case Content-Length was missing or lied.
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return errorResponse(413, {
      status: 'invalid_input',
      message: COPY.OVERSIZED,
    });
  }

  // 6. Variant — used only for analytics/logging today, but validate so a
  //    typo doesn't silently mean "lost".
  const variantRaw = formData.get('variant');
  const variant = typeof variantRaw === 'string' ? variantRaw : null;
  if (variant !== 'lost' && variant !== 'spotted') {
    return errorResponse(400, {
      status: 'invalid_input',
      message: COPY.INVALID_VARIANT,
    });
  }

  // 7. Rate-limit (429).
  //
  // Use the service-role client so the same client can both read the quota
  // and (later) insert the success event. The read filters by `user_id` so
  // bypassing RLS is harmless.
  let serviceClient;
  try {
    serviceClient = await createServiceRoleClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai/extract-report] Service client init failed: ${message}`);
    return errorResponse(500, {
      status: 'extraction_error',
      message: COPY.EXTRACTION_ERROR,
    });
  }

  let quota;
  try {
    quota = await checkExtractionQuota(serviceClient, user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai/extract-report] Quota check failed: ${message}`);
    return errorResponse(500, {
      status: 'extraction_error',
      message: COPY.EXTRACTION_ERROR,
    });
  }

  if (!quota.allowed) {
    return errorResponse(429, {
      status: 'rate_limited',
      message: COPY.RATE_LIMITED,
    });
  }

  // 8. Read the file bytes once for both extraction and cropping.
  let buffer: Buffer;
  try {
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai/extract-report] Failed to read upload: ${message}`);
    return errorResponse(500, {
      status: 'extraction_error',
      message: COPY.EXTRACTION_ERROR,
    });
  }

  // 9. Gemini extraction (with a single internal retry). Any throw here
  //    becomes the requirement-4.9 `extraction_error` response; the quota is
  //    NOT charged because we never reach `recordSuccessfulExtraction`.
  let extraction;
  try {
    extraction = await extractFromScreenshot(buffer, file.type);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai/extract-report] Extraction failed: ${message}`);
    return errorResponse(500, {
      status: 'extraction_error',
      message: COPY.EXTRACTION_ERROR,
    });
  }

  // 10. Crop pet regions + prepare the full-screenshot preview in parallel.
  //     Both operations are pure sharp calls; failure of either falls back to
  //     the `extraction_error` copy because we can't render the picker without
  //     at least the full preview.
  let regions: CroppedRegion[];
  let fullPreview: CroppedRegion;
  try {
    [regions, fullPreview] = await Promise.all([
      cropRegions(buffer, extraction.pet_regions),
      preparePreview(buffer),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai/extract-report] Image processing failed: ${message}`);
    return errorResponse(500, {
      status: 'extraction_error',
      message: COPY.EXTRACTION_ERROR,
    });
  }

  // 11. Forward-geocode the address text (or short-circuit to `no_address`).
  const geocode = await resolveGeocode(extraction.fields.last_seen_address_text);

  // 12. Record the successful extraction (Req 11.1: only successful calls
  //     count). If recording fails we still return the extraction — the user
  //     shouldn't be penalized twice for a database blip — but log loudly.
  try {
    await recordSuccessfulExtraction(serviceClient, user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[ai/extract-report] Failed to record extraction event for user ${user.id}: ${message}`
    );
  }

  // 13. Re-query the quota so `remaining` / `resets_at` reflect the row we
  //     just inserted. If the re-check fails we fall back to a local
  //     decrement of the pre-call snapshot — either representation is valid
  //     per the design's "or decrement locally" note.
  let updatedQuota;
  try {
    updatedQuota = await checkExtractionQuota(serviceClient, user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai/extract-report] Quota re-check failed: ${message}`);
    updatedQuota = {
      allowed: quota.remaining - 1 > 0,
      remaining: Math.max(0, quota.remaining - 1),
      resets_at: quota.resets_at,
    };
  }

  // 14. Assemble the response.
  const success: ExtractionSuccess = {
    status: 'ok',
    fields: extraction.fields,
    confidences: extraction.confidences,
    regions: regions.map(croppedRegionToPetRegion),
    full_screenshot: croppedRegionToPetRegion(fullPreview),
    geocode,
    quota: {
      remaining: updatedQuota.remaining,
      resets_at: updatedQuota.resets_at,
    },
  };

  return NextResponse.json(success);
}
