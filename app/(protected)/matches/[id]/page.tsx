"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ScoreBreakdown } from "@/components/matches/ScoreBreakdown";
import { AlertTriangle, ArrowLeft, Shield, MapPin, Clock } from "lucide-react";

interface MatchOverlord {
  id: string;
  owner_id: string;
  pet_name: string;
  pet_type: "cat" | "dog";
  description: string;
  last_seen_lat: number;
  last_seen_lng: number;
  last_seen_at: string;
  status: string;
  photos: string[];
  trait_tags: Record<string, unknown> | null;
  created_at: string;
}

interface MatchAgent {
  id: string;
  reporter_id: string;
  description: string;
  sighting_lat: number;
  sighting_lng: number;
  sighted_at: string;
  status: string;
  photos: string[];
  trait_tags: Record<string, unknown> | null;
  created_at: string;
}

interface MatchDetail {
  id: string;
  overlord_id: string;
  agent_id: string;
  overall_score: number;
  score_breakdown: {
    visual: number;
    description: number;
    proximity: number;
    other: number;
  };
  matched_traits: string[];
  status: string;
  created_at: string;
  overlord: MatchOverlord | null;
  agent: MatchAgent | null;
}

interface PageState {
  match: MatchDetail | null;
  isLoading: boolean;
  error: string | null;
  isClaimLoading: boolean;
}

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Match Detail Page — Shows full match information with claim verification button.
 *
 * Displays:
 * - Overall score with visual breakdown
 * - Overlord and Agent side-by-side comparison
 * - Matched trait tags
 * - Claim button (only for Overlord owner with pending status)
 *
 * Requirements: 8.3, 8.5, 8.7
 */
export default function MatchDetailPage() {
  const params = useParams();
  const matchId = params.id as string;

  const [state, setState] = useState<PageState>({
    match: null,
    isLoading: true,
    error: null,
    isClaimLoading: false,
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch current user for claim ownership check
  useEffect(() => {
    async function getUser() {
      const { createClient } = await import("@/lib/supabaseClient");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    }
    getUser();
  }, []);

  const fetchMatch = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/matches/${matchId}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setState({
        match: data.match,
        isLoading: false,
        error: null,
        isClaimLoading: false,
      });
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof DOMException && err.name === "AbortError") {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Request timed out. Check your connection.",
        }));
      } else {
        const message = err instanceof Error ? err.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
      }
    }
  }, [matchId]);

  useEffect(() => {
    if (matchId) {
      fetchMatch();
    }
  }, [matchId, fetchMatch]);

  const [showClaimPopup, setShowClaimPopup] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const handleInitiateClaim = async () => {
    setState((prev) => ({ ...prev, isClaimLoading: true }));

    try {
      const response = await fetch(`/api/matches/${matchId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to initiate claim");
      }

      // Show success popup
      setShowClaimPopup(true);
      // Refresh to show updated status
      fetchMatch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setState((prev) => ({
        ...prev,
        isClaimLoading: false,
        error: message,
      }));
    }
  };

  const handleClaimAction = async (action: "revert" | "resolve") => {
    setIsActionLoading(true);

    try {
      const response = await fetch(`/api/matches/${matchId}/claim`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Failed to ${action} claim`);
      }

      // Refresh to show updated status
      fetchMatch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setState((prev) => ({
        ...prev,
        error: message,
      }));
    } finally {
      setIsActionLoading(false);
    }
  };

  // Loading state
  if (state.isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6 max-w-full">
        <div className="h-8 w-48 animate-pulse rounded-[2px] bg-border" />
        <div className="h-64 animate-pulse rounded-[2px] border border-border bg-card" />
        <div className="h-40 animate-pulse rounded-[2px] border border-border bg-card" />
      </div>
    );
  }

  // Error state
  if (state.error && !state.match) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6 max-w-full">
        <Link
          href="/matches"
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Matches
        </Link>
        <div
          className="flex flex-col items-center gap-3 rounded-[2px] border border-danger/50 bg-card p-6"
          role="alert"
        >
          <AlertTriangle className="h-6 w-6 text-danger" aria-hidden="true" />
          <p className="text-sm text-text-primary">{state.error}</p>
          <button
            onClick={fetchMatch}
            className="min-h-[44px] rounded-[2px] border border-accent bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!state.match) return null;

  const { match } = state;
  const overlord = match.overlord;
  const agent = match.agent;

  // Determine if user can claim (must be overlord owner + status pending)
  const canClaim = match.status === "pending" && overlord?.owner_id === currentUserId;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 max-w-full">
      {/* Back link */}
      <Link
        href="/matches"
        className="flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Matches
      </Link>

      {/* Header: Score + Status */}
      <header className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`font-[family-name:var(--font-space-grotesk)] text-4xl font-bold ${
              match.overall_score >= 80
                ? "text-success"
                : match.overall_score >= 70
                  ? "text-primary"
                  : "text-text-secondary"
            }`}
          >
            {match.overall_score}%
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">
              Match Details
            </h1>
            <p className="text-xs text-text-secondary">
              Match ID: <span className="font-mono">{match.id.slice(0, 8)}</span>
            </p>
          </div>
        </div>
        <span
          className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${
            match.status === "pending"
              ? "bg-primary/10 text-primary"
              : match.status === "claimed"
                ? "bg-accent/10 text-accent"
                : match.status === "resolved"
                  ? "bg-success/10 text-success"
                  : "bg-danger/10 text-danger"
          }`}
        >
          {match.status === "pending"
            ? "New"
            : match.status === "claimed"
              ? "Claim in progress"
              : match.status === "resolved"
                ? "Reunited"
                : "Not a match"}
        </span>
      </header>

      {/* Main content grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Missing pet card */}
        <section className="rounded-xl border border-danger/30 bg-card p-4 shadow-[var(--shadow-soft)]">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-danger" />
            <h2 className="text-sm font-semibold text-danger">
              Missing pet
            </h2>
          </div>

          {overlord ? (
            <div className="flex flex-col gap-3">
              {/* Photo grid */}
              <div className="flex gap-2 overflow-x-auto">
                {overlord.photos.slice(0, 3).map((photo, idx) => (
                  <div
                    key={idx}
                    className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-[2px] border border-border bg-background"
                  >
                    <img
                      src={photo}
                      alt={`${overlord.pet_name} photo ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>

              <div>
                <p className="text-sm font-medium text-text-primary">
                  {overlord.pet_name}
                </p>
                {overlord.description && (
                  <p className="mt-1 text-xs text-text-secondary line-clamp-3">
                    {overlord.description}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1 text-xs text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  Last seen:{" "}
                  {new Date(overlord.last_seen_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {overlord.last_seen_lat.toFixed(4)},{" "}
                  {overlord.last_seen_lng.toFixed(4)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-text-secondary">
              Missing pet data unavailable
            </p>
          )}
        </section>

        {/* Sighting card */}
        <section className="rounded-xl border border-success/30 bg-card p-4 shadow-[var(--shadow-soft)]">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-success" />
            <h2 className="text-sm font-semibold text-success">
              Sighting
            </h2>
          </div>

          {agent ? (
            <div className="flex flex-col gap-3">
              {/* Photo grid */}
              <div className="flex gap-2 overflow-x-auto">
                {agent.photos.slice(0, 3).map((photo, idx) => (
                  <div
                    key={idx}
                    className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-[2px] border border-border bg-background"
                  >
                    <img
                      src={photo}
                      alt={`Agent sighting photo ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>

              <div>
                <p className="text-sm font-medium text-text-primary">
                  Sighting
                </p>
                {agent.description && (
                  <p className="mt-1 text-xs text-text-secondary line-clamp-3">
                    {agent.description}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1 text-xs text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  Sighted:{" "}
                  {new Date(agent.sighted_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {agent.sighting_lat.toFixed(4)},{" "}
                  {agent.sighting_lng.toFixed(4)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-text-secondary">
              Sighting data unavailable
            </p>
          )}
        </section>
      </div>

      {/* Score Breakdown */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <ScoreBreakdown
          visual={match.score_breakdown.visual}
          description={match.score_breakdown.description}
          proximity={match.score_breakdown.proximity}
          other={match.score_breakdown.other}
        />
      </section>

      {/* Matched traits */}
      {match.matched_traits.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
          <h3 className="mb-2 text-sm font-semibold text-text-primary">
            Matching Features
          </h3>
          <div className="flex flex-wrap gap-2">
            {match.matched_traits.map((trait) => (
              <span
                key={trait}
                className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
              >
                {trait}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Claim button — only for missing-pet owner when status is pending */}
      {canClaim && (
        <section className="rounded-xl border border-primary/30 bg-primary/5 p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col items-start gap-4">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="text-base font-semibold text-text-primary">
                  This might be your pet
                </p>
                <p className="text-sm text-text-secondary">
                  Claim this match and we&apos;ll connect you with the finder by email
                </p>
              </div>
            </div>
            <button
              onClick={handleInitiateClaim}
              disabled={state.isClaimLoading}
              className="w-full sm:w-auto min-h-[44px] rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-primary)] transition-all hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:translate-y-0"
              aria-label="Claim this match"
            >
              {state.isClaimLoading ? "Starting…" : "Claim This Pet"}
            </button>
          </div>
        </section>
      )}

      {/* Claimed state — show actions for involved parties */}
      {match.status === "claimed" && (currentUserId === overlord?.owner_id || currentUserId === agent?.reporter_id) && (
        <section className="rounded-xl border border-success/30 bg-success/5 p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 shrink-0 text-success" aria-hidden="true" />
              <div>
                <p className="text-base font-semibold text-text-primary">
                  Claim in progress
                </p>
                <p className="text-sm text-text-secondary">
                  Both of you have been notified by email. Meet up to verify the pet, then come back here.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {/* Only missing-pet owner can resolve */}
              {currentUserId === overlord?.owner_id && (
                <button
                  onClick={() => handleClaimAction("resolve")}
                  disabled={isActionLoading}
                  className="min-h-[44px] rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-md)] transition-all hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:translate-y-0"
                  aria-label="Mark pet as reunited"
                >
                  {isActionLoading ? "Saving…" : "✓ Mark as Reunited"}
                </button>
              )}

              {/* Either party can revert */}
              <button
                onClick={() => handleClaimAction("revert")}
                disabled={isActionLoading}
                className="min-h-[44px] rounded-lg border border-danger/50 bg-danger/10 px-5 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Not the right pet"
              >
                {isActionLoading ? "Saving…" : "↩ Not a match"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Resolved status */}
      {match.status === "resolved" && (
        <section className="rounded-xl border border-success/40 bg-success/10 p-4 text-center shadow-[var(--shadow-soft)]">
          <p className="text-sm font-semibold text-success">
            🎉 Reunited — this pet is home
          </p>
        </section>
      )}

      {/* Claim popup — shown after successful claim initiation */}
      {showClaimPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-primary/40 bg-card p-6 shadow-[var(--shadow-lg)]">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <span className="text-3xl">📧</span>
              </div>
              <h2 className="font-[family-name:var(--font-space-grotesk)] text-lg font-bold text-text-primary">
                Claim started!
              </h2>
              <p className="text-sm text-text-primary">
                We&apos;ve sent you and the finder each other&apos;s contact info by email.
              </p>
              <p className="text-xs text-text-secondary">
                Meet up to verify your pet. Once confirmed, come back here and mark it as <strong className="text-success">reunited</strong>.
              </p>
              <div className="mt-2 rounded-lg border border-border bg-muted p-3 text-xs text-text-secondary">
                <p>⏰ We&apos;ll send both of you a reminder if there&apos;s no update in 24 hours.</p>
              </div>
              <button
                onClick={() => setShowClaimPopup(false)}
                className="mt-2 min-h-[44px] w-full rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-primary)] transition-all hover:-translate-y-0.5 hover:brightness-105"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {state.error && state.match && (
        <div
          className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
          role="alert"
        >
          {state.error}
        </div>
      )}
    </div>
  );
}
