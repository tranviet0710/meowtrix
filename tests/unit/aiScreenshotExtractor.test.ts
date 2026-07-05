// tests/unit/aiScreenshotExtractor.test.ts — Unit tests for the AI screenshot extractor.
//
// Validates the Gemini-backed extractor in `lib/aiScreenshotExtractor.ts`:
//   • parses valid JSON (Requirement 4.2)
//   • strips markdown fences (design § "Server Modules")
//   • deletes any verification-shaped keys — property test (Requirement 8.2)
//   • rejects Zod-invalid shapes (schema is `.strict()`)
//   • retries once on failure and returns success on the second attempt
//     (Requirements 4.6, 4.7, 4.8)

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";

// The mock for `@google/generative-ai` must be hoisted so it beats the
// import of the module under test. `vi.hoisted` lets us keep a handle to the
// mock function while making sure it's available when the factory runs.
const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: mockGenerateContent,
    }),
  })),
}));

import {
  extractFromScreenshot,
  stripVerificationKeys,
} from "@/lib/aiScreenshotExtractor";

// --- Helpers ------------------------------------------------------------------

function validResponse(overrides: Record<string, unknown> = {}) {
  return {
    pet_name: "Mochi",
    pet_type: "cat",
    description: "Small orange cat with white paws",
    last_seen_address_text: "123 Main Street",
    last_seen_at: "2024-01-15",
    contact_phone: "555-1234",
    contact_name: "Alice",
    confidences: {
      pet_name: "high",
      pet_type: "high",
      description: "medium",
      last_seen_address_text: "medium",
      last_seen_at: "low",
      contact_phone: "high",
      contact_name: "high",
    },
    pet_regions: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }],
    ...overrides,
  };
}

/** Wrap a payload as if Gemini returned it as raw JSON text. */
function textResponse(payload: unknown) {
  return { response: { text: () => JSON.stringify(payload) } };
}

/** Wrap a payload as if Gemini wrapped it in a ```json fence. */
function fencedTextResponse(payload: unknown) {
  return {
    response: {
      text: () => "```json\n" + JSON.stringify(payload) + "\n```",
    },
  };
}

const fakeBuffer = Buffer.from("fake-image");

// --- extractFromScreenshot ---------------------------------------------------

describe("extractFromScreenshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it("parses a valid JSON response into the split { fields, confidences, pet_regions } shape", async () => {
    mockGenerateContent.mockResolvedValueOnce(textResponse(validResponse()));

    const result = await extractFromScreenshot(fakeBuffer, "image/jpeg");

    expect(result.fields).toEqual({
      pet_name: "Mochi",
      pet_type: "cat",
      description: "Small orange cat with white paws",
      last_seen_address_text: "123 Main Street",
      last_seen_at: "2024-01-15",
      contact_phone: "555-1234",
      contact_name: "Alice",
    });
    expect(result.confidences.description).toBe("medium");
    expect(result.confidences.last_seen_at).toBe("low");
    expect(result.pet_regions).toEqual([
      { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
    ]);
  });

  it("strips a leading ```json code fence and a trailing ``` fence before parsing", async () => {
    mockGenerateContent.mockResolvedValueOnce(fencedTextResponse(validResponse()));
    const result = await extractFromScreenshot(fakeBuffer, "image/jpeg");
    expect(result.fields.pet_name).toBe("Mochi");
  });

  it("handles a bare ``` fence without the `json` language marker", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => "```\n" + JSON.stringify(validResponse()) + "\n```",
      },
    });
    const result = await extractFromScreenshot(fakeBuffer, "image/jpeg");
    expect(result.fields.pet_type).toBe("cat");
  });

  it("deletes verification-shaped keys the model may have leaked, then validates", async () => {
    // If the stripper did not run, `.strict()` on the schema would reject
    // the extra keys and the extractor would throw.
    const payload = {
      ...validResponse(),
      verification_name: "Should be stripped",
      verification_marking: "stripe",
      Verification_TRAIT: "extra one to catch case variants",
    };
    mockGenerateContent.mockResolvedValueOnce(textResponse(payload));

    const result = await extractFromScreenshot(fakeBuffer, "image/jpeg");

    // Payload was valid otherwise — everything survives except verification.
    expect(result.fields.pet_name).toBe("Mochi");
    expect(result.fields.pet_type).toBe("cat");
    // The public return type has no verification slot; also assert none leaked
    // via a runtime check on the whole result.
    expect(hasVerificationKey(result)).toBe(false);
  });

  it("rejects Zod-invalid shapes (invalid pet_type)", async () => {
    const bad = { ...validResponse(), pet_type: "hamster" };
    // Both attempts get the same bad payload → both parse steps throw → retry
    // loop gives up and the extractor propagates the last error.
    mockGenerateContent.mockResolvedValue(textResponse(bad));

    await expect(
      extractFromScreenshot(fakeBuffer, "image/jpeg")
    ).rejects.toThrow();
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it("rejects Zod-invalid shapes (bbox coordinate outside [0,1])", async () => {
    const bad = {
      ...validResponse(),
      pet_regions: [{ x: 0.1, y: 0.2, w: 1.5, h: 0.4 }],
    };
    mockGenerateContent.mockResolvedValue(textResponse(bad));

    await expect(
      extractFromScreenshot(fakeBuffer, "image/jpeg")
    ).rejects.toThrow();
  });

  it("rejects payloads missing the required confidences block", async () => {
    const bad: Record<string, unknown> = { ...validResponse() };
    delete bad.confidences;
    mockGenerateContent.mockResolvedValue(textResponse(bad));

    await expect(
      extractFromScreenshot(fakeBuffer, "image/jpeg")
    ).rejects.toThrow();
  });

  it("rejects payloads that are not valid JSON", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "not a json object" },
    });
    await expect(
      extractFromScreenshot(fakeBuffer, "image/jpeg")
    ).rejects.toThrow();
  });

  it("retries once on failure and returns the successful response (Req 4.6, 4.7)", async () => {
    mockGenerateContent
      .mockRejectedValueOnce(new Error("transient timeout"))
      .mockResolvedValueOnce(textResponse(validResponse()));

    const result = await extractFromScreenshot(fakeBuffer, "image/jpeg");
    expect(result.fields.pet_name).toBe("Mochi");
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it("throws after the retry when both attempts fail (Req 4.8)", async () => {
    mockGenerateContent.mockRejectedValue(new Error("permanent failure"));

    await expect(
      extractFromScreenshot(fakeBuffer, "image/jpeg")
    ).rejects.toThrow(/permanent failure/);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it("throws when the GEMINI_API_KEY environment variable is not set", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(
      extractFromScreenshot(fakeBuffer, "image/jpeg")
    ).rejects.toThrow(/GEMINI_API_KEY/);
  });
});

// --- Property test: stripVerificationKeys (Requirement 8.2) ------------------

/**
 * Walk an arbitrary JSON value and check whether any object key
 * (at any depth) contains the substring "verification" case-insensitively.
 */
function hasVerificationKey(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasVerificationKey);
  const record = value as Record<string, unknown>;
  for (const [k, v] of Object.entries(record)) {
    if (k.toLowerCase().includes("verification")) return true;
    if (hasVerificationKey(v)) return true;
  }
  return false;
}

describe("stripVerificationKeys (property)", () => {
  /**
   * **Validates: Requirements 8.2**
   *
   * For any object graph — including nested objects, arrays, and mixed keys —
   * `stripVerificationKeys` must remove every key whose lowercased name
   * contains "verification".
   */

  // Key names that ALWAYS contain "verification" in some casing.
  const verificationKeyArb = fc
    .tuple(
      fc.string({ minLength: 0, maxLength: 5 }),
      fc.constantFrom(
        "verification",
        "Verification",
        "VERIFICATION",
        "vErIfIcAtIoN"
      ),
      fc.string({ minLength: 0, maxLength: 5 })
    )
    .map(([prefix, mid, suffix]) => prefix + mid + suffix);

  // Key names that NEVER contain "verification" (case-insensitive).
  const cleanKeyArb = fc
    .string({ minLength: 1, maxLength: 10 })
    .filter((s) => !s.toLowerCase().includes("verification"));

  const jsonLeaf: fc.Arbitrary<unknown> = fc.oneof(
    fc.constant(null),
    fc.boolean(),
    fc.integer(),
    fc.string({ maxLength: 8 })
  );

  function jsonTree(depth: number): fc.Arbitrary<unknown> {
    if (depth <= 0) return jsonLeaf;
    const branch = jsonTree(depth - 1);
    return fc.oneof(
      jsonLeaf,
      fc.array(branch, { maxLength: 4 }),
      fc.dictionary(fc.oneof(cleanKeyArb, verificationKeyArb), branch, {
        minKeys: 0,
        maxKeys: 5,
      })
    );
  }

  it("removes every verification-shaped key at any depth", () => {
    fc.assert(
      fc.property(jsonTree(3), (value) => {
        // Deep-clone so shrinking doesn't observe mutations across runs.
        const cloned = JSON.parse(JSON.stringify(value));
        const stripped = stripVerificationKeys(cloned);
        expect(hasVerificationKey(stripped)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("preserves keys that do not contain 'verification'", () => {
    const input = {
      pet_name: "Mochi",
      verification_name: "DROP",
      nested: {
        verificationTrait: "DROP",
        kept: "ok",
        arr: [1, { alsoVerification: "DROP", y: 2 }],
      },
    };
    const cloned = JSON.parse(JSON.stringify(input));
    const out = stripVerificationKeys(cloned) as {
      pet_name: string;
      verification_name?: unknown;
      nested: {
        verificationTrait?: unknown;
        kept: string;
        arr: [number, { alsoVerification?: unknown; y: number }];
      };
    };

    expect(out.pet_name).toBe("Mochi");
    expect(out.verification_name).toBeUndefined();
    expect(out.nested.verificationTrait).toBeUndefined();
    expect(out.nested.kept).toBe("ok");
    expect(out.nested.arr[0]).toBe(1);
    expect(out.nested.arr[1].alsoVerification).toBeUndefined();
    expect(out.nested.arr[1].y).toBe(2);
  });

  it("returns primitives unchanged", () => {
    expect(stripVerificationKeys(null)).toBeNull();
    expect(stripVerificationKeys(42)).toBe(42);
    expect(stripVerificationKeys("hello")).toBe("hello");
    expect(stripVerificationKeys(true)).toBe(true);
  });
});
