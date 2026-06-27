"use client";

import { useCallback, useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapPickerProps {
  onLocationSelect: (location: { lat: number; lng: number }) => void;
  selectedLocation: { lat: number; lng: number } | null;
}

// Custom yellow pin icon matching the app's accent color
const pinIcon = new L.Icon({
  iconUrl: "data:image/svg+xml," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z" fill="#FFCC00" stroke="#0A0A0F" stroke-width="1.5"/>
      <circle cx="14" cy="14" r="6" fill="#0A0A0F"/>
    </svg>
  `),
  iconSize: [28, 40],
  iconAnchor: [14, 40],
  popupAnchor: [0, -40],
});

/** Inner component to handle map click events */
function LocationMarker({
  position,
  onSelect,
}: {
  position: { lat: number; lng: number } | null;
  onSelect: (loc: { lat: number; lng: number }) => void;
}) {
  useMapEvents({
    click(e) {
      onSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  if (!position) return null;

  return <Marker position={[position.lat, position.lng]} icon={pinIcon} />;
}

/**
 * MapPicker — Leaflet-based map for selecting a residential location.
 * Uses OpenStreetMap tiles so users can see streets/landmarks to orient themselves.
 * Falls back to geolocation, then Bangkok default.
 */
export default function MapPicker({ onLocationSelect, selectedLocation }: MapPickerProps) {
  const [center, setCenter] = useState<[number, number]>([13.7563, 100.5018]); // Bangkok default
  const [isLocating, setIsLocating] = useState(true);

  useEffect(() => {
    // Try browser geolocation to center the map on the user's actual location
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCenter([pos.coords.latitude, pos.coords.longitude]);
          setIsLocating(false);
        },
        () => {
          // Geolocation denied or failed — use default
          setIsLocating(false);
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    } else {
      setIsLocating(false);
    }
  }, []);

  const handleSelect = useCallback(
    (loc: { lat: number; lng: number }) => {
      onLocationSelect(loc);
    },
    [onLocationSelect]
  );

  if (isLocating) {
    return (
      <div
        className="flex h-[300px] items-center justify-center rounded-[2px] border border-border bg-card"
        role="status"
        aria-label="Detecting location"
      >
        <p className="animate-pulse text-sm text-text-secondary">
          Detecting your location...
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative h-[300px] overflow-hidden rounded-[2px] border border-accent/50"
      role="application"
      aria-label="Map picker - click to place a pin on your residential area"
    >
      <MapContainer
        center={center}
        zoom={13}
        minZoom={3}
        maxZoom={18}
        zoomControl={true}
        className="h-full w-full"
        style={{ height: "100%", width: "100%", borderRadius: "2px" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker position={selectedLocation} onSelect={handleSelect} />
      </MapContainer>

      {/* Instruction overlay when no pin placed */}
      {!selectedLocation && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-[1000] -translate-x-1/2 rounded-[2px] bg-background/90 px-3 py-1.5 text-xs text-text-secondary backdrop-blur-sm border border-border">
          Click on the map to drop a pin
        </div>
      )}
    </div>
  );
}
