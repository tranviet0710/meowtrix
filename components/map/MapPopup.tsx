"use client";

import { Popup } from "react-leaflet";

// --- Types ---

export interface MapPopupProps {
  photoUrl?: string;
  name?: string;
  description?: string;
  timestamp: string; // ISO string, format to locale
  type: "overlord" | "agent";
}

// --- Constants ---

/** Photo thumbnail dimensions in pixels */
const THUMBNAIL_SIZE = 80;

// --- Helpers ---

/**
 * Formats an ISO timestamp to the user's locale date/time string.
 */
function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return "Unknown time";
    }
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Unknown time";
  }
}

// --- Component ---

/**
 * MapPopup — Popup content displayed when clicking a map marker.
 * Warm, rounded card with photo, name, notes, and time.
 */
export function MapPopup({
  photoUrl,
  name,
  description,
  timestamp,
  type,
}: MapPopupProps) {
  const typeLabel = type === "overlord" ? "Missing" : "Sighting";
  const badgeClass =
    type === "overlord"
      ? "bg-danger/15 text-danger border-danger/40"
      : "bg-success/15 text-success border-success/40";
  const formattedTime = formatTimestamp(timestamp);

  return (
    <Popup>
      <div
        className="flex gap-3 p-1"
        style={{ minWidth: "220px", maxWidth: "280px" }}
      >
        {/* Photo thumbnail */}
        {photoUrl && (
          <div
            className="shrink-0 overflow-hidden rounded-lg border border-border"
            style={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }}
          >
            <img
              src={photoUrl}
              alt={name ? `Photo of ${name}` : `${typeLabel} pet photo`}
              className="h-full w-full object-cover"
              style={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }}
              loading="lazy"
            />
          </div>
        )}

        {/* Info section */}
        <div className="flex min-w-0 flex-col justify-center gap-1">
          {/* Type badge */}
          <span
            className={`inline-block w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}
          >
            {typeLabel}
          </span>

          {/* Name */}
          {name && (
            <p
              className="truncate text-sm font-semibold text-text-primary"
              title={name}
            >
              {name}
            </p>
          )}

          {/* Description */}
          {description && (
            <p
              className="line-clamp-2 text-xs text-text-secondary"
              title={description}
            >
              {description}
            </p>
          )}

          {/* Timestamp */}
          <p className="text-[11px] text-text-secondary">
            {formattedTime}
          </p>
        </div>
      </div>
    </Popup>
  );
}

// --- Empty State ---

export interface MapEmptyStateProps {
  className?: string;
}

/**
 * MapEmptyState — Message displayed when no missing pet records exist.
 */
export function MapEmptyState({ className = "" }: MapEmptyStateProps) {
  return (
    <div
      className={`absolute inset-0 z-[1000] flex items-center justify-center pointer-events-none ${className}`}
    >
      <div className="pointer-events-auto rounded-2xl border border-border bg-card/95 px-6 py-4 text-center shadow-[var(--shadow-md)] backdrop-blur-sm">
        <div className="mb-2 text-3xl">🐾</div>
        <p className="text-sm font-semibold text-text-primary">
          No missing pets nearby
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          Everything looks quiet right now. Report a missing pet or log a
          sighting to help your community.
        </p>
      </div>
    </div>
  );
}
