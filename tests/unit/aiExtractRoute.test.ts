// tests/unit/aiExtractRoute.test.ts — Route tests for POST /api/ai/extract-report.
//
// Covers every documented failure branch plus the happy path:
//   • 401 unauthenticated                         (Requirement 11.3)
//   • 413 oversized (via Content-Length header)   (Requirement 11.4)
//   • 415 wrong MIME                              (Requirement 11.4)
//   • 429 quota at cap                            (Requirement 11.2 / 11.1)
//   • 500 extraction_error after retry failure    (Requirement 4.9)
//   • 200 happy path — plus:
//       - verification-shaped keys in the **mocked Gemini raw response**
//         never surface in the final response body. This exercises the
//         REAL `extractFromScreenshot` (with its stripper) so we test the
//         whole route pipeline as it runs in production. (Requirement 8.2)
//       - `recordSuccessfulExtraction` is called exactly once on success
//         and NOT on any failure branch (Requirement 11.1)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Hoisted mocks -----------------------------------------------------------
//
// We deliberately DO NOT mock `@/lib/aiScreenshotExtractor` — the real one
// runs so its verification-key stripper is exercised end-to-end. Instead we
// mock the underlying `@google/generative-ai` SDK. `lib/aiPetCropper` is
// mocked so we don't spin up sharp for image bytes we never inspect.

const {
  mockGetUser,
  mockGenerateContent,
  mockCropRegions,
  mockPreparePreview,
  mockCheckQuota,
  mockRecordSuccess,
  mockForwardGeocode,
  mockCreateServiceRoleClient,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGenerateContent: vi.fn(),
  mockCropRegions: vi.fn(),
  mockPreparePreview: vi.fn(),
  mockCheckQuota: vi.fn(),
  mockRecordSuccess: vi.fn(),
  mockForwardGeocode: vi.fn(),
  mockCreateServiceRoleClient: vi.fn(),
}));

vi.mock('@/lib/supabaseServer', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
  createServiceRoleClient: mockCreateServiceRoleClient,
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: mockGenerateContent,
    }),
  })),
}));

vi.mock('@/lib/aiPetCropper', () => ({
  cropRegions: mockCropRegions,
  preparePreview: mockPreparePreview,
}));

vi.mock('@/lib/aiRateLimiter', () => ({
  checkExtractionQuota: mockCheckQuota,
  recordSuccessfulExtraction: mockRecordSuccess,
}));

vi.mock('@/lib/geocoding', () => ({
  forwardGeocode: mockForwardGeocode,
}));

// Import the route AFTER the mocks are registered.
import { POST } from '@/app/api/ai/extract-report/route';
import { MAX_IMAGE_SIZE_BYTES } from '@/lib/validators';

// --- Test helpers ------------------------------------------------------------

/**
 * Build a lightweight request stub that satisfies the two surfaces the route
 * actually touches on the incoming request: `headers.get('content-length')`
 * and `await request.formData()`. Using a stub instead of a real `Request`
 * lets us set `content-length` independently of the body, which the fetch
 * runtime otherwise controls for us.
 */
function buildRequest(options: {
  contentLength?: string | null;
  formData?: FormData;
  formDataError?: Error;
} = {}) {
  const { contentLength = null, formData, formDataError } = options;

  return {
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'content-length') return contentLength;
        return null;
      },
    },
    formData: async () => {
      if (formDataError) throw formDataError;
      return formData ?? new FormData();
    },
  } as unknown as Parameters<typeof POST>[0];
}

/**
 * Build a `FormData` payload with a valid JPEG-typed file and the given
 * variant. The file bytes are irrelevant because the extractor is driven
 * by our mocked Gemini SDK.
 */
function makeFormData(overrides: {
  file?: File | null;
  variant?: string | null | 'omit';
} = {}) {
  const {
    file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'shot.jpg', {
      type: 'image/jpeg',
    }),
    variant = 'lost',
  } = overrides;

  const fd = new FormData();
  if (file) fd.append('file', file);
  if (variant !== 'omit' && variant !== null) fd.append('variant', variant);
  return fd;
}

/** Wrap a payload as if Gemini returned it as raw JSON text. */
function geminiTextResponse(payload: unknown) {
  return { response: { text: () => JSON.stringify(payload) } };
}

/**
 * A well-formed Gemini payload for the happy-path tests, **plus** verification-
 * shaped keys sprinkled at several depths. The real extractor's stripper must
 * remove every one of them before the route ever sees the parsed shape.
 */
function poisonedGeminiPayload() {
  return {
    pet_name: 'Mochi',
    pet_type: 'cat',
    description: 'Small orange cat with white paws',
    last_seen_address_text: '123 Main Street',
    last_seen_at: '2024-01-15',
    contact_phone: '555-1234',
    contact_name: 'Alice',
    confidences: {
      pet_name: 'high',
      pet_type: 'high',
      description: 'medium',
      last_seen_address_text: 'medium',
      last_seen_at: 'low',
      contact_phone: 'high',
      contact_name: 'high',
      // Extra confidence entry that must be stripped before Zod runs.
      Verification_Trait: 'low',
    },
    pet_regions: [
      { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
    ],
    // Top-level verification keys — the exact shape the extractor guards
    // against ever propagating.
    verification_name: 'LEAK',
    verification_marking: 'LEAK',
    Verification_TRAIT: 'LEAK',
  };
}

/**
 * A clean Gemini payload — same as above but without the poisoned keys. Used
 * for tests that don't care about verification stripping.
 */
function cleanGeminiPayload() {
  return {
    pet_name: 'Mochi',
    pet_type: 'cat',
    description: 'Small orange cat',
    last_seen_address_text: '123 Main Street',
    last_seen_at: '2024-01-15',
    contact_phone: '555-1234',
    contact_name: 'Alice',
    confidences: {
      pet_name: 'high',
      pet_type: 'high',
      description: 'medium',
      last_seen_address_text: 'medium',
      last_seen_at: 'low',
      contact_phone: 'high',
      contact_name: 'high',
    },
    pet_regions: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }],
  };
}

/**
 * Recursively check whether any object key (at any depth) contains
 * "verification" case-insensitively.
 */
function hasVerificationKey(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasVerificationKey);
  const record = value as Record<string, unknown>;
  for (const [k, v] of Object.entries(record)) {
    if (k.toLowerCase().includes('verification')) return true;
    if (hasVerificationKey(v)) return true;
  }
  return false;
}

/**
 * Default happy-path values for `checkExtractionQuota` — a caller within the
 * window with 4 successful calls already.
 */
function allowedQuota(remaining = 4) {
  return {
    allowed: true,
    remaining,
    resets_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

function blockedQuota() {
  return {
    allowed: false,
    remaining: 0,
    resets_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/** A single mock cropped region — the buffer bytes are irrelevant here. */
function mockCroppedRegion(id: string) {
  return {
    id,
    buffer: Buffer.from([0x00, 0x01, 0x02, 0x03]),
    mimeType: 'image/webp' as const,
    width: 320,
    height: 240,
  };
}

// --- Test suites -------------------------------------------------------------

const AUTHED_USER = { id: 'user-42', email: 'user@meowtrix.io' };

describe('POST /api/ai/extract-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The real extractor pulls the API key from the environment.
    process.env.GEMINI_API_KEY = 'test-key';
    // Sensible defaults; each test overrides what it needs.
    mockCreateServiceRoleClient.mockResolvedValue({});
    mockGetUser.mockResolvedValue({ data: { user: AUTHED_USER }, error: null });
    mockCheckQuota.mockResolvedValue(allowedQuota(4));
    mockRecordSuccess.mockResolvedValue(undefined);
    mockForwardGeocode.mockResolvedValue([]);
    mockCropRegions.mockResolvedValue([mockCroppedRegion('crop-1')]);
    mockPreparePreview.mockResolvedValue(mockCroppedRegion('full'));
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  // -- 401 -------------------------------------------------------------------

  it('returns 401 when the caller is not authenticated (Req 11.3)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'no session' },
    });

    const response = await POST(buildRequest({ formData: makeFormData() }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      status: 'invalid_input',
      message: 'Not authenticated',
    });
    // No downstream side effects on the unauth path.
    expect(mockCheckQuota).not.toHaveBeenCalled();
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockRecordSuccess).not.toHaveBeenCalled();
  });

  // -- 413 (oversize) --------------------------------------------------------

  it('returns 413 when Content-Length exceeds 5MB before any parsing (Req 11.4)', async () => {
    const oversized = String(MAX_IMAGE_SIZE_BYTES + 1);

    const response = await POST(
      buildRequest({
        contentLength: oversized,
        // If the guard fails, this FormData would be considered valid — the
        // test asserts we short-circuit BEFORE hitting it.
        formData: makeFormData(),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body).toEqual({
      status: 'invalid_input',
      message: 'Screenshot must be 5MB or smaller',
    });
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockRecordSuccess).not.toHaveBeenCalled();
  });

  // -- 415 (wrong MIME) ------------------------------------------------------

  it('returns 415 when the file MIME type is not JPEG/PNG/WebP (Req 11.4)', async () => {
    const badFile = new File(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46])],
      'notes.pdf',
      { type: 'application/pdf' }
    );

    const response = await POST(
      buildRequest({ formData: makeFormData({ file: badFile }) })
    );
    const body = await response.json();

    expect(response.status).toBe(415);
    expect(body).toEqual({
      status: 'invalid_input',
      message: 'Only JPEG, PNG, or WebP images are supported',
    });
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockRecordSuccess).not.toHaveBeenCalled();
  });

  // -- 429 (quota at cap) ----------------------------------------------------

  it('returns 429 when the caller has already used all 5 slots (Req 11.2)', async () => {
    mockCheckQuota.mockResolvedValue(blockedQuota());

    const response = await POST(buildRequest({ formData: makeFormData() }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({
      status: 'rate_limited',
      message:
        "You've reached today's AI limit. Please try again tomorrow or fill the form manually",
    });
    // The quota check must have run…
    expect(mockCheckQuota).toHaveBeenCalledTimes(1);
    // …and Gemini must NOT have been called (Req 11.1: no charge on block).
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockRecordSuccess).not.toHaveBeenCalled();
  });

  // -- 500 (extraction_error after retry failure) ----------------------------

  it('returns 500 extraction_error when both Gemini attempts fail (Req 4.9)', async () => {
    // The real extractor performs one initial attempt plus one retry.
    // Both fail → extractor throws → route returns 500 extraction_error.
    mockGenerateContent.mockRejectedValue(new Error('Gemini permanent failure'));

    const response = await POST(buildRequest({ formData: makeFormData() }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      status: 'extraction_error',
      message:
        "We couldn't read this screenshot. You can still fill the form manually",
    });
    // Both attempts consumed…
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    // …but the quota MUST NOT be charged (Req 11.1: success-only accounting).
    expect(mockRecordSuccess).not.toHaveBeenCalled();
  });

  // -- 200 (happy path) ------------------------------------------------------

  it('returns 200 with the assembled ExtractionSuccess on the happy path', async () => {
    // First quota check (before extraction) allows the call.
    // Second quota check (after recording) reflects the newly-inserted event.
    mockCheckQuota
      .mockResolvedValueOnce(allowedQuota(4))
      .mockResolvedValueOnce({
        allowed: true,
        remaining: 3,
        resets_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

    mockGenerateContent.mockResolvedValue(geminiTextResponse(cleanGeminiPayload()));
    mockForwardGeocode.mockResolvedValue([
      {
        label: '123 Main Street, Anytown',
        lat: 40.7128,
        lng: -74.006,
        importance: 0.7,
      },
    ]);

    const response = await POST(buildRequest({ formData: makeFormData() }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    // Fields survived intact through the extractor.
    expect(body.fields).toMatchObject({
      pet_name: 'Mochi',
      pet_type: 'cat',
      description: 'Small orange cat',
      last_seen_address_text: '123 Main Street',
      contact_phone: '555-1234',
      contact_name: 'Alice',
    });
    // Geocoding resolved via the mocked forwardGeocode result.
    expect(body.geocode).toMatchObject({
      address_text: '123 Main Street',
      lat: 40.7128,
      lng: -74.006,
      reason: 'matched',
    });
    // The full-screenshot preview is always present.
    expect(body.full_screenshot).toMatchObject({
      id: 'full',
      mime_type: 'image/webp',
    });
    expect(typeof body.full_screenshot.data_url).toBe('string');
    expect(body.full_screenshot.data_url.startsWith('data:image/webp;base64,'))
      .toBe(true);
    // Quota reflects the updated snapshot.
    expect(body.quota.remaining).toBe(3);

    // Success-only accounting: recordSuccessfulExtraction ran exactly once
    // with the authenticated user's id.
    expect(mockRecordSuccess).toHaveBeenCalledTimes(1);
    expect(mockRecordSuccess).toHaveBeenCalledWith(
      expect.anything(),
      AUTHED_USER.id
    );
  });

  it('geocode.reason is "no_address" when the extractor returns a null address', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiTextResponse({
        pet_name: null,
        pet_type: 'cat',
        description: 'A cat',
        last_seen_address_text: null,
        last_seen_at: null,
        contact_phone: null,
        contact_name: null,
        confidences: {
          pet_name: null,
          pet_type: 'high',
          description: 'medium',
          last_seen_address_text: null,
          last_seen_at: null,
          contact_phone: null,
          contact_name: null,
        },
        pet_regions: [],
      })
    );
    mockCropRegions.mockResolvedValue([]);

    const response = await POST(buildRequest({ formData: makeFormData() }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.geocode).toEqual({
      address_text: null,
      lat: null,
      lng: null,
      reason: 'no_address',
    });
    // We never call the geocoder when the address is null.
    expect(mockForwardGeocode).not.toHaveBeenCalled();
    // Success is still recorded.
    expect(mockRecordSuccess).toHaveBeenCalledTimes(1);
  });

  // -- Requirement 8.2: verification-shaped keys never leak ------------------

  it('never emits any verification-shaped key in the response body (Req 8.2)', async () => {
    // A raw Gemini payload with verification-shaped keys at multiple depths
    // and case variants. The real extractor's stripper is what protects the
    // route response; this test exercises that layer end-to-end.
    mockGenerateContent.mockResolvedValue(
      geminiTextResponse(poisonedGeminiPayload())
    );

    const response = await POST(buildRequest({ formData: makeFormData() }));
    const body = await response.json();

    expect(response.status).toBe(200);
    // Deep walk — no key at any depth may contain "verification" (any case).
    expect(hasVerificationKey(body)).toBe(false);
    // Sanity check: `hasVerificationKey` actually detects poisoned input, so
    // the assertion above is meaningful.
    expect(hasVerificationKey({ verificationX: 1 })).toBe(true);
    // The clean fields still survived.
    expect(body.fields.pet_name).toBe('Mochi');
    expect(body.fields.pet_type).toBe('cat');
  });
});
