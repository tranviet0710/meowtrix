"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Dynamically import MapPicker with SSR disabled (Leaflet requires DOM)
const MapPicker = dynamic(() => import("@/components/map/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center rounded-[2px] border border-border bg-background">
      <p className="animate-pulse text-sm text-text-secondary">Loading map...</p>
    </div>
  ),
});

interface LocationConsentFormProps {
  initialConsent: boolean;
  initialLat: number | null;
  initialLng: number | null;
}

/**
 * LocationConsentForm — Manages location consent toggle and map picker
 * for the settings page.
 *
 * When toggled ON: displays the map picker for coordinate selection.
 * When toggled OFF: clears coordinates to null.
 *
 * Requirements: 1.2, 1.11, 1.12
 */
export function LocationConsentForm({
  initialConsent,
  initialLat,
  initialLng,
}: LocationConsentFormProps) {
  const [consent, setConsent] = useState(initialConsent);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(
    initialLat != null && initialLng != null
      ? { lat: initialLat, lng: initialLng }
      : null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleToggle = useCallback((checked: boolean) => {
    setConsent(checked);
    setError("");
    setSuccess("");
    // When toggling off, we don't clear selectedLocation immediately
    // so the user can toggle back on without losing the pin
  }, []);

  const handleLocationSelect = useCallback(
    (location: { lat: number; lng: number }) => {
      setSelectedLocation(location);
      setError("");
      setSuccess("");
    },
    []
  );

  async function handleSave() {
    setError("");
    setSuccess("");

    if (consent && !selectedLocation) {
      setError("Please drop a pin on the map to set your residential area.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_consent: consent,
          residential_lat: consent ? selectedLocation?.lat : null,
          residential_lng: consent ? selectedLocation?.lng : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update settings.");
        return;
      }

      setSuccess("Settings updated successfully.");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const hasChanges =
    consent !== initialConsent ||
    (consent &&
      selectedLocation &&
      (selectedLocation.lat !== initialLat ||
        selectedLocation.lng !== initialLng));

  return (
    <div className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="rounded-[2px] border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="rounded-[2px] border border-success/50 bg-success/10 px-4 py-3 text-sm text-success">
          {success}
        </div>
      )}

      {/* Consent Toggle */}
      <div className="flex items-center justify-between rounded-[2px] border border-border bg-card p-4">
        <div className="space-y-1 pr-4">
          <Label htmlFor="location-consent-toggle" className="text-sm font-medium text-text-primary">
            Enable nearby missing cat alerts
          </Label>
          <p className="text-xs text-text-secondary leading-relaxed">
            MEOWTRIX will notify you when cats go missing in your area.
            Without this, you won&apos;t receive proximity notifications.
          </p>
        </div>
        <Switch
          id="location-consent-toggle"
          checked={consent}
          onCheckedChange={handleToggle}
          aria-label="Enable location-based notifications"
        />
      </div>

      {/* Map Picker — shown when consent is ON */}
      {consent && (
        <div className="space-y-3">
          <Label className="text-sm text-text-primary">
            Drop a pin on your approximate residential area
          </Label>
          <MapPicker
            onLocationSelect={handleLocationSelect}
            selectedLocation={selectedLocation}
          />
          {selectedLocation && (
            <p className="text-xs font-mono text-text-secondary">
              📍 {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}
            </p>
          )}
        </div>
      )}

      {/* Opt-out notice when consent is OFF */}
      {!consent && (
        <div className="rounded-[2px] border border-border bg-card/50 px-4 py-3">
          <p className="text-xs text-text-secondary leading-relaxed">
            ⚠ You will not receive alerts about missing cats in your area.
            You can enable this at any time.
          </p>
        </div>
      )}

      {/* Current location preview when consent is ON and location is set */}
      {consent && initialLat != null && initialLng != null && !hasChanges && (
        <div className="rounded-[2px] border border-accent/20 bg-accent/5 px-4 py-3">
          <p className="text-xs font-mono text-text-secondary">
            CURRENT LOCATION: {initialLat.toFixed(5)}, {initialLng.toFixed(5)}
          </p>
        </div>
      )}

      {/* Save button */}
      <Button
        type="button"
        onClick={handleSave}
        disabled={saving || !hasChanges}
        className="w-full"
      >
        {saving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}
