"use client";

import { useState } from "react";

interface MapPickerProps {
  onLocationSelect: (location: { lat: number; lng: number }) => void;
  selectedLocation: { lat: number; lng: number } | null;
}

/**
 * MapPicker — Placeholder for the Leaflet-based map picker.
 * The full Leaflet implementation will be built in task 12.1.
 * For now, this renders a clickable area that simulates pin placement.
 */
export default function MapPicker({ onLocationSelect, selectedLocation }: MapPickerProps) {
  const [hasClicked, setHasClicked] = useState(!!selectedLocation);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Map click position to lat/lng (rough approximation for placeholder)
    // Default center: Bangkok 13.7563, 100.5018 with some spread
    const lat = 13.7563 + (0.5 - y) * 0.1;
    const lng = 100.5018 + (x - 0.5) * 0.1;

    setHasClicked(true);
    onLocationSelect({ lat, lng });
  }

  return (
    <div
      onClick={handleClick}
      className="relative flex h-[300px] cursor-crosshair items-center justify-center overflow-hidden rounded-[2px] border border-border bg-background transition-colors hover:border-accent/50"
      role="application"
      aria-label="Map picker - click to place a pin on your residential area"
    >
      {/* Grid pattern background to simulate map tiles */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: "linear-gradient(rgba(255,204,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,204,0,0.3) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {hasClicked && selectedLocation ? (
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Pin indicator */}
          <div className="flex flex-col items-center gap-1">
            <div className="h-4 w-4 rounded-full border-2 border-accent bg-accent/30 shadow-[0_0_8px_rgba(255,204,0,0.5)]" />
            <div className="h-3 w-0.5 bg-accent" />
          </div>
        </div>
      ) : (
        <div className="z-10 text-center px-4">
          <p className="text-sm text-text-secondary">
            Click anywhere to drop a pin
          </p>
          <p className="mt-1 text-xs text-text-secondary/70">
            Leaflet map will be available in a future update
          </p>
        </div>
      )}
    </div>
  );
}
