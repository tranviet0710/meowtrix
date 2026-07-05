/**
 * Property-based tests for the AI-assist description composer.
 *
 * **Validates: Requirements 9.1, 9.2, 9.4, 9.5**
 *
 * `composeDescription(fields)` (exported from `AiAssistModal`) is the pure
 * function that decides how the AI's extracted description and the
 * `contact_phone` / `contact_name` reference fields are combined into the
 * final string that gets written into the Report_Form's `description` box.
 *
 * The properties below sweep over the `(description, contact_phone,
 * contact_name)` triple and check the invariants spelled out in
 * Requirement 9:
 *
 *   • Both contact fields null  → description is left exactly as-is.
 *   • Any contact field present → exactly one "Contact from original post:"
 *                                 line is appended, containing whichever of
 *                                 name / phone were non-null.
 *   • Description null but a contact line exists → result is the contact
 *                                                   line by itself, with no
 *                                                   leading newlines.
 *   • Description null AND both contacts null    → the whole thing is null.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import { composeDescription } from "@/components/reports/AiAssistModal";
import type { ExtractedFields } from "@/types/ai";

// --- Generators --------------------------------------------------------------
//
// The composer's input contract is set by the Zod schema in `types/ai.ts`:
// each of `description`, `contact_phone`, and `contact_name` is either
// `null` or a *non-empty* string (`z.string().min(1).nullable()`). Empty
// strings are outside the input space — the extractor will never produce
// them, and the composer's internal truthy checks collapse them to
// "absent". A well-scoped property test constrains its generators to the
// actual input space (Kiro guideline: "smart generators that constrain to
// the input space intelligently"), so every non-null string here is at
// least one character long.

/** Non-null description string (`z.string().min(1).max(500)` in the schema). */
const nonEmptyDescription = fc.string({ minLength: 1, maxLength: 200 });
/** Either `null` or a non-empty description string. */
const descriptionArb = fc.option(nonEmptyDescription, { nil: null });

/** Non-null contact_phone string (`z.string().min(1).max(64)` in the schema). */
const nonEmptyPhone = fc.string({ minLength: 1, maxLength: 40 });
/** Either `null` or a non-empty phone string. */
const phoneArb = fc.option(nonEmptyPhone, { nil: null });

/** Non-null contact_name string (`z.string().min(1).max(120)` in the schema). */
const nonEmptyName = fc.string({ minLength: 1, maxLength: 60 });
/** Either `null` or a non-empty name string. */
const nameArb = fc.option(nonEmptyName, { nil: null });

/**
 * Build an `ExtractedFields` from a `(description, contact_phone,
 * contact_name)` triple. All fields the composer does not read are left
 * `null` — those keys must exist on the shape but do not influence the
 * output.
 */
function makeFields(
  description: string | null,
  contact_phone: string | null,
  contact_name: string | null,
): ExtractedFields {
  return {
    pet_name: null,
    pet_type: null,
    description,
    last_seen_address_text: null,
    last_seen_at: null,
    contact_phone,
    contact_name,
  };
}

/** How many times the contact-line marker appears in a composed string. */
function countContactMarkers(s: string): number {
  return s.split("Contact from original post:").length - 1;
}

// --- Properties --------------------------------------------------------------

describe("Property: composeDescription (AI-assist contact append)", () => {
  it("**Validates: Requirement 9.4** — both contact fields null: composed equals the AI description (null-preserving)", () => {
    /**
     * **Property:** for any description (including `null`), when both
     * `contact_phone` and `contact_name` are `null`, `composeDescription`
     * returns exactly the description it was given. In particular, a
     * `null` description with no contacts collapses to `null`.
     */
    fc.assert(
      fc.property(descriptionArb, (description) => {
        const result = composeDescription(makeFields(description, null, null));
        expect(result).toBe(description);
      }),
      { numRuns: 200 },
    );
  });

  it("**Validates: Requirements 9.1, 9.2, 9.5** — description present and at least one contact: result starts with the description and appends exactly one contact line", () => {
    /**
     * **Property:** whenever the AI description is non-null and at least
     * one of `(contact_phone, contact_name)` is non-null, the composed
     * string:
     *   1. starts with the original description verbatim,
     *   2. contains the "Contact from original post:" marker exactly once,
     *   3. separates the description and the contact line with a blank line
     *      (i.e. the marker sits immediately after `"\n\n"`).
     */
    const nonEmptyContactPair = fc
      .tuple(phoneArb, nameArb)
      .filter(([phone, name]) => phone !== null || name !== null);

    fc.assert(
      fc.property(
        nonEmptyDescription,
        nonEmptyContactPair,
        (description, [contact_phone, contact_name]) => {
          const result = composeDescription(
            makeFields(description, contact_phone, contact_name),
          );

          // Non-null description + non-null contact ⇒ must be a string.
          expect(typeof result).toBe("string");
          const composed = result as string;

          // 1. Description is preserved verbatim at the start.
          expect(composed.startsWith(description)).toBe(true);

          // 2. Exactly one contact line is appended.
          expect(countContactMarkers(composed)).toBe(1);

          // 3. The contact line is separated from the description by a
          //    single blank line ("\n\n"), per the design.md format.
          const suffix = composed.slice(description.length);
          expect(suffix.startsWith("\n\nContact from original post:")).toBe(
            true,
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it("**Validates: Requirement 9.1** — description null but at least one contact: result is the contact line only, with no leading newlines", () => {
    /**
     * **Property:** when the AI could not extract a description but at
     * least one contact field is present, the composer must still surface
     * the contact info — and it must do so without any leading whitespace
     * (there is no description to separate from).
     */
    const nonEmptyContactPair = fc
      .tuple(phoneArb, nameArb)
      .filter(([phone, name]) => phone !== null || name !== null);

    fc.assert(
      fc.property(nonEmptyContactPair, ([contact_phone, contact_name]) => {
        const result = composeDescription(
          makeFields(null, contact_phone, contact_name),
        );

        expect(typeof result).toBe("string");
        const composed = result as string;

        // Exactly one contact line, and it starts at position 0.
        expect(countContactMarkers(composed)).toBe(1);
        expect(composed.startsWith("Contact from original post:")).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("**Validates: Requirement 9.2** — contact line contains the name iff name is non-null, and the phone iff phone is non-null", () => {
    /**
     * **Property:** for every non-`(null, null)` combination of
     * `(contact_phone, contact_name)`:
     *   • the composed string contains `contact_name` when `contact_name`
     *     is non-null,
     *   • the composed string contains `contact_phone` when `contact_phone`
     *     is non-null.
     *
     * We use `.includes` (rather than a strict format check) because the
     * composer joins name and phone with an em-dash-like separator when
     * both are present — the invariant the requirement pins down is that
     * whichever fields *are* provided must appear in the output.
     */
    const nonEmptyContactPair = fc
      .tuple(phoneArb, nameArb)
      .filter(([phone, name]) => phone !== null || name !== null);

    fc.assert(
      fc.property(
        descriptionArb,
        nonEmptyContactPair,
        (description, [contact_phone, contact_name]) => {
          const result = composeDescription(
            makeFields(description, contact_phone, contact_name),
          );

          expect(typeof result).toBe("string");
          const composed = result as string;

          if (contact_name !== null) {
            expect(composed.includes(contact_name)).toBe(true);
          }
          if (contact_phone !== null) {
            expect(composed.includes(contact_phone)).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
