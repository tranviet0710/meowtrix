"use client";

import { useMemo } from "react";
import { Marker } from "react-leaflet";
import L from "leaflet";

// --- Types ---

export interface AvatarMarkerProps {
  position: [number, number];
  type: "overlord" | "agent";
  status: "active" | "resolved";
  photoUrl?: string;
  petType?: "cat" | "dog";
  altLabel?: string;
  children?: React.ReactNode; // popup content
}

// --- Constants ---

/**
 * Missing-pet marker ring color (warm coral).
 * Kept as a fixed hex because Leaflet div-icons don't reliably inherit
 * CSS variables. Tuned to stay legible on the light OSM tile background
 * regardless of the app's current theme.
 */
const OVERLORD_COLOR = "#EF5B5B";

/** Sighting marker ring color (soft mint). */
const AGENT_COLOR = "#52B87F";

/** Avatar marker size in pixels */
const MARKER_SIZE = 48;

/** Ring thickness (part of MARKER_SIZE) */
const RING_WIDTH = 3;

// --- Helpers ---

/**
 * Escape user-provided strings that are interpolated into the raw HTML string
 * we pass to Leaflet's divIcon. Prevents accidental HTML injection from photo
 * URLs or alt labels.
 */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Build the div-icon HTML for a circular pet avatar with a colored ring.
 * Falls back to a paw glyph when no photo URL is available.
 */
function buildAvatarHtml(
  color: string,
  isPulsing: boolean,
  photoUrl: string | undefined,
  petType: "cat" | "dog" | undefined,
  altLabel: string
): string {
  const safePhotoUrl = photoUrl ? escapeAttr(photoUrl) : null;
  const safeAlt = escapeAttr(altLabel);
  const fallbackGlyph = petType === "dog" ? "🐶" : "🐱";
  const pulseClass = isPulsing ? " meowtrix-avatar-pulse" : "";

  const inner = safePhotoUrl
    ? `<img src="${safePhotoUrl}" alt="${safeAlt}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.parentElement.dataset.fallback='1';this.parentElement.innerHTML='<span style=&quot;font-size:22px;line-height:1;&quot;>${fallbackGlyph}</span>';this.parentElement.style.display='flex';this.parentElement.style.alignItems='center';this.parentElement.style.justifyContent='center';" />`
    : `<span style="font-size:22px;line-height:1;">${fallbackGlyph}</span>`;

  return `
    <div class="meowtrix-avatar-marker-wrapper${pulseClass}"
         style="width:${MARKER_SIZE}px;height:${MARKER_SIZE}px;position:relative;">
      <div style="width:100%;height:100%;border-radius:9999px;
                  border:${RING_WIDTH}px solid ${color};
                  box-shadow:0 0 0 2px #0A0A0F,0 4px 12px rgba(0,0,0,0.55),0 0 12px ${color}55;
                  overflow:hidden;background:#1A1A2E;display:flex;
                  align-items:center;justify-content:center;">
        ${inner}
      </div>
    </div>
  `;
}

/**
 * Create a Leaflet DivIcon for the circular avatar marker.
 */
function createAvatarDivIcon(
  type: "overlord" | "agent",
  status: "active" | "resolved",
  photoUrl: string | undefined,
  petType: "cat" | "dog" | undefined,
  altLabel: string
): L.DivIcon {
  const color = type === "overlord" ? OVERLORD_COLOR : AGENT_COLOR;
  const isPulsing = type === "overlord" && status === "active";
  const html = buildAvatarHtml(color, isPulsing, photoUrl, petType, altLabel);

  return L.divIcon({
    html,
    className: "meowtrix-avatar-marker",
    iconSize: [MARKER_SIZE, MARKER_SIZE],
    iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
    popupAnchor: [0, -MARKER_SIZE / 2 - 2],
  });
}

// --- Component ---

/**
 * AvatarMarker — Circular pet-photo pin for the operations map.
 *
 * - Overlords (lost) get a red ring (#FF4444). Active Overlords also pulse.
 * - Agents (found) get a green ring (#00FF88).
 * - If no photo is available, falls back to a paw emoji inside the ring.
 */
export function AvatarMarker({
  position,
  type,
  status,
  photoUrl,
  petType,
  altLabel,
  children,
}: AvatarMarkerProps) {
  const resolvedAlt =
    altLabel ??
    (type === "overlord"
      ? `Missing pet marker${status === "active" ? " — active search" : ""}`
      : `Spotted pet marker`);

  const icon = useMemo(
    () => createAvatarDivIcon(type, status, photoUrl, petType, resolvedAlt),
    [type, status, photoUrl, petType, resolvedAlt]
  );

  return (
    <Marker position={position} icon={icon} alt={resolvedAlt}>
      {children}
    </Marker>
  );
}
