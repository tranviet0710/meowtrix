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
        className="flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Match Intelligence
      </Link>

      {/* Header: Score + Status */}
      <header className="flex flex-col gap-3 rounded-[2px] border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`font-mono text-4xl font-bold ${
              match.overall_score >= 80
                ? "text-success"
                : match.overall_score >= 70
                  ? "text-accent"
                  : "text-secondary"
            }`}
          >
            {match.overall_score}%
          </div>
          <div>
            <h1 className="font-mono text-sm font-bold uppercase tracking-wider text-text-primary">
              CORRELATION REPORT
            </h1>
            <p className="text-xs text-text-secondary">
              Match ID: <span className="font-mono">{match.id.slice(0, 8)}</span>
            </p>
          </div>
        </div>
        <span
          className={`inline-flex w-fit rounded-[2px] px-3 py-1 font-mono text-xs uppercase ${
            match.status === "pending"
              ? "bg-accent/10 text-accent"
              : match.status === "claimed"
                ? "bg-success/10 text-success"
                : match.status === "resolved"
                  ? "bg-secondary/10 text-secondary"
                  : "bg-danger/10 text-danger"
          }`}
        >
          {match.status}
        </span>
      </header>

      {/* Main content grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Overlord card */}
        <section className="rounded-[2px] border border-danger/30 bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-danger" />
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-danger">
              LOST OVERLORD
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
              Overlord data unavailable
            </p>
          )}
        </section>

        {/* Agent card */}
        <section className="rounded-[2px] border border-success/30 bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-success" />
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-success">
              SPOTTED AGENT
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
                  Agent Sighting
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
              Agent data unavailable
            </p>
          )}
        </section>
      </div>

      {/* Score Breakdown */}
      <section className="rounded-[2px] border border-border bg-card p-5">
        <ScoreBreakdown
          visual={match.score_breakdown.visual}
          description={match.score_breakdown.description}
          proximity={match.score_breakdown.proximity}
          other={match.score_breakdown.other}
        />
      </section>

      {/* Matched traits */}
      {match.matched_traits.length > 0 && (
        <section className="rounded-[2px] border border-border bg-card p-4">
          <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-text-secondary">
            MATCHED IDENTIFIERS
          </h3>
          <div className="flex flex-wrap gap-2">
            {match.matched_traits.map((trait) => (
              <span
                key={trait}
                className="rounded-[2px] bg-accent/10 px-2.5 py-1 font-mono text-xs text-accent"
              >
                {trait}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Claim button — only for overlord owner when status is pending */}
      {canClaim && (
        <section className="rounded-[2px] border border-accent/30 bg-accent/5 p-5">
          <div className="flex flex-col items-start gap-4">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Initiate Claim
                </p>
                <p className="text-xs text-text-secondary">
                  Claim this match and get connected with the finder via email
                </p>
              </div>
            </div>
            <button
              onClick={handleInitiateClaim}
              disabled={state.isClaimLoading}
              className="w-full sm:w-auto min-h-[44px] rounded-[2px] bg-accent px-6 py-2.5 font-mono text-sm font-bold uppercase tracking-wider text-background transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Initiate ownership claim on this match"
            >
              {state.isClaimLoading ? "INITIATING..." : "CLAIM OVERLORD"}
            </button>
          </div>
        </section>
      )}

      {/* Claimed state — show actions for involved parties */}
      {match.status === "claimed" && (currentUserId === overlord?.owner_id || currentUserId === agent?.reporter_id) && (
        <section className="rounded-[2px] border border-success/30 bg-success/5 p-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 shrink-0 text-success" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  CLAIM IN PROGRESS — Verification Pending
                </p>
                <p className="text-xs text-text-secondary">
                  Both parties have been notified via email. Schedule a meetup to verify the pet.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {/* Only overlord owner can resolve */}
              {currentUserId === overlord?.owner_id && (
                <button
                  onClick={() => handleClaimAction("resolve")}
                  disabled={isActionLoading}
                  className="min-h-[44px] rounded-[2px] bg-success px-5 py-2.5 font-mono text-sm font-bold uppercase tracking-wider text-background transition-colors hover:bg-success/80 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Mark pet as reunited"
                >
                  {isActionLoading ? "PROCESSING..." : "✓ MARK RESOLVED"}
                </button>
              )}

              {/* Either party can revert */}
              <button
                onClick={() => handleClaimAction("revert")}
                disabled={isActionLoading}
                className="min-h-[44px] rounded-[2px] border border-danger/50 bg-danger/10 px-5 py-2.5 font-mono text-sm font-bold uppercase tracking-wider text-danger transition-colors hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Revert claim — not the right pet"
              >
                {isActionLoading ? "PROCESSING..." : "↩ REVERT CLAIM"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Resolved status */}
      {match.status === "resolved" && (
        <section className="rounded-[2px] border border-success/30 bg-success/5 p-4 text-center">
          <p className="font-mono text-xs text-success">
            ✓ MISSION COMPLETE — Overlord recovered and reunited
          </p>
        </section>
      )}

      {/* Claim popup — shown after successful claim initiation */}
      {showClaimPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[2px] border border-accent bg-card p-6 shadow-[0_0_30px_rgba(255,204,0,0.2)]">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <span className="text-3xl">📧</span>
              </div>
              <h2 className="font-mono text-lg font-bold uppercase tracking-wider text-accent">
                Claim Initiated!
              </h2>
              <p className="text-sm text-text-primary">
                Both you and the finder have been sent an email with each other&apos;s contact information.
              </p>
              <p className="text-xs text-text-secondary">
                Schedule a meetup to verify your pet. Once confirmed, come back here to mark the match as <strong className="text-success">resolved</strong>.
              </p>
              <div className="mt-2 rounded-[2px] border border-border bg-background p-3 text-xs text-text-secondary">
                <p>⏰ If no action is taken within 24 hours, both parties will receive a reminder.</p>
              </div>
              <button
                onClick={() => setShowClaimPopup(false)}
                className="mt-2 min-h-[44px] w-full rounded-[2px] bg-accent px-6 py-2.5 font-mono text-sm font-bold uppercase tracking-wider text-background transition-colors hover:bg-accent-hover"
              >
                GOT IT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {state.error && state.match && (
        <div
          className="rounded-[2px] border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger"
          role="alert"
        >
          {state.error}
        </div>
      )}
    </div>
  );
}
