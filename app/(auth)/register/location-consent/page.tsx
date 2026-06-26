"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Dynamically import the map picker with SSR disabled (Leaflet requires DOM)
const MapPicker = dynamic(() => import("@/components/map/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center rounded-[2px] border border-border bg-background">
      <p className="text-sm text-text-secondary">Loading map...</p>
    </div>
  ),
});

interface SelectedLocation {
  lat: number;
  lng: number;
}

export default function LocationConsentPage() {
  const router = useRouter();

  const [consent, setConsent] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError("");

    if (consent && !selectedLocation) {
      setError("Please drop a pin on the map to set your residential area");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_consent: consent,
          residential_lat: consent ? selectedLocation?.lat : null,
          residential_lng: consent ? selectedLocation?.lng : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save location preference");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  function handleSkip() {
    // Skip without saving location — redirect directly to dashboard
    router.push("/dashboard");
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="text-center">
        <CardTitle className="text-xl text-text-primary">
          Location Consent
        </CardTitle>
        <CardDescription className="mt-2 max-w-sm mx-auto">
          MEOWTRIX uses your residential location to alert you when cats go
          missing nearby. Without this, you won&apos;t receive proximity
          notifications.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-[2px] border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Consent Toggle */}
        <div className="flex items-center justify-between rounded-[2px] border border-border p-4">
          <div className="space-y-1">
            <Label htmlFor="location-consent" className="text-sm font-medium">
              Enable nearby alerts
            </Label>
            <p className="text-xs text-text-secondary">
              Receive notifications about missing cats in your area
            </p>
          </div>
          <Switch
            id="location-consent"
            checked={consent}
            onCheckedChange={setConsent}
            aria-label="Enable location-based notifications"
          />
        </div>

        {/* Map Picker — only shown when consent is ON */}
        {consent && (
          <div className="space-y-2">
            <Label className="text-sm">
              Drop a pin on your approximate residential area
            </Label>
            <MapPicker
              onLocationSelect={(loc) => setSelectedLocation(loc)}
              selectedLocation={selectedLocation}
            />
            {selectedLocation && (
              <p className="text-xs text-text-secondary font-mono">
                📍 {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={handleSkip}
            disabled={loading}
          >
            Skip
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
