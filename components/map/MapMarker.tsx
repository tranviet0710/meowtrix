"use client";

import { useMemo } from "react";
import { Marker } from "react-leaflet";
import L from "leaflet";

// --- Types ---

export interface MapMarkerProps {
  position: [number, number];
  type: "overlord" | "agent";
  status: "active" | "resolved";
  children?: React.ReactNode; // popup content
}

// --- Constants ---

/** Overlord marker color (danger red) */
const OVERLORD_COLOR = "#FF4444";

/** Agent marker color (success green) */
const AGENT_COLOR = "#00FF88";

/** Marker size in pixels */
const MARKER_SIZE = 24;

/** Anchor point (center bottom of the marker) */
const ICON_ANCHOR: [number, number] = [MARKER_SIZE / 2, MARKER_SIZE];

/** Popup anchor (top center of the marker) */
const POPUP_ANCHOR: [number, number] = [0, -MARKER_SIZE];

// --- Helpers ---

/**
 * Creates an SVG pin icon with optional CSS pulsing animation.
 * The pin is a classic teardrop marker shape.
 */
function createMarkerSvg(color: string, isPulsing: boolean): string {
  const pulseId = isPulsing ? "meowtrix-pulse" : "";
  const animationStyle = isPulsing
    ? `<style>
        @keyframes meowtrix-marker-pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.85; }
          100% { transform: scale(1); opacity: 1; }
        }
        .pulse-marker {
          animation: meowtrix-marker-pulse 1.5s ease-in-out infinite;
          transform-origin: center bottom;
        }
      </style>`
    : "";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${MARKER_SIZE}" height="${MARKER_SIZE}" viewBox="0 0 24 24" ${isPulsing ? `class="pulse-marker"` : ""}>
      ${animationStyle}
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" 
            fill="${color}" 
            stroke="#0A0A0F" 
            stroke-width="1.5"
            ${pulseId ? `id="${pulseId}"` : ""}/>
      <circle cx="12" cy="9" r="3" fill="#0A0A0F" opacity="0.6"/>
    </svg>
  `;
}

/**
 * Creates a Leaflet DivIcon with the styled marker SVG.
 */
function createDivIcon(type: "overlord" | "agent", status: "active" | "resolved"): L.DivIcon {
  const color = type === "overlord" ? OVERLORD_COLOR : AGENT_COLOR;
  const isPulsing = type === "overlord" && status === "active";

  const html = createMarkerSvg(color, isPulsing);

  return L.divIcon({
    html,
    className: "meowtrix-map-marker",
    iconSize: [MARKER_SIZE, MARKER_SIZE],
    iconAnchor: ICON_ANCHOR,
    popupAnchor: POPUP_ANCHOR,
  });
}

// --- Component ---

/**
 * MapMarker — Custom styled map pin component for Overlords and Agents.
 *
 * - Overlords use red (#FF4444) pins
 * - Agents use green (#00FF88) pins
 * - Unresolved Overlord pins pulse with a 1.5-second CSS animation cycle
 *
 * Children are rendered inside a Popup when the marker is clicked.
 */
export function MapMarker({ position, type, status, children }: MapMarkerProps) {
  const icon = useMemo(() => createDivIcon(type, status), [type, status]);

  return (
    <Marker
      position={position}
      icon={icon}
      alt={
        type === "overlord"
          ? `Lost Overlord marker${status === "active" ? " (active search)" : " (resolved)"}`
          : `Spotted Agent marker${status === "active" ? " (active)" : " (resolved)"}`
      }
    >
      {children}
    </Marker>
  );
}
