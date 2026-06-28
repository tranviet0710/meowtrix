"use client";

import { useEffect, useState } from "react";
import { Settings, MapPin, Shield } from "lucide-react";
import { LocationConsentForm } from "@/components/forms/LocationConsentForm";

interface SettingsData {
  location_consent: boolean;
  residential_lat: number | null;
  residential_lng: number | null;
  residential_area: string;
  display_name: string;
  email: string;
}

/**
 * Settings Page — Allows Informants to manage their location consent
 * and notification preferences.
 *
 * Features:
 * - Fetches current settings from GET /api/settings
 * - Location consent toggle with interactive map picker
 * - MEOWTRIX spy-agency theme
 * - Loading and error states
 *
 * Requirements: 1.2, 1.11, 1.12
 */
export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch("/api/settings");
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to fetch settings");
        }
        const data: SettingsData = await response.json();
        setSettings(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-10 h-10 rounded-[2px] bg-accent/10 border border-accent/30">
          <Settings className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-text-primary uppercase tracking-wide">
            Informant Settings
          </h1>
          <p className="text-xs font-mono text-text-secondary mt-0.5">
            CONFIGURE YOUR OPERATIONAL PARAMETERS
          </p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          <div className="h-20 rounded-[2px] border border-border bg-card animate-pulse" />
          <div className="h-[300px] rounded-[2px] border border-border bg-card animate-pulse" />
          <p className="text-center text-xs font-mono text-text-secondary">
            LOADING CONFIGURATION...
          </p>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="rounded-[2px] border border-border bg-card p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[2px] bg-danger/10 border border-danger/30 mb-4">
            <span className="text-danger text-lg">⚠</span>
          </div>
          <p className="text-sm text-text-secondary mb-4">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-accent text-background rounded-[2px] hover:bg-accent-hover transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Settings Content */}
      {!isLoading && !error && settings && (
        <div className="space-y-8">
          {/* Location & Notifications Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                Location & Notifications
              </h2>
            </div>
            <div className="rounded-[2px] border border-border bg-card p-4 md:p-6">
              <LocationConsentForm
                initialConsent={settings.location_consent}
                initialLat={settings.residential_lat}
                initialLng={settings.residential_lng}
                initialArea={settings.residential_area}
              />
            </div>
          </section>

          {/* Account Info Section (read-only) */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                Account Information
              </h2>
            </div>
            <div className="rounded-[2px] border border-border bg-card p-4 md:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-text-secondary uppercase">
                  Callsign
                </span>
                <span className="text-sm text-text-primary">
                  {settings.display_name}
                </span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-text-secondary uppercase">
                  Encrypted Channel
                </span>
                <span className="text-sm text-text-primary">
                  {settings.email}
                </span>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
