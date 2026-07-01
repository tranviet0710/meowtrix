"use client";

import { useEffect, useState } from "react";
import { Settings, MapPin, Shield, Palette } from "lucide-react";
import { LocationConsentForm } from "@/components/forms/LocationConsentForm";
import { ThemeToggle } from "@/components/settings/ThemeToggle";

interface SettingsData {
  location_consent: boolean;
  residential_lat: number | null;
  residential_lng: number | null;
  residential_area: string;
  display_name: string;
  email: string;
}

/**
 * Settings Page — Manage location consent, notification preferences, theme,
 * and view account info.
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
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-[family-name:var(--font-space-grotesk)] font-bold text-text-primary">
            Settings
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Manage your preferences and account
          </p>
        </div>
      </div>

      {/* Theme — visible always, even during load */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-text-primary">
            Appearance
          </h2>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-[var(--shadow-soft)]">
          <p className="text-sm text-text-secondary mb-4">
            Pick a theme. You can switch anytime.
          </p>
          <ThemeToggle />
        </div>
      </section>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          <div className="h-20 rounded-xl border border-border bg-card animate-pulse" />
          <div className="h-[300px] rounded-xl border border-border bg-card animate-pulse" />
          <p className="text-center text-xs text-text-secondary">
            Loading your settings…
          </p>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)]">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-danger/10 mb-4">
            <span className="text-danger text-lg">⚠</span>
          </div>
          <p className="text-sm text-text-secondary mb-4">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg shadow-[var(--shadow-primary)] transition-all hover:-translate-y-0.5 hover:brightness-105"
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
              <MapPin className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-text-primary">
                Location &amp; Notifications
              </h2>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-[var(--shadow-soft)]">
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
              <Shield className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-text-primary">
                Account
              </h2>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 md:p-6 space-y-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Display name</span>
                <span className="text-sm text-text-primary">
                  {settings.display_name}
                </span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Email</span>
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
