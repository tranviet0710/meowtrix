"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ConfidenceLabel,
  ExtractedFields,
  ExtractedFieldConfidences,
  ExtractionSuccess,
} from "@/types/ai";

/**
 * AiExtractionPreview — read-only list of AI-extracted fields with confidence
 * chips, a "double-check this" caption on low-confidence rows, and one of three
 * geocoding banners under the address row.
 *
 * The `description` value shown here is the FINAL composed string — the parent
 * (`AiAssistModal`) is responsible for appending the contact-info line to the
 * raw AI description before passing it in (Requirement 9.5).
 *
 * Contact-info rows (phone + name) are visually grouped under a subhead so it
 * is obvious the info will be added to the notes, not to any owner-identity
 * field (Requirement 9.3). If both are null the group is hidden entirely
 * (Requirement 9.4).
 *
 * _Requirements: 5.3, 5.4, 5.5, 7.1, 7.2, 9.1, 9.2, 9.5_
 */
export interface AiExtractionPreviewProps {
  /** The final field values shown in the preview. `description` is composed. */
  fields: ExtractedFields;
  /** Per-field confidence labels; null when the field itself is null. */
  confidences: ExtractedFieldConfidences;
  /** Geocode block from the server response — drives the address-row banner. */
  geocode: ExtractionSuccess["geocode"];
}

// --- Copy ---------------------------------------------------------------------

const LOW_CAPTION = "Please double-check this";
const CONTACT_SUBHEAD = "Contact info from the original post (added to notes)";

const GEOCODE_BANNER: Record<
  ExtractionSuccess["geocode"]["reason"],
  { icon: React.ReactNode; text: string; tone: "success" | "warning" } | null
> = {
  matched: {
    icon: (
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    ),
    text: "Placed on the map for you",
    tone: "success",
  },
  no_results: {
    icon: (
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    ),
    text: "We couldn't map this address. Drop the pin yourself",
    tone: "warning",
  },
  geocoder_unavailable: {
    icon: (
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    ),
    text: "Automatic mapping is unavailable. Drop the pin yourself",
    tone: "warning",
  },
  // AI returned no address; no banner shown (row itself is hidden).
  no_address: null,
};

// --- Confidence chip ---------------------------------------------------------

const CHIP_BASE =
  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider";

const CHIP_TONE: Record<ConfidenceLabel, string> = {
  high: "bg-success/15 text-success",
  medium: "bg-accent/15 text-accent",
  low: "bg-danger/15 text-danger",
};

function ConfidenceChip({ level }: { level: ConfidenceLabel }) {
  return (
    <span className={cn(CHIP_BASE, CHIP_TONE[level])} aria-label={`Confidence: ${level}`}>
      {level}
    </span>
  );
}

// --- Row primitive ------------------------------------------------------------

interface PreviewRowProps {
  label: string;
  value: string;
  confidence: ConfidenceLabel | null;
  /** Optional extra content rendered below the value (e.g. geocoding banner). */
  extra?: React.ReactNode;
  /** Render the value in monospace (used for phone numbers). */
  mono?: boolean;
  /** Preserve newlines in the value (used for the composed description). */
  preserveWhitespace?: boolean;
}

function PreviewRow({
  label,
  value,
  confidence,
  extra,
  mono = false,
  preserveWhitespace = false,
}: PreviewRowProps) {
  return (
    <div className="rounded-lg border border-border bg-card/60 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium text-text-secondary">{label}</p>
          <p
            className={cn(
              "text-sm text-text-primary",
              mono && "font-mono",
              preserveWhitespace && "whitespace-pre-wrap break-words"
            )}
          >
            {value}
          </p>
        </div>
        {confidence ? (
          <div className="shrink-0 pt-0.5">
            <ConfidenceChip level={confidence} />
          </div>
        ) : null}
      </div>

      {extra ? <div className="mt-2">{extra}</div> : null}

      {confidence === "low" ? (
        <p className="mt-1.5 text-xs text-danger">{LOW_CAPTION}</p>
      ) : null}
    </div>
  );
}

// --- Address row extra content ----------------------------------------------

function GeocodeBanner({
  reason,
}: {
  reason: ExtractionSuccess["geocode"]["reason"];
}) {
  const banner = GEOCODE_BANNER[reason];
  if (!banner) return null;

  const toneClass =
    banner.tone === "success"
      ? "border-success/40 bg-success/10 text-success"
      : "border-accent/40 bg-accent/10 text-accent";

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs",
        toneClass
      )}
    >
      {banner.icon}
      <span>{banner.text}</span>
    </div>
  );
}

// --- Main component ----------------------------------------------------------

export function AiExtractionPreview({
  fields,
  confidences,
  geocode,
}: AiExtractionPreviewProps) {
  const hasContact = fields.contact_phone != null || fields.contact_name != null;

  return (
    <div className="space-y-3">
      {fields.pet_name != null && (
        <PreviewRow
          label="Pet name"
          value={fields.pet_name}
          confidence={confidences.pet_name}
        />
      )}

      {fields.pet_type != null && (
        <PreviewRow
          label="Pet type"
          value={fields.pet_type === "cat" ? "Cat" : "Dog"}
          confidence={confidences.pet_type}
        />
      )}

      {fields.description != null && (
        <PreviewRow
          label="Description"
          value={fields.description}
          confidence={confidences.description}
          preserveWhitespace
        />
      )}

      {fields.last_seen_address_text != null && (
        <PreviewRow
          label="Last-seen address"
          value={fields.last_seen_address_text}
          confidence={confidences.last_seen_address_text}
          extra={<GeocodeBanner reason={geocode.reason} />}
        />
      )}

      {fields.last_seen_at != null && (
        <PreviewRow
          label="Last-seen time"
          value={fields.last_seen_at}
          confidence={confidences.last_seen_at}
        />
      )}

      {hasContact && (
        <div className="space-y-3 pt-1">
          <h4 className="text-xs font-semibold text-text-secondary">
            {CONTACT_SUBHEAD}
          </h4>

          {fields.contact_phone != null && (
            <PreviewRow
              label="Contact phone (reference)"
              value={fields.contact_phone}
              confidence={confidences.contact_phone}
              mono
            />
          )}

          {fields.contact_name != null && (
            <PreviewRow
              label="Contact name (reference)"
              value={fields.contact_name}
              confidence={confidences.contact_name}
            />
          )}
        </div>
      )}
    </div>
  );
}
