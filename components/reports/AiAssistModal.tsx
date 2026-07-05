"use client";

import * as React from "react";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAiExtraction } from "@/hooks/useAiExtraction";
import type { ExtractedFields, ExtractionSuccess, PetRegion } from "@/types/ai";

import { AiAssistUploadZone } from "./AiAssistUploadZone";
import { AiExtractionPreview } from "./AiExtractionPreview";
import { AiPhotoPicker, isPhotoSelectionValid } from "./AiPhotoPicker";

/**
 * AiAssistModal — top-level modal that walks the user through: privacy →
 * upload → extraction → preview → photo select → apply. Driven by
 * `useAiExtraction` and orchestrates:
 *   • a privacy checkbox required to enable "Analyze screenshot"
 *   • the extraction call
 *   • uploading selected crops via `POST /api/upload`
 *   • composing the final description (append contact-info line)
 *   • calling `onApply` with the final values and closing the modal
 *
 * See `.kiro/specs/create-report-with-ai/design.md` for the full spec.
 *
 * _Requirements: 1.3, 2.4, 2.5, 3.1, 3.2, 3.3, 4.9, 5.5, 6.5, 7.1, 7.3, 7.4,
 * 9.1, 9.2, 9.3, 9.4, 9.5, 11.2, 12.1, 12.2, 12.3, 12.4, 13.1, 13.2, 13.3,
 * 13.4, 13.5_
 */

// --- Public API --------------------------------------------------------------

export type AiAssistApplyValues = {
  pet_name?: string | null;
  pet_type?: "cat" | "dog" | null;
  description?: string | null;
  last_seen_at?: string | null;
  location?: { lat: number; lng: number } | null;
  photos?: string[];
};

export interface AiAssistModalProps {
  open: boolean;
  onClose: () => void;
  variant: "lost" | "spotted";
  onApply: (values: AiAssistApplyValues) => void;
}

// --- Copy strings ------------------------------------------------------------

const TITLE = "Create with AI";
const SUBTITLE = "Fill the form from a Facebook or Instagram screenshot.";

const PRIVACY_HEADING = "Before we read your screenshot…";
const PRIVACY_BODY =
  "This image will be sent to our AI vision service to pull out the pet info and the location. Social-media posts often include people's names and phone numbers, so please don't upload anything you wouldn't be OK sharing. We only keep the pet crops you choose to save — the original screenshot is not stored.";
const PRIVACY_CHECKBOX_LABEL = "I understand and want to continue.";

const READING_ANNOUNCEMENT = "Reading your screenshot";
const READ_SUCCESS_ANNOUNCEMENT =
  "Screenshot read. Review the suggestions below.";

const ANALYZE_BUTTON = "Analyze screenshot";
const APPLY_BUTTON = "Apply to form";
const CANCEL_BUTTON = "Cancel";
const TRY_AGAIN_BUTTON = "Try again";
const FILL_MANUALLY_BUTTON = "Fill manually";

const UPLOAD_FAILURE_MESSAGE =
  "We couldn't attach the selected photos. Try again in a moment.";

// --- Description composer ----------------------------------------------------

/**
 * Format the reference contact line appended to the description.
 * Returns `null` when both phone and name are null (Requirement 9.4).
 */
function formatContactLine(
  phone: string | null,
  name: string | null
): string | null {
  if (phone && name) {
    return `Contact from original post: ${name} — ${phone}`;
  }
  if (phone) {
    return `Contact from original post: ${phone}`;
  }
  if (name) {
    return `Contact from original post: ${name}`;
  }
  return null;
}

/**
 * Build the final description string that the modal will write to the form.
 *
 * Rules (from design.md and Requirement 9):
 *   • Both phone + name → `${desc}\n\nContact from original post: <name> — <phone>`
 *   • Only phone       → `${desc}\n\nContact from original post: <phone>`
 *   • Only name        → `${desc}\n\nContact from original post: <name>`
 *   • Both null        → `${desc}` (no suffix)
 *
 * If the AI's description is null but a contact line is available, the
 * result is just the contact line with no leading newlines.
 *
 * Exported so the property test in task 23 can validate it directly.
 */
export function composeDescription(fields: ExtractedFields): string | null {
  const contactLine = formatContactLine(
    fields.contact_phone,
    fields.contact_name
  );
  const description = fields.description;

  if (description == null && contactLine == null) {
    return null;
  }
  if (description == null) {
    // contactLine is non-null here — no leading newlines needed.
    return contactLine;
  }
  if (contactLine == null) {
    return description;
  }
  return `${description}\n\n${contactLine}`;
}

// --- Helpers -----------------------------------------------------------------

/**
 * Convert a base64 data URL back into a `File` so it can be uploaded through
 * the existing `POST /api/upload` endpoint (same shape used by PhotoUploader).
 *
 * Decodes inline via `atob` rather than `fetch(dataUrl)` — the data URL is
 * fully self-contained (no network access) and this keeps SSRF linters
 * happy.
 */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Invalid data URL");
  }

  const mimeType = match[1] || "image/webp";
  const isBase64 = Boolean(match[2]);
  const payload = match[3];

  let bytes: Uint8Array;
  if (isBase64) {
    const binary = atob(payload);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  } else {
    // URL-encoded payload — rare, but supported for completeness.
    const decoded = decodeURIComponent(payload);
    bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
  }

  return new File([bytes], filename, { type: mimeType });
}

/** POST a single file to `/api/upload` and return the resulting URL. */
async function uploadOne(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(errorBody.error ?? `Upload failed (${response.status})`);
  }

  const data = (await response.json()) as { url?: string };
  if (!data.url) {
    throw new Error("Upload response missing URL");
  }
  return data.url;
}

/** Does the extraction contain at least one non-null field? (Requirement 7.3) */
function hasAnyExtractedField(result: ExtractionSuccess): boolean {
  return (Object.keys(result.fields) as Array<keyof ExtractedFields>).some(
    (key) => result.fields[key] !== null
  );
}

/** Map a selected tile id back to its `PetRegion`, including the full screenshot. */
function findRegionById(
  result: ExtractionSuccess,
  id: string
): PetRegion | undefined {
  if (result.full_screenshot.id === id) return result.full_screenshot;
  return result.regions.find((r) => r.id === id);
}

// --- Component ---------------------------------------------------------------

export function AiAssistModal({
  open,
  onClose,
  variant,
  onApply,
}: AiAssistModalProps) {
  const { state, file, result, error, actions } = useAiExtraction({ variant });

  const [consented, setConsented] = React.useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [applyError, setApplyError] = React.useState<string | null>(null);
  const [announcement, setAnnouncement] = React.useState("");

  const titleId = React.useId();
  const subtitleId = React.useId();
  const privacyCheckboxId = React.useId();

  const privacyCheckboxRef = React.useRef<HTMLInputElement>(null);
  const applyButtonRef = React.useRef<HTMLButtonElement>(null);

  // Whenever the modal closes, wipe local state and reset the extraction hook
  // so re-opening starts fresh (Requirement 1.4 keeps the manual form
  // untouched; nothing here writes to it unless the user hits Apply).
  React.useEffect(() => {
    if (!open) {
      actions.reset();
      setConsented(false);
      setSelectedPhotoIds([]);
      setUploading(false);
      setApplyError(null);
      setAnnouncement("");
    }
  }, [open, actions]);

  // Announce extraction start / success via `aria-live` region (Req 13.5).
  React.useEffect(() => {
    if (state === "extracting") {
      setAnnouncement(READING_ANNOUNCEMENT);
    } else if (state === "previewing") {
      setAnnouncement(READ_SUCCESS_ANNOUNCEMENT);
    }
  }, [state]);

  // When a new extraction result arrives, pre-select the first AI crop (or
  // the full screenshot when no crops are returned per Requirement 6.4).
  React.useEffect(() => {
    if (state === "previewing" && result && selectedPhotoIds.length === 0) {
      const defaultId =
        result.regions.length > 0
          ? result.regions[0].id
          : result.full_screenshot.id;
      setSelectedPhotoIds([defaultId]);
    }
  }, [state, result, selectedPhotoIds.length]);

  // Post-extraction focus moves to "Apply to form" (per design's focus rules:
  // first low-confidence field or, if none, the Apply button). The preview
  // rows are not focusable in this iteration so we fall through to Apply.
  React.useEffect(() => {
    if (state !== "previewing") return;
    const timer = window.setTimeout(() => {
      applyButtonRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [state]);

  // Derived flags -------------------------------------------------------------

  const hasFile = file !== null;
  const canAnalyze = state === "uploaded" && hasFile && consented;

  const canApply =
    state === "previewing" &&
    result !== null &&
    hasAnyExtractedField(result) &&
    isPhotoSelectionValid(selectedPhotoIds) &&
    !uploading;

  const isRateLimited = error !== null && !error.retryable;

  // Handlers ------------------------------------------------------------------

  const handleAnalyze = React.useCallback(() => {
    void actions.analyze();
  }, [actions]);

  const handleRetryExtraction = React.useCallback(() => {
    actions.retry();
    void actions.analyze();
  }, [actions]);

  const handleApply = React.useCallback(async () => {
    if (!result || uploading) return;

    setUploading(true);
    setApplyError(null);

    try {
      const selectedRegions = selectedPhotoIds
        .map((id) => findRegionById(result, id))
        .filter((region): region is PetRegion => region !== undefined);

      // Convert each selected data URL to a File then upload in parallel
      // through the existing /api/upload endpoint (mirrors PhotoUploader).
      const files = selectedRegions.map((region, i) =>
        dataUrlToFile(region.data_url, `ai-${region.id}-${i + 1}.webp`)
      );

      const uploadedUrls = await Promise.all(files.map((f) => uploadOne(f)));

      // Compose the final description (Requirement 9) and location (only when
      // the geocoder actually matched — Requirement 5.2 / 5.4).
      const composedDescription = composeDescription(result.fields);
      const location =
        result.geocode.reason === "matched" &&
        result.geocode.lat !== null &&
        result.geocode.lng !== null
          ? { lat: result.geocode.lat, lng: result.geocode.lng }
          : null;

      onApply({
        pet_name: result.fields.pet_name,
        pet_type: result.fields.pet_type,
        description: composedDescription,
        last_seen_at: result.fields.last_seen_at,
        location,
        photos: uploadedUrls,
      });

      onClose();
    } catch (err) {
      // Design: "Network error during crop upload does not reset extraction
      // state." Keep the preview visible and let the user retry.
      const message =
        err instanceof Error && err.message
          ? err.message
          : UPLOAD_FAILURE_MESSAGE;
      setApplyError(message);
    } finally {
      setUploading(false);
    }
  }, [result, uploading, selectedPhotoIds, onApply, onClose]);

  // Guards --------------------------------------------------------------------

  if (!open) return null;

  // --- Render sections -------------------------------------------------------

  const renderHeader = () => (
    <div className="border-b border-border p-6">
      <h2
        id={titleId}
        className="font-[family-name:var(--font-space-grotesk)] text-xl font-semibold text-text-primary"
      >
        {TITLE}
      </h2>
      <p id={subtitleId} className="mt-1 text-sm text-text-secondary">
        {SUBTITLE}
      </p>
    </div>
  );

  const renderPrivacyAndUpload = () => (
    <div className="space-y-5">
      <section
        aria-labelledby={`${privacyCheckboxId}-heading`}
        className="rounded-lg border border-accent/40 bg-accent/10 p-4"
      >
        <h3
          id={`${privacyCheckboxId}-heading`}
          className="text-sm font-semibold text-text-primary"
        >
          {PRIVACY_HEADING}
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
          {PRIVACY_BODY}
        </p>
        <label
          htmlFor={privacyCheckboxId}
          className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-text-primary"
        >
          <input
            ref={privacyCheckboxRef}
            id={privacyCheckboxId}
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
          <span>{PRIVACY_CHECKBOX_LABEL}</span>
        </label>
      </section>

      <AiAssistUploadZone
        file={file}
        onFileSelected={actions.setFile}
        clipboardEnabled={open}
        disabled={state === "extracting"}
      />
    </div>
  );

  const renderExtracting = () => (
    <div
      role="status"
      aria-label={READING_ANNOUNCEMENT}
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card/60 py-10 text-center"
    >
      <Loader2
        className="h-8 w-8 animate-spin text-accent"
        aria-hidden="true"
      />
      <p className="text-sm text-text-primary">Reading your screenshot…</p>
      <p className="text-xs text-text-secondary">
        This usually takes a few seconds.
      </p>
    </div>
  );

  const renderPreview = () => {
    if (!result) return null;
    // Build the final ExtractedFields shown in the preview so the user
    // reviews the FINAL description (composed with the contact-info line).
    const previewFields: ExtractedFields = {
      ...result.fields,
      description: composeDescription(result.fields),
    };

    return (
      <div className="space-y-5">
        <AiExtractionPreview
          fields={previewFields}
          confidences={result.confidences}
          geocode={result.geocode}
        />

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">
            Choose the photos to attach
          </h3>
          <AiPhotoPicker
            regions={result.regions}
            fullScreenshot={result.full_screenshot}
            selectedIds={selectedPhotoIds}
            onChange={setSelectedPhotoIds}
          />
        </div>

        {applyError ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
          >
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>{applyError}</span>
          </div>
        ) : null}
      </div>
    );
  };

  const renderError = () => {
    if (!error) return null;
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col gap-3 rounded-lg border p-4",
          isRateLimited
            ? "border-accent/40 bg-accent/10 text-text-primary"
            : "border-danger/40 bg-danger/10 text-danger"
        )}
      >
        <div className="flex items-start gap-2">
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  };

  // --- Body dispatcher -------------------------------------------------------

  const renderBody = () => {
    if (state === "error") {
      return renderError();
    }
    if (state === "extracting") {
      return renderExtracting();
    }
    if (state === "previewing" || state === "applying") {
      return renderPreview();
    }
    // idle / uploaded
    return renderPrivacyAndUpload();
  };

  // --- Footer buttons --------------------------------------------------------

  const renderFooter = () => {
    // Rate-limit case: NO retry button, "Fill manually" is the only action.
    if (state === "error" && isRateLimited) {
      return (
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" onClick={onClose} variant="default">
            {FILL_MANUALLY_BUTTON}
          </Button>
        </div>
      );
    }

    // Recoverable error: Try again + Fill manually.
    if (state === "error") {
      return (
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" onClick={onClose} variant="secondary">
            {FILL_MANUALLY_BUTTON}
          </Button>
          <Button
            type="button"
            onClick={handleRetryExtraction}
            variant="default"
            disabled={!hasFile}
          >
            {TRY_AGAIN_BUTTON}
          </Button>
        </div>
      );
    }

    // Previewing (or applying while uploading): Cancel + Apply to form.
    if (state === "previewing" || state === "applying") {
      return (
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" onClick={onClose} variant="secondary">
            {CANCEL_BUTTON}
          </Button>
          <Button
            ref={applyButtonRef}
            type="button"
            onClick={() => {
              void handleApply();
            }}
            disabled={!canApply}
            variant="default"
          >
            {uploading ? (
              <>
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Attaching photos…
              </>
            ) : (
              APPLY_BUTTON
            )}
          </Button>
        </div>
      );
    }

    // idle / uploaded / extracting: Cancel + Analyze screenshot.
    return (
      <div className="flex justify-end gap-2 border-t border-border p-4">
        <Button type="button" onClick={onClose} variant="secondary">
          {CANCEL_BUTTON}
        </Button>
        <Button
          type="button"
          onClick={handleAnalyze}
          disabled={state === "extracting" || !canAnalyze}
          variant="default"
        >
          {state === "extracting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Reading…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {ANALYZE_BUTTON}
            </>
          )}
        </Button>
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={subtitleId}
      initialFocusRef={privacyCheckboxRef}
    >
      {renderHeader()}

      {/* aria-live region: announces "Reading your screenshot" on start and
          the success message once extraction finishes (Requirement 13.5). */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      <div className="max-h-[calc(100vh-14rem)] overflow-y-auto p-6">
        {renderBody()}
      </div>

      {renderFooter()}
    </Modal>
  );
}
