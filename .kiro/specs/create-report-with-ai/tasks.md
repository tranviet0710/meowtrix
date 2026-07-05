# Implementation Plan

## Overview

Tasks are ordered so that each one is independently verifiable and the next task builds on top of it. Server-side pieces come first so the client can be wired against a real endpoint. The existing report forms are touched only at the very end (minimal, additive changes per the spec's non-goals).

Rough phases:

1. **Foundations** (tasks 1–3): DB migration, shared types, forward-geocoding extension.
2. **Server modules** (tasks 4–6): screenshot extractor, pet cropper, rate limiter.
3. **API route** (tasks 7–9): the extraction endpoint and its tests.
4. **Client primitives** (tasks 10–12): Modal, clipboard hook, extraction state machine.
5. **UI components** (tasks 13–17): upload zone, preview, photo picker, modal, entry button.
6. **Form integration** (tasks 18–21): imperative handles + wiring into the two report pages.
7. **Verification and polish** (tasks 22–24): client tests, property test, manual QA.

## Tasks

- [x] 1. Add `ai_extraction_events` table migration and RLS policy
  - Create `supabase/migrations/00008_add_ai_extraction_events.sql` with the schema from Data Models (id, user_id FK, created_at, index on `(user_id, created_at desc)`).
  - Enable RLS and add the `own_extraction_events_select` policy so users can only read their own rows; no user-facing INSERT policy (writes go through the service role).
  - Verify the migration applies cleanly against a fresh local Supabase instance.
  - _Requirements: 11.1_

- [x] 2. Define shared AI types in `types/ai.ts`
  - Export `ConfidenceLabel`, `ExtractedFields`, `ExtractedFieldConfidences`, `PetRegion`, `ExtractionSuccess`, `ExtractionError`, and `ExtractionResponse` exactly as declared in the Data Models section.
  - Do NOT include verification-field keys in `ExtractedFields`. Add a code comment referencing Requirement 8.
  - Add a Zod schema `extractedResponseSchema` alongside the types (or in `lib/aiScreenshotExtractor.ts`) using `.strict()` so unknown keys are rejected.
  - _Requirements: 4.2, 4.3, 4.4, 8.1_

- [x] 3. Extend `lib/geocoding.ts` with `forwardGeocode`
  - Add `ForwardGeocodeResult` interface and `forwardGeocode(addressText, locale?)` function following the same pattern as `reverseGeocode`: shared `USER_AGENT`, `AbortController` timeout at 5 seconds, silent failure returning `[]`.
  - Guard `addressText.trim().length` to `[1, 500]`; return `[]` outside that range.
  - Sort results by Nominatim `importance` descending.
  - Leave `reverseGeocode` and its call sites untouched.
  - _Requirements: 5.1, 5.2_

- [x] 4. Implement `lib/aiScreenshotExtractor.ts`
  - Reuse `GEMINI_API_KEY` and the existing `@google/generative-ai` client pattern from `lib/gemini.ts` (timeout, retry loop, markdown-fence stripping).
  - Build the extraction prompt from the design (JSON schema instructions, Vietnamese/English recognition, "never include phone/name in description").
  - Implement `extractFromScreenshot(buffer: Buffer, mimeType: string)`: single Gemini call with 30 s timeout, one retry (60 s worst case), returns `{ fields, confidences, pet_regions }`.
  - Add the **verification-field stripper**: recursively delete any key whose lowercased name contains "verification" before validating against `extractedResponseSchema.strict()`.
  - On repeated failure, throw so the route can return `extraction_error`.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 8.1, 8.2_

- [x] 5. Implement `lib/aiPetCropper.ts`
  - Export `CroppedRegion` type and `cropRegions(screenshot, regions)` using `sharp` (already a dependency).
  - Read real dimensions via `sharp.metadata()`, convert normalized bboxes to pixel coords, clamp to image bounds, discard boxes with area < 32×32 px.
  - Cap output at 5 crops (Requirement 6.1) and downscale longest edge to ≤ 640 px, encode as WebP quality 80.
  - Add a companion helper `preparePreview(screenshot)` that produces a WebP preview of the full screenshot at ≤ 720 px longest edge for the "Full screenshot" tile.
  - _Requirements: 6.1, 6.2, 6.4_

- [x] 6. Implement `lib/aiRateLimiter.ts`
  - Export `checkExtractionQuota(client, userId)` and `recordSuccessfulExtraction(client, userId)`.
  - `checkExtractionQuota` runs `select created_at from ai_extraction_events where user_id = :uid and created_at > now() - interval '24 hours' order by created_at asc` and computes `{ allowed, remaining, resets_at }` from the result.
  - `recordSuccessfulExtraction` inserts one row via the service-role client.
  - _Requirements: 11.1_

- [x] 7. Create `POST /api/ai/extract-report` route
  - New file `app/api/ai/extract-report/route.ts`.
  - Guard order from the design: auth (401) → body size (413) → parse multipart → MIME check (415) → rate-limit check (429) → `extractFromScreenshot` → `cropRegions` + `preparePreview` → `forwardGeocode` (or short-circuit on null address) → `recordSuccessfulExtraction` → return `ExtractionSuccess`.
  - Translate geocoding outcomes into the four `geocode.reason` values (`matched`, `no_address`, `no_results`, `geocoder_unavailable`) exactly as specified.
  - Convert each `CroppedRegion` buffer to a base64 data URL for the JSON response, and include `full_screenshot` in the same shape.
  - Ensure any exception path returns the error copy strings from Requirements 4.9 / 11.2 / 11.4 verbatim.
  - _Requirements: 4.6, 4.7, 4.8, 4.9, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.4, 8.1, 8.2, 11.1, 11.2, 11.3, 11.4_

- [x] 8. Add unit tests for the AI server layer
  - `tests/unit/aiScreenshotExtractor.test.ts`: parses valid JSON, strips markdown fences, deletes any verification-shaped keys (property-test with `fast-check`), rejects Zod-invalid shapes, retries once on failure.
  - `tests/unit/aiPetCropper.test.ts`: clamps out-of-bounds bboxes, discards tiny bboxes, caps at 5, downscales to ≤ 640 px.
  - `tests/unit/aiRateLimiter.test.ts`: allows first 5 in the window, blocks the 6th, ignores rows > 24 h old, computes `resets_at` from the oldest in-window event.
  - `tests/unit/geocoding.test.ts`: extend to cover `forwardGeocode` (guards, sort order, silent failure on network error).
  - _Requirements: 4.6, 4.7, 4.8, 5.1, 6.1, 8.2, 11.1_

- [x] 9. Add route test for `POST /api/ai/extract-report`
  - `tests/unit/aiExtractRoute.test.ts` covering: 401 (unauth), 413 (oversize), 415 (wrong MIME), 429 (quota at cap), 500 (`extraction_error` after retry failure), 200 happy path.
  - Assert that verification-shaped keys in a mocked Gemini response never appear in the final response body.
  - Assert `recordSuccessfulExtraction` is called on the success branch and not on any failure branch.
  - _Requirements: 4.9, 8.2, 11.1, 11.2, 11.3, 11.4_

- [x] 10. Add a minimal `Modal` primitive at `components/ui/modal.tsx`
  - Portal into `document.body`, `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`.
  - Backdrop click + ESC close.
  - Basic focus trap that cycles Tab / Shift+Tab through focusable descendants.
  - Body scroll lock while open.
  - Use design tokens only: `bg-card`, `border-border`, `text-primary`, `rounded-lg`, `shadow-md`.
  - Keep the primitive small enough to reuse for future modals but do not refactor any existing UI in this task.
  - _Requirements: 13.1, 13.2, 13.4_

- [x] 11. Implement `hooks/useClipboardImage.ts`
  - `useClipboardImage(enabled, onImage)` attaches a window-scoped `paste` listener only while `enabled` is true.
  - Iterates `event.clipboardData.items`, keeps the first `image/*` item, calls `onImage(File)`.
  - Silently ignores paste events with no image payload.
  - Detach on unmount and when `enabled` becomes false.
  - _Requirements: 2.3_

- [x] 12. Implement `hooks/useAiExtraction.ts`
  - Encapsulate the state machine from the design: `idle → uploaded → extracting → previewing → applying → error`.
  - Expose `{ state, file, result, error, actions: { setFile, analyze, apply, reset, retry } }`.
  - `analyze` performs the fetch to `POST /api/ai/extract-report` with multipart body and threads the response into `previewing`.
  - Translate `status: "rate_limited"` into an `error` state whose `retryable` flag is `false` (Requirement 11.2 says no retry on quota exhaustion).
  - _Requirements: 4.6, 4.7, 4.8, 4.9, 11.2, 12.1, 12.2, 12.3, 12.4_

- [x] 13. Build `AiAssistUploadZone`
  - New file `components/reports/AiAssistUploadZone.tsx`.
  - Three input paths: hidden file input, drag-and-drop with visual `ring-2 ring-accent/40` on hover, and clipboard paste via `useClipboardImage`.
  - Client-side MIME check against `ACCEPTED_IMAGE_TYPES` and size check against `MAX_IMAGE_SIZE_BYTES` (import from `lib/validators.ts`). Emit the exact rejection copy from Requirements 2.4 / 2.5.
  - Single-file state; replacing a file revokes the previous `URL.createObjectURL`.
  - `aria-label` and `role="button" tabIndex={0}` on the drop zone; keyboard Enter/Space triggers the picker.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 13.2, 13.3_

- [x] 14. Build `AiExtractionPreview`
  - New file `components/reports/AiExtractionPreview.tsx`.
  - Render one row per extracted field with plain-word labels (Pet name, Pet type, Description, Last-seen address, Last-seen time, Contact phone (reference), Contact name (reference)).
  - Confidence chip per row: `high` mint, `medium` amber, `low` coral. Small pill, `text-[10px]`, uppercase — one of the allowed uppercase usages.
  - Under any `low` row show the caption **"Please double-check this"** in `text-danger`.
  - Group the two contact rows under the subhead **"Contact info from the original post (added to notes)"**.
  - When `last_seen_address_text` is present, show the raw address plus one of the three geocoding banners from the design (`matched` / `no_results` / `geocoder_unavailable`).
  - _Requirements: 5.3, 5.4, 5.5, 7.1, 7.2, 9.1, 9.2, 9.5_

- [x] 15. Build `AiPhotoPicker`
  - New file `components/reports/AiPhotoPicker.tsx`.
  - Grid of tiles: up to 5 AI crops + 1 "Full screenshot" tile.
  - Toggle selection via `aria-pressed`; selection indicator is a `ring-2 ring-primary` around the tile.
  - Overlay pill in the top-left: "AI crop 1"…"AI crop 5" / "Full screenshot".
  - Enforce `[1, 5]` selected before signaling "ready to apply".
  - When zero AI crops are present, show only the full screenshot as the sole selectable tile.
  - Every tile has `alt` and `aria-pressed`.
  - _Requirements: 6.2, 6.3, 6.4, 13.3_

- [x] 16. Assemble `AiAssistModal`
  - New file `components/reports/AiAssistModal.tsx`.
  - Compose `Modal` + `AiAssistUploadZone` + `AiExtractionPreview` + `AiPhotoPicker`, driven by `useAiExtraction`.
  - Privacy notice + checkbox required before enabling **"Analyze screenshot"** (Requirement 3).
  - **"Apply to form"** button enabled only when: state is `previewing`, at least one non-null extracted field exists, and `AiPhotoPicker` reports a valid `[1, 5]` selection.
  - Description composer builds the final description string (append `"Contact from original post: <name> — <phone>"` etc.) before calling `onApply`.
  - On "Apply to form": convert each selected data URL back to a `File`, `Promise.all` POST them to `/api/upload`, collect signed URLs, then call `props.onApply({ ...fields, description: composed, photos, location })` and close the modal.
  - Focus behavior from the design: initial focus on the privacy checkbox; after extraction focus jumps to the first low-confidence field or to "Apply to form".
  - `aria-live="polite"` region announces "Reading your screenshot" on start and "Screenshot read. Review the suggestions below." on success.
  - Error banners map to the error-handling matrix, including the rate-limit case with **no** retry button and a "Fill manually" close action.
  - _Requirements: 1.3, 2.4, 2.5, 3.1, 3.2, 3.3, 4.9, 5.5, 6.5, 7.1, 7.3, 7.4, 9.1, 9.2, 9.3, 9.4, 9.5, 11.2, 12.1, 12.2, 12.3, 12.4, 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 17. Build `AiAssistButton`
  - New file `components/reports/AiAssistButton.tsx`.
  - Renders a primary button with a `Sparkles` icon (`lucide-react`) plus the secondary hint line below it.
  - Copy per variant: **"Create with AI from a screenshot"** (lost) or **"Post a sighting from a screenshot"** (spotted).
  - Owns modal open/close state; forwards `onApply` down to the modal.
  - No changes to any surrounding layout other than this one component.
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 18. Add imperative handle to `LostOverlordForm`
  - Wrap the existing component in `React.forwardRef<LostOverlordFormHandle, {}>` and export `LostOverlordFormHandle`.
  - Implement `applyAiSuggestions(values)` calling only the existing state setters for `pet_name`, `pet_type`, `description`, `last_seen_at`, `location`, `photos`. Filter out `null` / `undefined` before calling each setter.
  - Do NOT expose any verification-field setter through the handle.
  - Do not change any visible field, label, layout element, validator, or submit path.
  - _Requirements: 1.4, 1.5, 1.6, 7.4, 7.5, 8.3, 8.4, 10.1, 10.2, 10.4_

- [x] 19. Add imperative handle to `SpottedAgentForm`
  - Same pattern as task 18 with the fields `pet_type`, `description`, `sighted_at` (map from AI's `last_seen_at`), `location`, `photos`.
  - No visible change to the manual form.
  - _Requirements: 1.4, 1.5, 1.6, 7.4, 7.5, 10.1, 10.3, 10.4_

- [x] 20. Wire button + modal into `report-lost/page.tsx`
  - Convert the page to hold a `useRef<LostOverlordFormHandle>()` and pass it to `<LostOverlordForm ref={formRef} />`.
  - Mount `<AiAssistButton variant="lost" onApply={(v) => formRef.current?.applyAiSuggestions(v)} />` between the page header and the form.
  - No other changes.
  - _Requirements: 1.1, 1.4, 1.5_

- [x] 21. Wire button + modal into `report-found/page.tsx`
  - Same wiring as task 20 with `SpottedAgentForm` and `variant="spotted"`.
  - _Requirements: 1.2, 1.4, 1.5_

- [x] 22. Client tests for the modal and hook
  - `tests/unit/AiAssistModal.test.tsx`: opens with focus on privacy checkbox, ESC closes and restores focus, "Analyze screenshot" is disabled without file+consent, wrong MIME/oversize show the requirement copy, `aria-live` announces on start, closing without confirm does not invoke the form ref, "Apply to form" invokes the ref exactly once with no verification keys.
  - `tests/unit/AiPhotoPicker.test.tsx`: disable "Apply to form" at 0 or > 5 selected; when zero AI crops are returned, the full-screenshot tile is the only option.
  - `tests/unit/useAiExtraction.test.ts`: state-machine transitions from the diagram; `rate_limited` transitions to `error` with `retryable: false`.
  - _Requirements: 1.4, 1.6, 2.4, 2.5, 3.1, 3.2, 3.3, 6.3, 6.4, 7.4, 8.3, 11.2, 12.1, 12.2, 12.3, 12.4, 13.4_

- [x] 23. Property test for the description composer
  - `tests/property/aiDescriptionComposer.test.ts` using `fast-check`.
  - For any `(description, contact_phone, contact_name)` triple: the composed string starts with the description, appends a single contact line iff at least one of phone/name is non-null, and appends nothing when both are null.
  - _Requirements: 9.1, 9.2, 9.4, 9.5_

- [ ] 24. Manual QA pass (dark + light themes, VN + EN screenshots)
  - Both themes render the modal, preview rows, confidence chips, geocoding banners, and error banners correctly (design tokens only, no hardcoded hex).
  - A well-formed Vietnamese "MONG MỌI NGƯỜI GIÚP MÌNH TÌM LẠI BÉ CÚN"-style post pre-fills the Lost form with a non-null pet_type and address.
  - A well-formed English post produces the same shape.
  - A non-pet post returns `extraction_error` and leaves the form untouched.
  - The manual form remains fully editable while the modal is open: open the modal, edit a field behind it, dismiss the modal, verify the manual edit persists.
  - _Requirements: 1.5, 1.6, 4.5, 4.9, 13.1_


## Task Dependency Graph

Tasks within the same wave have no dependencies on each other and can be worked in parallel. Later waves depend on earlier ones.

```json
{
  "waves": [
    { "wave": 1, "tasks": [1, 2, 3], "description": "Foundations: DB migration, shared AI types, forward-geocoding extension" },
    { "wave": 2, "tasks": [4, 5, 6], "description": "Server modules: screenshot extractor, pet cropper, rate limiter" },
    { "wave": 3, "tasks": [7], "description": "POST /api/ai/extract-report route (fan-in of all server modules)" },
    { "wave": 4, "tasks": [8, 9, 10, 11], "description": "Server tests + client primitives (Modal, clipboard hook) — independent of each other" },
    { "wave": 5, "tasks": [12], "description": "useAiExtraction state machine (depends on the route)" },
    { "wave": 6, "tasks": [13, 14, 15], "description": "UI building blocks: upload zone, preview, photo picker" },
    { "wave": 7, "tasks": [16], "description": "Assemble AiAssistModal" },
    { "wave": 8, "tasks": [17, 18, 19], "description": "Entry button and form imperative handles (all additive, no visible form changes)" },
    { "wave": 9, "tasks": [20, 21], "description": "Wire button + modal into report-lost and report-found pages" },
    { "wave": 10, "tasks": [22, 23], "description": "Client + property tests" },
    { "wave": 11, "tasks": [24], "description": "Manual QA pass across both themes and both languages" }
  ]
}
```

```
1. DB migration ──────────────────────────────────────┐
                                                      │
2. types/ai.ts ───────────┬───► 4. aiScreenshotExtractor ─┐
                          │                               │
                          └───► 5. aiPetCropper ──────────┤
                                                          ├──► 7. /api/ai/extract-report ──► 8. server unit tests
3. lib/geocoding fwd ─────────────────────────────────────┤                                  9. route test
                                                          │
1. DB migration ─────────► 6. aiRateLimiter ──────────────┘
                                                                      │
                                                                      ▼
                                                        12. useAiExtraction
                                                                      │
                    10. Modal primitive ──┐                           │
                                          │                           │
                    11. useClipboardImage ─┼──► 13. UploadZone ───────┤
                                          │                           │
                                          ├──► 14. Preview ───────────┤
                                          │                           │
                                          └──► 15. PhotoPicker ───────┤
                                                                      │
                                                                      ▼
                                                        16. AiAssistModal
                                                                      │
                                                                      ▼
                                                        17. AiAssistButton
                                                                      │
                    18. LostOverlordForm handle ──┐                   │
                    19. SpottedAgentForm handle ──┤                   │
                                                  ▼                   ▼
                                                 20. report-lost wiring
                                                 21. report-found wiring
                                                                      │
                                                                      ▼
                                                        22. Client tests
                                                        23. Property test (composer)
                                                        24. Manual QA
```

Notes on the graph:

- Tasks **1** (migration) and **6** (rate limiter) are hard-coupled by the DB table; keep them in that order.
- Tasks **2**, **3**, **4**, **5**, and **6** have no dependencies among each other after **1** and can be worked in parallel if desired.
- Task **7** is the fan-in point: it depends on every server-side module (2–6). Do not start it until those are in place.
- Client tasks **10–17** can start any time after **7** is at least stubbed (the modal can be built against a mocked endpoint if the real one is not merged yet), but do not merge to `main` until **7** is real.
- Tasks **18** and **19** are the only touches to existing form components; they are additive (`forwardRef`+`useImperativeHandle`) and produce no visible diff, so they can be reviewed independently.
- Manual QA (task **24**) is the final gate before shipping.

## Notes

**Scope guard.** Every task must respect the non-goals in `requirements.md`: no changes to existing form fields, labels, layout, validators, submission endpoints, sidebar, or navigation. If any task looks like it needs such a change, revisit the design before proceeding.

**Design tokens only.** All new UI code must reference `bg-card`, `text-primary`, `border-border`, `bg-primary`, `text-danger`, `text-success`, `bg-accent/10`, etc. Do not introduce hardcoded hex values or arbitrary utility classes like `rounded-[2px]` or `border-[3px]` — use `rounded-md` / `rounded-lg` and `border` per the workspace design guidelines.

**Verification-field guarantee.** Requirement 8 is enforced at three layers (prompt, server stripper, client type contract). Any task that touches the extractor or the imperative handle must preserve all three; the property test in task 23 is your safety net.

**Rate-limit accounting.** Successful extractions are counted only after Gemini returns a schema-valid response (Property 6 in the design). Do not record events on any error path.

**Photos flow.** Selected crops go through the existing `POST /api/upload` unchanged — the AI endpoint never writes to Storage. Keep this separation intact when implementing task 16.

**Environment variables.** The feature reuses `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. No new secrets required. Update `.env.example` only if a new variable ever becomes necessary (not expected).

**Testing policy.** Tests in tasks 8, 9, 22, and 23 are recommended and trace back to the design's Testing Strategy. If time constrained, the highest-value tests are: property test for verification stripping (task 8), the 429/500 route tests (task 9), the description-composer property test (task 23), and the "closing modal without confirm" assertion (task 22).
