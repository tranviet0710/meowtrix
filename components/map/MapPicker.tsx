"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
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

/** Component that imperatively flies to a position via ref callback */
function MapController({ flyTo }: { flyTo: [number, number] | null }) {
  const map = useMap();
  const lastFlyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!flyTo) return;
    const key = `${flyTo[0]},${flyTo[1]}`;
    if (lastFlyRef.current === key) return;
    lastFlyRef.current = key;
    map.setView(flyTo, 16, { animate: true });
  }, [map, flyTo]);

  return null;
}

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

/**
 * MapPicker — Leaflet-based map for selecting a location.
 * Features:
 * - Click to drop pin
 * - Address search with suggestions via OpenStreetMap Nominatim
 * - Geolocation fallback
 */
export default function MapPicker({ onLocationSelect, selectedLocation }: MapPickerProps) {
  const [center, setCenter] = useState<[number, number]>([13.7563, 100.5018]);
  const [isLocating, setIsLocating] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCenter([pos.coords.latitude, pos.coords.longitude]);
          setIsLocating(false);
        },
        () => {
          setIsLocating(false);
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    } else {
      setIsLocating(false);
    }
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (loc: { lat: number; lng: number }) => {
      onLocationSelect(loc);
    },
    [onLocationSelect]
  );

  // Debounced search as user types
  function handleSearchInput(value: string) {
    setSearchQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value.trim())}&limit=5&addressdetails=1`,
          { headers: { "User-Agent": "Meowtrix/1.0" } }
        );
        if (response.ok) {
          const results: SearchResult[] = await response.json();
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  }

  function handleSuggestionClick(result: SearchResult) {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setFlyTarget([lat, lng]);
    onLocationSelect({ lat, lng });
    setSearchQuery(result.display_name);
    setShowSuggestions(false);
    setSuggestions([]);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (suggestions.length > 0) {
      handleSuggestionClick(suggestions[0]);
    }
  }

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
    <div className="space-y-2">
      {/* Address Search with Suggestions */}
      <div ref={containerRef} className="relative">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            placeholder="Search address or place..."
            className="flex-1 rounded-[2px] border border-border bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Search for an address"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="min-h-[44px] min-w-[44px] rounded-[2px] border-[2px] border-accent bg-accent/10 px-3 py-2 text-sm font-bold uppercase text-accent transition-all hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Search address"
          >
            {isSearching ? "..." : "Go"}
          </button>
        </form>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-[2000] mt-1 w-full border-[2px] border-border bg-card shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((result, idx) => (
              <li key={idx}>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick(result)}
                  className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-accent/10 hover:text-accent transition-colors border-b border-border last:border-b-0 truncate"
                >
                  {result.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map */}
      <div
        className="relative h-[300px] overflow-hidden rounded-[2px] border border-accent/50"
        role="application"
        aria-label="Map picker - click to place a pin or search an address"
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
          <MapController flyTo={flyTarget} />
        </MapContainer>

        {/* Instruction overlay when no pin placed */}
        {!selectedLocation && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-[1000] -translate-x-1/2 rounded-[2px] bg-background/90 px-3 py-1.5 text-xs text-text-secondary backdrop-blur-sm border border-border">
            Click on the map or search an address to drop a pin
          </div>
        )}
      </div>
    </div>
  );
}
