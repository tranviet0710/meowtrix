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
 *
 * Displays:
 * - Photo thumbnail (80×80px) if available
 * - Name or description text
 * - Locale-formatted timestamp
 * - Type badge (Overlord/Agent)
 */
export function MapPopup({
  photoUrl,
  name,
  description,
  timestamp,
  type,
}: MapPopupProps) {
  const typeLabel = type === "overlord" ? "Lost Overlord" : "Spotted Agent";
  const typeColor = type === "overlord" ? "#FF4444" : "#00FF88";
  const formattedTime = formatTimestamp(timestamp);

  return (
    <Popup>
      <div
        className="flex gap-3 p-1"
        style={{ minWidth: "200px", maxWidth: "280px" }}
      >
        {/* Photo thumbnail */}
        {photoUrl && (
          <div
            className="shrink-0 overflow-hidden rounded-[2px] border border-border"
            style={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }}
          >
            <img
              src={photoUrl}
              alt={name ? `Photo of ${name}` : `${typeLabel} photo`}
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
            className="inline-block w-fit rounded-[2px] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: `${typeColor}20`,
              color: typeColor,
              border: `1px solid ${typeColor}40`,
            }}
          >
            {typeLabel}
          </span>

          {/* Name */}
          {name && (
            <p
              className="truncate text-sm font-medium"
              style={{ color: "#E6E6E6" }}
              title={name}
            >
              {name}
            </p>
          )}

          {/* Description */}
          {description && !name && (
            <p
              className="line-clamp-2 text-xs"
              style={{ color: "#8892B0" }}
              title={description}
            >
              {description}
            </p>
          )}

          {/* Description shown below name when both exist */}
          {description && name && (
            <p
              className="line-clamp-2 text-xs"
              style={{ color: "#8892B0" }}
              title={description}
            >
              {description}
            </p>
          )}

          {/* Timestamp */}
          <p
            className="text-[11px]"
            style={{ color: "#8892B0", fontFamily: "var(--font-mono)" }}
          >
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
 * MapEmptyState — Message displayed when no Overlord or Agent records exist.
 */
export function MapEmptyState({ className = "" }: MapEmptyStateProps) {
  return (
    <div
      className={`absolute inset-0 z-[1000] flex items-center justify-center pointer-events-none ${className}`}
    >
      <div className="pointer-events-auto rounded-[2px] border border-border bg-card/95 px-6 py-4 text-center shadow-lg backdrop-blur-sm">
        <div className="mb-2 text-2xl">🐾</div>
        <p className="text-sm font-medium text-text-primary">
          No field reports yet
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          Report a lost Overlord or a spotted Agent to see pins on the map.
        </p>
      </div>
    </div>
  );
}
