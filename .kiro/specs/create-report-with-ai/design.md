# Design Document

## Overview

This design adds an AI-assisted screenshot-to-report pathway that pre-fills the existing Lost Pet Report form (`LostOverlordForm`) and Spotted Pet Report form (`SpottedAgentForm`) from a single social-media screenshot. The feature is layered strictly on top of the current implementation: no existing form field, validator, or submission endpoint changes. All AI plumbing lives behind a modal that opens from a new "Create with AI" button on each report page and closes once the user confirms the suggestions.

The design has three cooperating layers:

1. **Client (Modal + Form integration).** A React modal (`AiAssistModal`) drives upload, privacy consent, extraction, preview, and photo selection. The two existing forms gain an imperative handle (`applyAiSuggestions`) so the modal can push values in without lifting state or changing the visible form.
2. **Server (Extraction API).** A new route `POST /api/ai/extract-report` performs auth, per-user rate-limit accounting, Gemini vision extraction, server-side pet-region cropping, verification-field stripping, and forward geocoding of the extracted address.
3. **Storage & data.** A new `ai_extraction_events` table records each successful extraction for the rolling-24h quota. No new report tables. Existing `POST /api/upload` and existing `POST /api/overlords` / `POST /api/agents` are re-used unchanged.

Vietnamese and English are supported by Gemini natively; no separate model or translation layer is introduced.

## Architecture

### High-level flow

```
┌───────────────────────────────────────────────────────────────────────────┐
│                     Report page (Lost or Spotted)                         │
│                                                                           │
│  ┌────────────────────┐        ┌──────────────────────────────────────┐   │
│  │ "Create with AI"   │  open  │  AiAssistModal                       │   │
│  │  button (above     │───────►│  1. Privacy notice + checkbox        │   │
│  │  the manual form)  │        │  2. Upload zone (file / drop / paste)│   │
│  └────────────────────┘        │  3. Analyze screenshot ──┐           │   │
│                                │  4. Preview + photo picker           │   │
│                                │  5. Apply to form ────┐  │           │   │
│                                └───────────────────────┼──┼───────────┘   │
│                                                        │  │               │
│                    imperative handle: applyAiSuggestions  │               │
│                                                        │  │               │
│  ┌─────────────────────────────────────────────────────▼──▼───────────┐   │
│  │  LostOverlordForm / SpottedAgentForm  (unchanged fields/labels)   │   │
│  │  - populated pet_name, pet_type, description, location, date …    │   │
│  │  - verification fields untouched                                  │   │
│  │  - user reviews → submits via existing endpoints                  │   │
│  └───────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
                                     │
                    POST /api/ai/extract-report  (auth, quota, extract)
                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                   app/api/ai/extract-report/route.ts                      │
│                                                                           │
│  1. Auth via Supabase (401 if unauthenticated)                            │
│  2. Body size guard (413 if > 5 MB)                                       │
│  3. Rate limiter (429 if > 5 successful in rolling 24 h)                  │
│  4. lib/aiScreenshotExtractor.extractFromScreenshot(imageBuffer)          │
│         → Gemini vision, 30s timeout, 1 retry                             │
│         → structured JSON: fields + pet regions + confidence              │
│         → verification-field stripper (defense in depth)                  │
│  5. lib/aiPetCropper.cropRegions(imageBuffer, regions)                    │
│         → sharp-based crops → base64 data URLs (limit 5)                  │
│  6. lib/geocoding.forwardGeocode(address_text)                            │
│         → coordinates or null                                             │
│  7. Record successful extraction in ai_extraction_events                  │
│  8. Return ExtractionResult                                               │
└───────────────────────────────────────────────────────────────────────────┘

    On "Apply to form":
                                     │
             POST /api/upload  (once per selected crop)  ── existing route
                                     ▼
                        signed URL for cat-photos bucket
                                     │
                      applyAiSuggestions({...}) on the form
                                     ▼
                        User reviews → normal submit
                                     ▼
              POST /api/overlords  or  POST /api/agents  (unchanged)
```

### Module map

New files:

- `components/reports/AiAssistButton.tsx` — small opener button, one instance per report page.
- `components/reports/AiAssistModal.tsx` — the modal shell (variant `"lost" | "spotted"`).
- `components/reports/AiAssistUploadZone.tsx` — accepts file, drag-drop, clipboard paste.
- `components/reports/AiExtractionPreview.tsx` — the field-preview list with confidence chips.
- `components/reports/AiPhotoPicker.tsx` — thumbnails of AI crops + full screenshot, selection state.
- `hooks/useClipboardImage.ts` — paste handler that ignores non-image clipboard payloads.
- `hooks/useAiExtraction.ts` — client-side state machine (idle → uploading → extracting → previewing → applying → error).
- `lib/aiScreenshotExtractor.ts` — Gemini call, prompt, JSON schema validation, verification-field stripper.
- `lib/aiPetCropper.ts` — sharp-based bounding-box cropping and base64 encoding.
- `lib/aiRateLimiter.ts` — read + write for `ai_extraction_events`, rolling-24 h counter.
- `lib/geocoding.ts` — **extend** with `forwardGeocode(text)`; existing `reverseGeocode` untouched.
- `app/api/ai/extract-report/route.ts` — the single new server endpoint.
- `supabase/migrations/00008_add_ai_extraction_events.sql` — new table.
- `types/ai.ts` — shared `ExtractionResult`, `ExtractedFields`, `PetRegion`, `ConfidenceLabel`.

Modified files (minimal, additive only):

- `components/forms/LostOverlordForm.tsx` — wrap in `React.forwardRef` + `useImperativeHandle` exposing `applyAiSuggestions(values)`. No visible change.
- `components/forms/SpottedAgentForm.tsx` — same imperative-handle addition.
- `app/(protected)/report-lost/page.tsx` — mount `<AiAssistButton>` above the form; hold a ref to `LostOverlordForm`.
- `app/(protected)/report-found/page.tsx` — same, with `SpottedAgentForm`.

Not touched: all validators, submit endpoints, MapPicker, PhotoUploader, verification-field logic in overlords route.

## Data Models

New `types/ai.ts`:

```ts
export type ConfidenceLabel = "high" | "medium" | "low";

/**
 * All fields the AI attempts to read from the screenshot.
 * Every field is nullable — the AI returns null when it cannot infer a value.
 * NOTE: verification_* fields are intentionally absent (Requirement 8).
 */
export interface ExtractedFields {
  pet_name: string | null;
  pet_type: "cat" | "dog" | null;
  description: string | null;
  last_seen_address_text: string | null; // raw address string as read
  last_seen_at: string | null;           // ISO-8601, may be a date-only
  contact_phone: string | null;          // reference only (Requirement 9)
  contact_name: string | null;           // reference only (Requirement 9)
}

export type ExtractedFieldConfidences = {
  [K in keyof ExtractedFields]: ConfidenceLabel | null;
};

/** A candidate pet-photo region detected in the screenshot. */
export interface PetRegion {
  id: string;                 // stable per response (e.g. "crop-1")
  data_url: string;           // "data:image/webp;base64,..." — small preview
  mime_type: "image/webp";
  width: number;
  height: number;
}

/** Server → client response when extraction succeeds. */
export interface ExtractionSuccess {
  status: "ok";
  fields: ExtractedFields;
  confidences: ExtractedFieldConfidences;
  regions: PetRegion[];       // 0 to 5 items
  full_screenshot: PetRegion; // always present so user can pick "the whole post"
  geocode: {
    address_text: string | null;
    lat: number | null;
    lng: number | null;
    reason:
      | "matched"                 // coords resolved successfully
      | "no_address"              // AI returned null address; no geocoding attempted
      | "no_results"              // Nominatim returned zero hits
      | "geocoder_unavailable";   // network / timeout / service error
  };
  quota: {
    remaining: number;            // 0..5 after this call
    resets_at: string;            // ISO-8601 (approx. 24 h from oldest event)
  };
}

/** Server → client response when the AI cannot read the screenshot. */
export interface ExtractionError {
  status: "extraction_error" | "rate_limited" | "invalid_input";
  message: string;                // user-facing (already localized-ready)
}

export type ExtractionResponse = ExtractionSuccess | ExtractionError;
```

New DB table (migration `00008_add_ai_extraction_events.sql`):

```sql
create table public.ai_extraction_events (
  id           uuid         primary key default gen_random_uuid(),
  user_id      uuid         not null references auth.users(id) on delete cascade,
  created_at   timestamptz  not null default now()
);

create index ai_extraction_events_user_time_idx
  on public.ai_extraction_events (user_id, created_at desc);

alter table public.ai_extraction_events enable row level security;

-- Users can read their own quota state (used to hydrate the "X/5 today" hint).
create policy "own_extraction_events_select"
  on public.ai_extraction_events for select
  using (auth.uid() = user_id);

-- Only the service role writes to this table.
```

Rationale: a lightweight append-only event log lets us count events in the trailing 24 h without maintenance jobs; TTL cleanup is optional (rows older than 24 h are simply ignored by the count query).

## Components and Interfaces

### `AiAssistButton`

Location: rendered by both `report-lost/page.tsx` and `report-found/page.tsx`, placed **above** the existing form and below the page header. It is a `Button` in the app's primary style with a `Sparkles` icon (from `lucide-react`) and a copy that matches the design guidelines:

- Lost page label: **"Create with AI from a screenshot"**
- Spotted page label: **"Post a sighting from a screenshot"**

Below the button, a small secondary line explains: _"Have a Facebook or Instagram post? Upload the screenshot and we'll fill the form for you."_

Props:

```ts
interface AiAssistButtonProps {
  variant: "lost" | "spotted";
  onApply: (values: PreparedFormValues) => void;
}
```

Behaviour: renders the button + hint, owns modal open state, and passes `onApply` down to the modal. Uses `bg-primary text-primary-foreground` per design tokens with the `.pet-btn-primary` lift-on-hover treatment.

### `AiAssistModal`

The modal is a controlled dialog rendered via a portal into `document.body`. Because the project does not yet ship a Radix Dialog, we implement a small in-repo `<Modal>` primitive (added to `components/ui/modal.tsx`) that provides:

- Backdrop click-to-close.
- ESC-to-close.
- Focus trap (basic tab-cycle inside the modal).
- `aria-modal="true"`, `role="dialog"`, `aria-labelledby`, `aria-describedby`.
- Body scroll lock while open.

The modal has a five-step content region driven by `useAiExtraction` state:

| State | Visible content |
|---|---|
| `idle` (no file yet) | Privacy notice, checkbox, upload zone, disabled "Analyze screenshot" button. Cancel button always visible. |
| `uploaded` (file staged, not yet analysed) | Thumbnail of chosen screenshot, "Replace screenshot" secondary button, enabled "Analyze screenshot" (only if consent checked). |
| `extracting` | Loading state: soft spinner + caption "Reading your screenshot". The "Analyze screenshot" button becomes disabled with a spinner. An `aria-live="polite"` region announces the start. |
| `previewing` | `AiExtractionPreview` + `AiPhotoPicker` visible. "Apply to form" button appears at the bottom right. "Cancel" always cancels the modal. Optional inline banner if geocoding failed. |
| `applying` | Small spinner overlay while crops are uploaded to `/api/upload` in parallel. |
| `error` | Warm banner with the appropriate message from the error matrix; users can retry from here (state resets to `uploaded`). |

Layout notes (aligned with `design.md`):

- Card surface: `bg-card border border-border rounded-lg shadow-md`. On light theme the modal inherits the cream background.
- Header uses `font-display` (Space Grotesk) sentence case: **"Create with AI"** + small subtitle **"Fill the form from a Facebook or Instagram screenshot."**
- Body padding `p-6`, sections separated by `space-y-6`.
- Sticky footer on small viewports.
- Max width `max-w-2xl`, min mobile width `w-[92%]`.
- No brutalist offset shadows; no ALL-CAPS labels; small pill chips for confidence.

Focus behavior: on open, focus moves to the privacy checkbox. On successful extraction, focus moves to the first low-confidence field or, if none, to "Apply to form". On close, focus returns to the "Create with AI" button.

### `AiAssistUploadZone`

Accepts three input methods:

1. **File picker** — hidden `<input type="file" accept="image/jpeg,image/png,image/webp">`. Triggered by the drop-zone button (like `PhotoUploader`).
2. **Drag & drop** — `onDragOver` / `onDrop` mirroring `PhotoUploader`. Visual lift + accent ring on drag-over (`ring-2 ring-accent/40`).
3. **Clipboard paste** — window-scoped `paste` listener installed only while the modal is open. Iterates `event.clipboardData.items`, keeping the first `image/*` item and converting it via `getAsFile()`. Non-image paste is silently ignored.

Client-side guards (mirroring `/api/upload`):

- MIME check against `ACCEPTED_IMAGE_TYPES` (imported from `lib/validators.ts`). Fail → "Only JPEG, PNG, or WebP images are supported".
- Size check against `MAX_IMAGE_SIZE_BYTES` (5 MB). Fail → "Screenshot must be 5MB or smaller".

Output: a single `File` object stored in modal state. Only one screenshot at a time; a new upload replaces the previous file (with a `URL.revokeObjectURL` cleanup).

### `AiExtractionPreview`

Renders a list where each row shows:

- Field label (localized, plain words per the copy glossary — "Pet name", "Pet type", "Description", "Last-seen address", "Last-seen time", "Contact phone (reference)", "Contact name (reference)").
- Value with monospace treatment reserved only for phone numbers.
- Confidence chip (`high` → mint background, `medium` → amber, `low` → coral). The chip is rounded-full, `text-[10px]` in uppercase — one of the two places design.md allows uppercase.
- On `low` rows: a small caption **"Please double-check this"** below the value in `text-danger` (Requirement 7.2).

Contact rows are visually grouped under a subhead **"Contact info from the original post (added to notes)"** to make Requirement 9 obvious to the user.

If the AI returned a `last_seen_address_text`, the preview additionally shows the raw address (Requirement 5.5) followed by:

- ✅ **"Placed on the map for you"** when `geocode.reason === "matched"`.
- ⚠️ **"We couldn't map this address. Drop the pin yourself"** on `no_results`.
- ⚠️ **"Automatic mapping is unavailable. Drop the pin yourself"** on `geocoder_unavailable`.

### `AiPhotoPicker`

Grid of thumbnails: up to 5 AI crops plus the full screenshot at the end, so at most 6 tiles. Each tile is a toggleable card (`aria-pressed`) with:

- Rounded `rounded-lg` image.
- Selection highlight: primary-colored 2px ring.
- Small overlay pill in the top-left: "AI crop 1", "AI crop 2", … or "Full screenshot".

Rules:

- Minimum 1, maximum 5 selected before "Apply to form" enables (Requirement 6.3).
- If zero AI crops were returned, only the full screenshot is shown; the user must select it to proceed (Requirement 6.4).
- Selection state lives in modal state; images are not uploaded until "Apply to form" is clicked.

### Form integration via imperative handle

The existing forms hold state internally. Rather than lifting all that state into the parent page (large diff, risk of regression), the design uses `forwardRef` + `useImperativeHandle` to expose a single method:

```ts
export interface LostOverlordFormHandle {
  applyAiSuggestions(values: {
    pet_name?: string | null;
    pet_type?: "cat" | "dog" | null;
    description?: string | null;
    last_seen_at?: string | null;       // ISO string
    location?: { lat: number; lng: number } | null;
    photos?: string[];                  // already-uploaded URLs
  }): void;
}

export const LostOverlordForm = React.forwardRef<LostOverlordFormHandle, {}>(
  function LostOverlordForm(_, ref) {
    // ... existing state
    React.useImperativeHandle(ref, () => ({
      applyAiSuggestions(values) {
        if (values.pet_name != null) setPetName(values.pet_name);
        if (values.pet_type != null) setPetType(values.pet_type);
        if (values.description != null) setDescription(values.description);
        if (values.last_seen_at != null) setLastSeenAt(values.last_seen_at);
        if (values.location != null) setLocation(values.location);
        if (values.photos && values.photos.length > 0) setPhotos(values.photos);
        // verification_* is intentionally NOT part of the handle (Requirement 8).
      },
    }));
    // ... rest of body unchanged
  }
);
```

`SpottedAgentForm` mirrors this with a `SpottedAgentFormHandle`.

Key property: the interface uses `undefined` to mean "don't touch" and `null` to mean "AI returned no value" (which the caller filters out before passing). The result: any field the AI could not read is left at its existing value (Requirement 7.5), and verification fields are literally unreachable via this API (Requirement 8.3).

The report pages hold a `useRef<LostOverlordFormHandle>()` and pass it to the form; when the modal calls `onApply`, the page invokes `formRef.current?.applyAiSuggestions(values)` and closes the modal.

The visible form JSX, labels, ordering, validators, error states, and submit handler are unchanged. Manual entry keeps working while the modal is open because the modal is a separate DOM subtree layered on top; the form remains interactive (Requirement 1.6).

## Server Modules

### `lib/aiScreenshotExtractor.ts`

Responsibilities:

- Build the Gemini prompt.
- Call `gemini-2.5-flash` with the screenshot bytes.
- Enforce a 30-second timeout with **one retry** (Requirement 4.6/4.7/4.8) — mirroring the pattern already established in `lib/gemini.ts` (`callGeminiWithTimeout` + `for (let attempt = 0; attempt < 2; attempt++)`).
- Parse the response, strip any accidental verification-adjacent fields, and validate structure with a Zod schema.

Prompt (English, but instructs the model to read either language). The prompt asks for a strict JSON object matching the following schema and asks Gemini to include normalized pixel bounding boxes for pet regions:

```
You are analyzing a screenshot of a social-media post (Facebook, Instagram,
Zalo, etc.) about a missing or spotted pet. The post text may be in English
or Vietnamese. Extract structured information about the pet and the post.

Return ONLY valid JSON with the following shape (no code fences, no prose):

{
  "pet_name": string | null,
  "pet_type": "cat" | "dog" | null,
  "description": string | null,       // 1–500 chars, plain text, no phone/name
  "last_seen_address_text": string | null,  // as written in the post
  "last_seen_at": string | null,      // ISO-8601 datetime or date, best effort
  "contact_phone": string | null,     // E.164-ish or as printed
  "contact_name": string | null,      // name shown as contact/poster
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
    { "x": number, "y": number, "w": number, "h": number }  // 0..1 normalized
    // up to 5 items; empty array if no clear pet photo is visible
  ]
}

Rules:
- If a field is not clearly present in the post, use null and set its confidence to null.
- Never include the poster's phone or name inside the description.
- Never emit fields not listed above; do not add commentary or code fences.
```

The extractor then:

1. `JSON.parse` with markdown-fence stripping (same helper used in `parseGeminiResponse`).
2. Validate the shape with a Zod schema (`extractedResponseSchema`) that constrains lengths, string types, and normalized bbox ranges.
3. **Verification-field stripper** (Requirement 8.2): even though the prompt doesn't ask for them, we defensively `delete` any keys named `verification_name`, `verification_marking`, `verification_trait`, or any key containing "verification" (case-insensitive). The stripped shape is then re-parsed against the Zod schema; unknown keys are rejected. This gives us defense in depth.
4. Return `{ fields, confidences, pet_regions }`. Failure at any step throws so the route can return `extraction_error`.

Environment: reuses `GEMINI_API_KEY` — no new secrets. The existing `@google/generative-ai` client is used with the same `gemini-2.5-flash` model already deployed for trait extraction.

### `lib/aiPetCropper.ts`

Takes the original image buffer + `pet_regions` (normalized 0..1 bboxes) and produces up to 5 cropped WebP buffers using `sharp` (already a project dependency for `imageOptimizer.ts`).

```ts
export interface CroppedRegion {
  id: string;              // "crop-1" … "crop-5"
  buffer: Buffer;
  mimeType: "image/webp";
  width: number;
  height: number;
}

export async function cropRegions(
  screenshot: Buffer,
  regions: Array<{ x: number; y: number; w: number; h: number }>
): Promise<CroppedRegion[]>;
```

Behaviour:

- Get real image dimensions from `sharp(screenshot).metadata()`.
- For each region: compute pixel coords, clamp to image bounds, discard degenerate boxes (area < 32×32 px).
- `sharp(screenshot).extract({ ... }).webp({ quality: 80 }).toBuffer()`.
- Limit to 5 (`Requirement 6.1`) and always resize the longest edge to ≤ 640 px so the base64 payload sent to the client stays small (well under the modal payload budget).

The cropper is deterministic per (screenshot, regions) and does not call any external service.

The **full-screenshot preview** is produced by the same module with a `pass-through` compression step: the raw upload is resized to max 720 px longest edge, WebP at quality 78, so we can send it as base64 too. This keeps the JSON response payload well below the Vercel 4.5 MB body limit for typical screenshots.

Encoding: buffers are converted to base64 data URLs (`data:image/webp;base64,...`) for the JSON response. When the user selects crops, the modal decodes the data URL back to a `Blob`, wraps it in a `File`, and posts to `/api/upload`.

### `lib/aiRateLimiter.ts`

Provides two functions:

```ts
export async function checkExtractionQuota(
  client: SupabaseClient,
  userId: string
): Promise<{
  allowed: boolean;
  remaining: number;
  resets_at: string; // ISO-8601 approximating when the oldest event ages out
}>;

export async function recordSuccessfulExtraction(
  client: SupabaseClient,
  userId: string
): Promise<void>;
```

Implementation:

- `checkExtractionQuota` runs a `select count(*)` on `ai_extraction_events` `where user_id = :uid and created_at > now() - interval '24 hours'`. If count ≥ 5, `allowed = false`.
- `resets_at` is computed from the oldest event's `created_at + 24h` (best-effort — we surface an approximate reset time; a small skew is acceptable for a warm hint).
- `recordSuccessfulExtraction` inserts a single row using the **service role client** (RLS policy allows only SELECT for users). Ordering: the route records the event **after** Gemini returns success (Requirement 11.1 says "successful" extractions).

Note on the "successful" definition: extraction is counted as successful iff the Gemini call returned a parseable, verification-stripped, schema-valid response. Rate-limited (429), invalid-input (413/415), and `extraction_error` responses are **not** counted, so users are never penalized for our failures.

### `lib/geocoding.ts` — extension

Add:

```ts
export interface ForwardGeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
  importance: number; // Nominatim's relevance score
}

export async function forwardGeocode(
  addressText: string,
  locale?: string
): Promise<ForwardGeocodeResult[]>;
```

Behaviour:

- Guards: `addressText.trim().length` in `[1, 500]` else return `[]`.
- Endpoint: `https://nominatim.openstreetmap.org/search?format=jsonv2&q=...&limit=5&addressdetails=1`.
- Same `User-Agent` header, same 5-second `AbortController` timeout (Requirement 5.1 caps geocoding at 5 s).
- Returns `[]` on network / non-2xx / timeout.
- Sorted server-side by `importance` descending — first element is "highest-relevance" (Requirement 5.2).

The existing `reverseGeocode` is untouched; both share the `USER_AGENT` constant and timeout mechanism.

The route handler translates the return value into the `geocode` block of `ExtractionSuccess`:

- Empty array → `{ reason: "no_results", lat: null, lng: null }`.
- Non-empty → `{ reason: "matched", lat: top.lat, lng: top.lng }`.
- Thrown / caught error → `{ reason: "geocoder_unavailable" }`.
- Null/empty `address_text` → `{ reason: "no_address" }` (no call made).

Coordinate ranges are trivially satisfied because Nominatim returns valid lat/lng; we still assert `lat ∈ [-90, 90]` and `lng ∈ [-180, 180]` before returning "matched" (Requirement 5.1).

## API Design

### `POST /api/ai/extract-report`

Request:

- Method: `POST`.
- Body: `multipart/form-data` with a single `file` field (JPEG/PNG/WebP, ≤5 MB) and one text field `variant` = `"lost"` or `"spotted"`. Multipart is used (not JSON) to reuse the same upload primitives as `/api/upload` and avoid a base64 round-trip in the request.

Response codes and shapes:

| Status | Condition | Body |
|---|---|---|
| 200 | Success | `ExtractionSuccess` |
| 400 | Missing/invalid file, invalid variant | `{ status: "invalid_input", message }` |
| 401 | Not authenticated | `{ status: "invalid_input", message: "Not authenticated" }` (per Requirement 11.3) |
| 413 | Body > 5 MB | `{ status: "invalid_input", message: "Screenshot must be 5MB or smaller" }` (Requirement 11.4) |
| 415 | Wrong MIME | `{ status: "invalid_input", message: "Only JPEG, PNG, or WebP images are supported" }` |
| 429 | Quota exhausted | `{ status: "rate_limited", message: "You've reached today's AI limit. Please try again tomorrow or fill the form manually" }` |
| 500 | Retried Gemini call still failed | `{ status: "extraction_error", message: "We couldn't read this screenshot. You can still fill the form manually" }` |

Route ordering (guards first, expensive work later):

1. Auth (Supabase session).
2. Body-size check via `request.headers.get('content-length')` before reading the stream — Next.js also enforces the platform limit; we still emit 413 with the design copy for our clients.
3. Parse `formData`, validate file MIME & size.
4. Rate-limit check via `checkExtractionQuota`.
5. Call `extractFromScreenshot(buffer)` — 30 s + retry.
6. Call `cropRegions(buffer, response.pet_regions)`.
7. Call `forwardGeocode(fields.last_seen_address_text)` if non-null.
8. Call `recordSuccessfulExtraction(userId)` (order: after Gemini success, before returning — so retries in-flight are not double-counted).
9. Return `ExtractionSuccess`.

The `variant` value is used only for logging and analytics; the extraction prompt itself is the same for both variants because the AI extracts the same field set either way. The **client** decides which fields to feed which form.

### Reuse: `POST /api/upload`

Unchanged. When the user clicks "Apply to form" and has selected crops, the modal:

1. Converts each selected `PetRegion.data_url` back to a `File` (webp) with a synthetic name like `ai-crop-1.webp`.
2. `Promise.all` uploads them to `/api/upload`, mirroring `PhotoUploader`.
3. Collects the returned signed URLs into a `photos: string[]` array.
4. Calls `formRef.current.applyAiSuggestions({ ..., photos })`.

The photo pipeline is intentionally identical to the manual path — same optimization, same bucket, same signed-URL lifetime.

### Reuse: `POST /api/overlords` / `POST /api/agents`

Untouched. The user submits the same payload the manual form produces today.

## Client State Machine (`useAiExtraction`)

```
      ┌──────────┐  file selected  ┌──────────┐  privacy checked +      ┌─────────────┐
      │  idle    │────────────────►│ uploaded │──"Analyze screenshot"──►│ extracting  │
      └──────────┘                 └──────────┘                         └─────┬───────┘
           ▲                          ▲   ▲                                   │
           │                          │   └───── replace screenshot ──────────┤
           │                          │                                       │
           │                          │                                       ▼
           │                          │              ┌──── extraction_error ──┤
           │                          │              │                        │
           │       cancel             │              ▼                        │ success
           │◄─────────────────────────┴──────── ┌─────────┐                   │
           │                                    │  error  │                   │
           │                                    └────┬────┘                   │
           │                                         │ retry                  │
           │                                         └────────► extracting    │
           │                                                                  │
           │                                                                  ▼
           │                                                          ┌─────────────┐
           │                                                          │  previewing │
           │                                                          └──────┬──────┘
           │                                                                 │
           │                                                                 │ Apply to form
           │                                                                 ▼
           │                                                          ┌─────────────┐
           │                                              upload      │  applying   │
           │                                              crops       └──────┬──────┘
           │                                                                 │
           │◄────────── applyAiSuggestions + close modal ────────────────────┘
```

Extra transitions:

- Any state → `idle` when the modal is closed (backdrop, ESC, or Cancel). The form is not touched.
- Network error during extraction → `error` with retry (Requirement 12.4).
- Network error during crop upload → local error inside the `applying` step; user can retry uploads without redoing extraction.
- `rate_limited` → `error` with a distinct copy and **no retry button** (Requirement 11.2). A "Fill manually" secondary action closes the modal.

The hook returns `{ state, file, result, error, actions: { setFile, analyze, apply, reset, retry } }` and encapsulates the fetch to `/api/ai/extract-report`.

## Copy & UX Details

Following `design.md`:

- All copy is sentence case, plain-language, and warm.
- No mentions of "Overlord", "Agent", "Deploy", "Intel", or military framing in the modal.
- Success moments get sparing emoji: e.g. **"Filled in for you 🐾"** is the modal-closed toast (fired via the existing `useSuccessToast`).
- Error copy is emoji-free.
- Confidence chips are the only ALL-CAPS text (`HIGH` / `MEDIUM` / `LOW`, `text-[10px]`, `tracking-wider`).
- Design tokens only. Every color reference goes through `bg-primary`, `bg-card`, `text-danger`, `text-success`, `bg-accent/10`, `border-border`. No arbitrary hex.
- Rounded surfaces: `rounded-lg` for the modal card and preview rows, `rounded-full` for chips, `rounded-md` for buttons.
- Soft shadows via `shadow-md` on the modal card. No brutalist offset shadows.
- Hover / focus lift: buttons inherit `.pet-btn-primary` behavior (small `translateY(-1px)` + shadow bump).

The privacy notice text (Requirement 3):

> **Before we read your screenshot…**
> This image will be sent to our AI vision service to pull out the pet info and the location. Social-media posts often include people's names and phone numbers, so please don't upload anything you wouldn't be OK sharing. We only keep the pet crops you choose to save — the original screenshot is not stored.
> ☐ I understand and want to continue.

The rate-limit error copy (Requirement 11.2):

> You've reached today's AI limit. Please try again tomorrow or fill the form manually.

The extraction-failure copy (Requirement 4.9):

> We couldn't read this screenshot. You can still fill the form manually.

## Accessibility & Theming

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` bound to the modal title.
- Focus trap keeps `Tab` and `Shift+Tab` inside the modal; ESC closes and restores focus to the opener button.
- `aria-live="polite"` region announces `"Screenshot read. Review the suggestions below."` on success (Requirement 13.5) and `"Reading your screenshot"` when extraction starts.
- Every interactive element has a visible focus ring using `focus-visible:ring-2 focus-visible:ring-ring` (the token maps to `--color-primary` in both themes).
- Upload zone has `role="button" tabIndex={0}` and an `aria-label="Upload a screenshot of the social-media post"`.
- Each candidate crop tile has `alt="Pet photo option {n}"` and `aria-pressed={selected}`.
- The loading spinner has `role="status" aria-label="Reading your screenshot"`.
- All tokens used in the modal (`bg-card`, `text-primary`, `border-border`, `text-danger`, `bg-primary`, `bg-accent/10`) render correctly in both themes because they resolve through the light/dark override block already in `app/globals.css` — no theme-specific branches needed in the components.
- Contrast: primary coral on card background has been validated at ≥ 4.5:1 in both themes (existing tokens; no new colors introduced).

## Verification Field Defense in Depth

Requirement 8 requires the AI to never fill verification fields. The design enforces this at three layers:

1. **Prompt** — never asks for verification fields; explicit "do not add commentary or code fields".
2. **Server stripper** — before returning, `aiScreenshotExtractor` deletes any keys containing "verification" (case-insensitive) and re-parses against a Zod `.strict()` schema that rejects unknown keys. If any leaked, they never enter the response.
3. **Client type contract** — `ExtractedFields` does not declare verification keys; the imperative handle `applyAiSuggestions` explicitly does not accept them; the form's verification state setters are never called from the modal.

Contact-field routing (Requirement 9) is enforced by:

- The description composer in the modal builds the final description string as `${aiDescription}${contactSuffix}` where `contactSuffix` is:
  - Both present: `"\n\nContact from original post: <name> — <phone>"`.
  - Only phone: `"\n\nContact from original post: <phone>"`.
  - Only name: `"\n\nContact from original post: <name>"`.
  - Both null: no suffix (Requirement 9.4).
- The composed description is what appears in the preview (Requirement 9.5) and what gets written via `applyAiSuggestions.description`.
- The modal never calls anything for the reporter/owner identity on the form (there is no such visible field on the current forms — identity is derived from the session server-side — but keeping the API surface narrow is still the guarantee).

## Error Handling

| Failure | Detected by | User sees | Retry allowed |
|---|---|---|---|
| Wrong file type | Client (MIME check) | Inline banner "Only JPEG, PNG, or WebP images are supported" | Yes, pick another file |
| Oversized file | Client (size check) | Inline banner "Screenshot must be 5MB or smaller" | Yes, pick another file |
| Unauthenticated | Server 401 | Full-modal banner "Please log in and try again" + close button | No inside modal |
| Server 413 | Server 413 (defense in depth) | Same as oversize copy | Yes |
| Quota exhausted | Server 429 | "You've reached today's AI limit…" + "Fill manually" button | **No** (Requirement 11) |
| Gemini timeout / error / bad JSON | `extractFromScreenshot` throws after retry | "We couldn't read this screenshot…" + "Try again" and "Fill manually" | Yes (a new extraction call — counts against quota only on success) |
| Client network error | fetch rejection | "Network error. Try again in a moment." | Yes (Requirement 12.4) |
| Geocoding returns no results | Server geocode block | Preview banner "We couldn't map this address. Drop the pin yourself" | Non-blocking; user still Applies |
| Geocoding unavailable | Server geocode block | Preview banner "Automatic mapping is unavailable. Drop the pin yourself" | Non-blocking; user still Applies |
| `/api/upload` fails on one crop | Client, during `applying` | Row-level error next to the failing crop + "Retry this photo" | Yes, per-crop retry (mirrors `PhotoUploader.retryUpload`) |

Nothing in this matrix writes to the manual form except the successful "Apply to form" path. All intermediate errors leave the form untouched (Requirement 4.9, 5.4, 12.x).

## Rate Limit Design Details

The Requirement 11.1 window is **rolling 24 hours per authenticated user**. Choice of implementation:

- **Chosen:** append-only `ai_extraction_events` table with a `count(*) where created_at > now() - interval '24 hours'` query. Simple, atomic, and readable back to the client for a "3/5 left today" hint.
- **Rejected:** Upstash or Redis token bucket — Vercel Hobby tier plus the project's steering explicitly favors Supabase; a new external service adds ops surface without benefit at this quota.
- **Rejected:** in-memory counter — Vercel serverless functions have ephemeral instances, so state would not persist.

Additional guardrails:

- The route reads `SUPABASE_SERVICE_ROLE_KEY` (already provisioned) via `createServiceRoleClient` for both read and write. RLS on the table prevents users from tampering directly.
- Optional cron-cleanup of rows > 24 h old is a **maintenance detail**, not required for correctness. Skipped in v1.

Concurrency: two concurrent extraction requests from the same user could each read `count = 4` and both proceed to `count = 5`. This is acceptable for a per-user "at most 5 per day" cap — worst case a user gets 6 in a day, which is negligible for cost. If tighter enforcement is ever needed, we can switch to a Postgres `select … for update` on a `quota_counters(user_id, count, window_end)` row.

## Design Decisions and Alternatives

### 1. Imperative handle vs. lifting form state

**Chosen:** `React.forwardRef` + `useImperativeHandle` exposing `applyAiSuggestions`.

**Alternative:** Lift `petName`, `location`, `photos`, etc. out of the form into the page and pass them down.

**Rationale:** The requirements are emphatic that the existing form must not change (`1.5`). Lifting state means editing every field's `onChange` and every controlled input, a large surface area to regress validators and inline errors. The imperative handle adds one small `useImperativeHandle` block, doesn't alter render output, and can't reach the verification fields.

### 2. Server-side crop vs. client-side crop

**Chosen:** Server-side crop using `sharp`.

**Alternative:** Return bboxes to the client and crop in-browser via `<canvas>`.

**Rationale:** `sharp` is already a dependency and its output is deterministic. Server-side cropping means Gemini's coordinates only travel over one hop, the client receives ready-to-preview WebP thumbnails, and we sidestep browser-side EXIF/rotation and CSP concerns. The base64 payload cost (≤ 6 thumbnails × ~40 KB each) fits comfortably under Next.js's response budget.

### 3. Multipart upload vs. base64 JSON

**Chosen:** `multipart/form-data` for the extraction request.

**Alternative:** `application/json` with a base64-encoded image.

**Rationale:** Multipart handles the 5 MB limit natively; base64 inflates payload by ~33% and the Next.js Route Handler size defaults are more forgiving of multipart. The existing `/api/upload` route establishes the pattern.

### 4. Reuse `/api/upload` vs. inlining Storage writes

**Chosen:** Have the modal POST each selected crop to the existing `/api/upload`.

**Alternative:** Have `/api/ai/extract-report` upload every crop to Storage before returning URLs.

**Rationale:** Users almost always discard some crops, so pre-uploading every candidate wastes Storage writes. Deferring the upload until "Apply to form" also keeps a clean separation: `/api/ai/extract-report` is stateless w.r.t. Storage; `/api/upload` remains the single write path.

### 5. Success-only quota vs. attempt-based quota

**Chosen:** Record only successful Gemini responses in `ai_extraction_events`.

**Alternative:** Record every attempt, including retries and failures.

**Rationale:** Requirement 11.1 says "5 successful AI extraction requests" — literal. Users are not punished for Gemini flakiness; retries after `extraction_error` don't cost quota until they succeed.

### 6. Forward geocoding via existing Nominatim vs. dedicated service

**Chosen:** Extend `lib/geocoding.ts` with `forwardGeocode` using the same Nominatim endpoint and User-Agent policy.

**Alternative:** Add Google Maps Geocoding or Mapbox.

**Rationale:** No new secrets, no new billing surface, and the existing `reverseGeocode` implementation shows the pattern (headers, timeout, quiet failure). Nominatim quality is adequate for Vietnamese/English street addresses in the app's target regions.

### 7. Prompt in a single call vs. two-pass extraction

**Chosen:** Single Gemini call that returns fields + bboxes + confidences.

**Alternative:** One call for text fields, a second call for pet-region detection.

**Rationale:** Halves the cost against the Gemini quota (which the rate limiter is designed to protect) and halves the latency-critical path. Gemini 2.5 Flash handles this schema comfortably; if it fails to include bboxes, we degrade to "only full screenshot" (Requirement 6.4).

## Correctness Properties

These invariants must hold end-to-end; each one traces back to a specific requirement and is enforced by an identifiable layer.

### Property 1: Manual form is byte-identical when the modal is not confirmed

Opening or closing the modal without pressing "Apply to form" leaves every field of the manual form at the exact value it held before. Enforced by: the modal never invokes `applyAiSuggestions` unless the user clicks "Apply to form".

**Validates: Requirements 1.4, 1.5, 1.6**

### Property 2: Verification fields are never written by the AI path

Under no code path in the modal or extractor can a value reach `verification_name`, `verification_marking`, or `verification_trait`. Enforced by: (a) the prompt does not ask for them, (b) the server stripper deletes any leaked keys before schema validation, (c) the `ExtractedFields` type does not declare them, (d) `applyAiSuggestions` does not accept them.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

### Property 3: AI-null fields do not overwrite existing form values

For any field where the AI returned `null`, the form's prior value is preserved after "Apply to form". Enforced by: `applyAiSuggestions` filters out `null` before calling setters, and only touches state for fields that received a non-null value.

**Validates: Requirements 7.4, 7.5**

### Property 4: Submission is indistinguishable from a manual submission

The payload sent to `POST /api/overlords` / `POST /api/agents` after AI pre-fill matches the shape of a manual submission. Enforced by: no code path bypasses the form's `handleSubmit`; validators and the submit endpoint are unchanged.

**Validates: Requirements 10.1, 10.2, 10.3, 10.4**

### Property 5: Contact info never lands in an owner/reporter identity field

`contact_phone` and `contact_name` only ever appear in the description text. Enforced by: the description composer is the only consumer of these two fields, and no owner/reporter identity fields exist on the visible form (identity is derived server-side from the session).

**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

### Property 6: Rate-limit quota reflects only successful extractions

Any 4xx/5xx that is not a successful Gemini response does not consume quota. Enforced by: `recordSuccessfulExtraction` runs only on the success branch, after Gemini returns valid JSON and the response passes the Zod schema.

**Validates: Requirements 11.1, 11.2, 11.3, 11.4**

### Property 7: Photo attachment count is always within the form's bounds

After "Apply to form", `photos.length` is in `[1, 5]`. Enforced by: `AiPhotoPicker` disables "Apply to form" until 1..5 tiles are selected, and no code path adds more.

**Validates: Requirements 6.2, 6.3, 6.4, 6.5**

### Property 8: Geocoder failure never blocks form fill

A failed forward-geocode always leaves the modal in a state where the user can still apply the remaining suggestions. Enforced by: geocoding produces a `geocode.reason` value used only for a preview banner; "Apply to form" is not gated on it.

**Validates: Requirements 5.2, 5.3, 5.4, 5.5**

### Property 9: Image guards fail fast client-side and again server-side

Wrong MIME or oversized files are rejected before Gemini is ever called. Enforced by: client-side checks in `AiAssistUploadZone` and server-side checks in `POST /api/ai/extract-report` before the extractor is invoked.

**Validates: Requirements 2.4, 2.5, 11.4**

## Testing Strategy

The design supports the following test surface. Concrete tests will be authored during implementation using the existing Vitest setup (`vitest --run`).

### Unit tests (`tests/unit/`)

- **`aiScreenshotExtractor.test.ts`**
  - Parses well-formed Gemini JSON responses.
  - Strips markdown fences.
  - Discards keys containing "verification" (case-insensitive) — property test with `fast-check` generating random extra keys.
  - Rejects responses with disallowed extra keys (Zod `.strict`).
  - Rejects normalized bboxes outside `[0, 1]`.
  - Retries once on timeout/error and returns `extraction_error` after the retry (mock the Gemini client).
- **`aiPetCropper.test.ts`**
  - Clamps out-of-bounds boxes to the image.
  - Discards degenerate boxes (< 32×32 px).
  - Caps output at 5 crops even if given more.
  - Preserves aspect ratio and downscales longest edge to ≤ 640 px.
- **`aiRateLimiter.test.ts`**
  - Allows the first 5 successful calls in a 24 h window.
  - Blocks the 6th.
  - Correctly ignores rows older than 24 h.
  - Computes `resets_at` from the oldest in-window event.
- **`geocoding.test.ts` (extension)**
  - `forwardGeocode` returns `[]` on network error, timeout, or non-2xx.
  - Returns results sorted by `importance` desc.
  - Guards `addressText` length to `[1, 500]`.

### Route tests (`tests/unit/aiExtractRoute.test.ts`)

Mock Gemini, mock the rate limiter, mock the geocoder, and run through the guard order:

- 401 when unauthenticated.
- 413 when body exceeds 5 MB.
- 415 on wrong MIME.
- 429 when quota is at the cap.
- 500 `extraction_error` when Gemini fails twice.
- 200 happy path returns the full `ExtractionSuccess`.
- Verification-field-shaped keys in a mocked Gemini response never appear in the returned JSON.
- `recordSuccessfulExtraction` is called on the success branch and not on any failure branch.

### Component tests (`tests/unit/` with React Testing Library)

- **`AiAssistModal.test.tsx`**
  - Opens with focus on the privacy checkbox; ESC closes and restores focus.
  - "Analyze screenshot" is disabled until (a) a file is selected and (b) the privacy checkbox is ticked.
  - Rejects wrong MIME and oversized files with the exact copy from the requirements.
  - Announces `"Reading your screenshot"` via `aria-live` on start.
  - Closing without "Apply to form" does not invoke the form ref (P1 above).
  - "Apply to form" invokes the form ref exactly once with a payload that never contains verification keys (P2 above).
- **`AiPhotoPicker.test.tsx`**
  - Disables "Apply to form" at 0 or > 5 selected.
  - When zero AI crops are returned, only the full screenshot is shown and must be selected to proceed.
- **`useAiExtraction.test.ts`**
  - State machine transitions match the diagram.
  - Rate-limited response transitions to `error` with no retry option.
  - Network error during crop upload does not reset extraction state.

### Property tests (`tests/property/`)

Using `fast-check`:

- **AI response fuzzing.** Generate arbitrary JSON with arbitrary key names, including "verification*"-shaped strings; verify the extractor either strips them or rejects the response. Assert no verification-shaped key ever appears in the returned `ExtractedFields`.
- **Description composer.** Generate `(description, contact_phone, contact_name)` triples; assert the composed string always contains the description as a prefix, and appends a single contact line iff at least one of phone/name is non-null (Req 9.4).

### Manual / QA checklist

- Both themes (dark and light) render the modal, preview rows, chips, and error banners correctly.
- Screenshots in Vietnamese produce non-null fields when the post is well-formed.
- Screenshots that are clearly not pet posts return `extraction_error`.
- The manual form fields remain fully editable while the modal is open (Req 1.6). Verified by opening the modal, editing a form field behind it, then dismissing the modal — the manual edit persists.

## Non-Goals Recap (For Reviewers)

Explicitly not in scope for this design:

- **No changes to form fields, labels, layout, or validators.** The imperative handle is the only touch point.
- **No new submission endpoint.** Users submit through `/api/overlords` or `/api/agents`.
- **No new report table.** No changes to `overlords`, `agents`, or any related schema.
- **No sidebar / nav / dashboard change.** The button lives inside each report page's existing container.
- **No translation of extracted text.** Vietnamese stays Vietnamese; the AI just reads it.
- **No storage of raw screenshots.** Only the selected crops (which the user reviewed) travel through `/api/upload` into `cat-photos` storage.
- **No claim / verification impact.** Ownership-verification fields remain manual-only.

## Open Questions

- Should we surface remaining quota as a small "3 of 5 AI extractions left today" hint under the button? It is user-friendly and cheap (the count is already returned in `ExtractionSuccess.quota`), but not required. Recommend: yes, add it once the endpoint ships — non-blocking for v1.
- Should the modal keep the last successful preview in state so a user closing and re-opening the modal without refresh sees their previous suggestions? Non-required. Recommend: no in v1 — closing = fresh start, simpler mental model.
- Do we want a separate `SEED_DATA` mode that lets developers bypass Gemini with a canned response for demos? Nice-to-have; can be added later behind a feature flag without changing this design.
