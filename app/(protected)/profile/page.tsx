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
 * Profile Page — Displays the current Informant's profile information.
 *
 * Shows:
 * - Display name
 * - Email
 * - Total intel points
 * - Successful matches (reunions)
 * - Member since date
 * - Location consent status
 *
 * MEOWTRIX spy theme — styled as an "Informant Dossier."
 *
 * Requirements: 9.7 (profile shows user info)
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

      // Get the current user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Unable to retrieve session. Please sign in again.");
      }

      // Fetch informant profile from the database
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
        <div className="h-8 w-56 animate-pulse rounded-[2px] bg-border mb-6" />
        <div className="rounded-[2px] border border-border bg-card p-6 space-y-4">
          <div className="h-16 w-16 animate-pulse rounded-full bg-border mx-auto" />
          <div className="h-5 w-40 animate-pulse rounded-[2px] bg-border mx-auto" />
          <div className="h-4 w-56 animate-pulse rounded-[2px] bg-border mx-auto" />
          <div className="grid grid-cols-2 gap-4 mt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-[2px] bg-border" />
            ))}
          </div>
        </div>
        <p className="text-center text-xs font-mono text-text-secondary mt-6">
          LOADING DOSSIER...
        </p>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-text-primary uppercase tracking-wide mb-4">
          Informant Dossier
        </h1>
        <div
          className="flex flex-col items-center gap-3 rounded-[2px] border border-danger/50 bg-card p-6"
          role="alert"
        >
          <p className="text-sm text-text-primary">{state.error}</p>
          <button
            onClick={fetchProfile}
            className="min-h-[44px] rounded-[2px] border border-accent bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20"
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
        <div className="flex items-center justify-center w-10 h-10 rounded-[2px] bg-accent/10 border border-accent/30">
          <User className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-text-primary uppercase tracking-wide">
            Informant Dossier
          </h1>
          <p className="text-xs font-mono text-text-secondary mt-0.5">
            CLASSIFIED — AUTHORIZED PERSONNEL ONLY
          </p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="rounded-[2px] border border-border bg-card overflow-hidden">
        {/* Identity Section */}
        <div className="p-6 border-b border-border">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            {/* Avatar placeholder */}
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 border-2 border-accent/30 flex-shrink-0">
              <span className="text-2xl font-bold text-accent font-mono">
                {profile.display_name.charAt(0).toUpperCase()}
              </span>
            </div>

            <div className="text-center sm:text-left">
              <h2 className="text-lg font-bold text-text-primary">
                {profile.display_name}
              </h2>
              <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1">
                <Mail className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
                <span className="text-sm text-text-secondary font-mono">
                  {profile.email}
                </span>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1">
                <Calendar className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
                <span className="text-xs text-text-secondary">
                  Recruited{" "}
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
            <Star className="w-5 h-5 text-accent" aria-hidden="true" />
            <span className="font-mono text-2xl font-bold text-text-primary">
              {profile.total_points}
            </span>
            <span className="text-xs text-text-secondary uppercase tracking-wider">
              Intel Points
            </span>
          </div>

          {/* Matches */}
          <div className="bg-card p-4 flex flex-col items-center gap-1">
            <Target className="w-5 h-5 text-success" aria-hidden="true" />
            <span className="font-mono text-2xl font-bold text-text-primary">
              {profile.successful_matches}
            </span>
            <span className="text-xs text-text-secondary uppercase tracking-wider">
              Reunions
            </span>
          </div>

          {/* Location Consent */}
          <div className="bg-card p-4 flex flex-col items-center gap-1">
            <MapPin className="w-5 h-5 text-secondary" aria-hidden="true" />
            <span className="font-mono text-sm font-bold text-text-primary">
              {profile.location_consent ? "ACTIVE" : "INACTIVE"}
            </span>
            <span className="text-xs text-text-secondary uppercase tracking-wider">
              Proximity Alerts
            </span>
          </div>

          {/* First match */}
          <div className="bg-card p-4 flex flex-col items-center gap-1">
            <Calendar className="w-5 h-5 text-secondary" aria-hidden="true" />
            <span className="font-mono text-sm font-bold text-text-primary">
              {profile.first_match_at
                ? new Date(profile.first_match_at).toLocaleDateString(undefined, {
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </span>
            <span className="text-xs text-text-secondary uppercase tracking-wider">
              First Match
            </span>
          </div>
        </div>

        {/* Clearance Footer */}
        <div className="px-6 py-3 border-t border-border bg-background/50">
          <p className="text-[10px] font-mono text-text-secondary/60 text-center uppercase tracking-widest">
            CLEARANCE LEVEL: FIELD OPERATIVE — ID: {profile.id.slice(0, 8)}
          </p>
        </div>
      </div>
    </div>
  );
}
