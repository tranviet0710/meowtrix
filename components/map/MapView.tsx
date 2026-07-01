"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getMapCenter } from "@/lib/mapCenter";
import type { MapCenterResult } from "@/lib/mapCenter";

// Re-export for convenience
export { getMapCenter } from "@/lib/mapCenter";
export type { MapCenterResult } from "@/lib/mapCenter";

// --- Constants ---

/** Minimum and maximum zoom levels */
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;

/** Data fetch timeout in milliseconds */
const FETCH_TIMEOUT_MS = 10_000;

// --- Types ---

export interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  children?: React.ReactNode;
  onMapReady?: (map: L.Map) => void;
  className?: string;
}

// --- MapView Component ---

/**
 * MapView — Core interactive map component using Leaflet.js with OpenStreetMap tiles.
 *
 * Features:
 * - Zoom levels 3-18 with panning
 * - Center fallback logic: prop → geolocation → residential → Bangkok
 * - Loading skeleton during initialization
 * - Error state with retry on 10-second timeout
 * - Passes map instance to parent via onMapReady callback
 */
export function MapView({
  center,
  zoom,
  children,
  onMapReady,
  className = "",
}: MapViewProps) {
  const [mapCenter, setMapCenter] = useState<MapCenterResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initializeMap = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Set up a timeout to show error if initialization takes too long
    const timeoutId = setTimeout(() => {
      setError("Map initialization timed out. Please try again.");
      setIsLoading(false);
    }, FETCH_TIMEOUT_MS);

    try {
      // Get residential coords from localStorage (set during auth flow)
      let residentialCoords: [number, number] | null = null;
      if (typeof window !== "undefined") {
        const storedLat = localStorage.getItem("meowtrix_residential_lat");
        const storedLng = localStorage.getItem("meowtrix_residential_lng");
        if (storedLat && storedLng) {
          const lat = parseFloat(storedLat);
          const lng = parseFloat(storedLng);
          if (!isNaN(lat) && !isNaN(lng)) {
            residentialCoords = [lat, lng];
          }
        }
      }

      const result = await getMapCenter(center, zoom, { residentialCoords });
      clearTimeout(timeoutId);
      setMapCenter(result);
      setIsLoading(false);
    } catch {
      clearTimeout(timeoutId);
      setError("Failed to initialize map. Please try again.");
      setIsLoading(false);
    }
  }, [center, zoom]);

  useEffect(() => {
    initializeMap();
  }, [initializeMap]);

  // Handle retry
  const handleRetry = useCallback(() => {
    initializeMap();
  }, [initializeMap]);

  // Keep onMapReady in a ref so the MapContainer ref callback is stable and
  // does not re-run on every render. React-Leaflet v5 + React 19 can misbehave
  // when the ref callback identity changes (double-invoking init, or having a
  // return value treated as a cleanup fn).
  const onMapReadyRef = useRef(onMapReady);
  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  const mapInstanceRef = useRef<L.Map | null>(null);
  const setMapRef = useCallback((map: L.Map | null) => {
    if (map && map !== mapInstanceRef.current) {
      mapInstanceRef.current = map;
      onMapReadyRef.current?.(map);
    }
    // Return undefined explicitly — React 19 treats a returned value as a
    // cleanup function, which is not what we want here.
    return undefined;
  }, []);

  // Loading skeleton
  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center rounded-[2px] border border-border bg-card w-full h-full min-h-[50vh] ${className}`}
        role="status"
        aria-label="Loading map"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-accent/20" />
          <p className="animate-pulse text-sm text-text-secondary">
            Loading map...
          </p>
        </div>
      </div>
    );
  }

  // Error state with retry
  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-[2px] border border-danger/50 bg-card w-full h-full min-h-[50vh] ${className}`}
        role="alert"
        aria-label="Map error"
      >
        <div className="flex flex-col items-center gap-3 px-4 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/10">
            <svg
              className="h-5 w-5 text-danger"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <p className="text-sm text-text-primary">{error}</p>
          <button
            onClick={handleRetry}
            className="min-h-[44px] min-w-[44px] rounded-[2px] border border-accent bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label="Retry loading the map"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!mapCenter) {
    return null;
  }

  return (
    <MapContainer
      center={mapCenter.center}
      zoom={mapCenter.zoom}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      zoomControl={false}
      className={`rounded-[2px] ${className}`}
      style={{ height: "100%", width: "100%" }}
      ref={setMapRef}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="bottomright" />
      {children}
    </MapContainer>
  );
}
