"use client";

import { useCallback, useEffect, useState } from "react";
import { User, Mail, Star, Target, Calendar, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";

interface InformantProfile {
  id: string;
  email: string;
  display_name: string;
  residential_area: string;
  residential_lat: number | null;
  residential_lng: number | null;
  location_consent: boolean;
  total_points: number;
  successful_matches: number;
  first_match_at: string | null;
  created_at: string;
}

interface PageState {
  profile: InformantProfile | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Profile Page — Shows the current user's profile info: name, email,
 * helper points, reunions, and location settings.
 */
export default function ProfilePage() {
  const [state, setState] = useState<PageState>({
    profile: null,
    isLoading: true,
    error: null,
  });

  const fetchProfile = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Unable to retrieve session. Please sign in again.");
      }

      const { data: informant, error: fetchError } = await supabase
        .from("informants")
        .select("*")
        .eq("id", user.id)
        .single();

      if (fetchError || !informant) {
        throw new Error("Failed to load profile data.");
      }

      setState({
        profile: informant as InformantProfile,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Loading state
  if (state.isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="h-8 w-56 animate-pulse rounded-md bg-border mb-6" />
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="h-16 w-16 animate-pulse rounded-full bg-border mx-auto" />
          <div className="h-5 w-40 animate-pulse rounded-md bg-border mx-auto" />
          <div className="h-4 w-56 animate-pulse rounded-md bg-border mx-auto" />
          <div className="grid grid-cols-2 gap-4 mt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-border" />
            ))}
          </div>
        </div>
        <p className="text-center text-xs text-text-secondary mt-6">
          Loading your profile…
        </p>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-text-primary mb-4">My Profile</h1>
        <div
          className="flex flex-col items-center gap-3 rounded-xl border border-danger/40 bg-card p-6 shadow-[var(--shadow-soft)]"
          role="alert"
        >
          <p className="text-sm text-text-primary">{state.error}</p>
          <button
            onClick={fetchProfile}
            className="min-h-[40px] rounded-lg border border-primary bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!state.profile) return null;

  const { profile } = state;

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary">
          <User className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-[family-name:var(--font-space-grotesk)] font-bold text-text-primary">
            My Profile
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Your account and helper stats
          </p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)] overflow-hidden">
        {/* Identity Section */}
        <div className="p-6 border-b border-border">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            {/* Avatar placeholder */}
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 flex-shrink-0">
              <span className="text-2xl font-bold text-primary">
                {profile.display_name.charAt(0).toUpperCase()}
              </span>
            </div>

            <div className="text-center sm:text-left">
              <h2 className="text-lg font-semibold text-text-primary">
                {profile.display_name}
              </h2>
              <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1">
                <Mail className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
                <span className="text-sm text-text-secondary">
                  {profile.email}
                </span>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1">
                <Calendar className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
                <span className="text-xs text-text-secondary">
                  Joined{" "}
                  {new Date(profile.created_at).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-px bg-border">
          {/* Points */}
          <div className="bg-card p-4 flex flex-col items-center gap-1">
            <Star className="w-5 h-5 text-primary" aria-hidden="true" />
            <span className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-text-primary">
              {profile.total_points}
            </span>
            <span className="text-xs text-text-secondary">
              Helper Points
            </span>
          </div>

          {/* Matches */}
          <div className="bg-card p-4 flex flex-col items-center gap-1">
            <Target className="w-5 h-5 text-success" aria-hidden="true" />
            <span className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-text-primary">
              {profile.successful_matches}
            </span>
            <span className="text-xs text-text-secondary">
              Reunions
            </span>
          </div>

          {/* Location Consent */}
          <div className="bg-card p-4 flex flex-col items-center gap-1">
            <MapPin className="w-5 h-5 text-secondary" aria-hidden="true" />
            <span className="text-sm font-semibold text-text-primary text-center px-2 break-words">
              {profile.location_consent
                ? profile.residential_area || "Enabled"
                : "Disabled"}
            </span>
            <span className="text-xs text-text-secondary">
              {profile.location_consent ? "Area" : "Nearby Alerts"}
            </span>
          </div>

          {/* First match */}
          <div className="bg-card p-4 flex flex-col items-center gap-1">
            <Calendar className="w-5 h-5 text-secondary" aria-hidden="true" />
            <span className="text-sm font-semibold text-text-primary">
              {profile.first_match_at
                ? new Date(profile.first_match_at).toLocaleDateString(undefined, {
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </span>
            <span className="text-xs text-text-secondary">
              First Reunion
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
