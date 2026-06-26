"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ScoreBreakdown } from "@/components/matches/ScoreBreakdown";
import { AlertTriangle, ArrowLeft, Shield, MapPin, Clock } from "lucide-react";

interface MatchOverlord {
  id: string;
  owner_id: string;
  cat_name: string;
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
  const router = useRouter();
  const matchId = params.id as string;

  const [state, setState] = useState<PageState>({
    match: null,
    isLoading: true,
    error: null,
    isClaimLoading: false,
  });

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

      const data = await response.json();
      // Navigate to claim verification — the claim form will handle the rest
      router.push(`/matches/${matchId}?claim=${data.claim?.id || "initiated"}`);
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

  // Loading state
  if (state.isLoading) {
    return (
      <div className="flex h-full flex-col gap-4 p-4 md:p-6">
        <div className="h-8 w-48 animate-pulse rounded-[2px] bg-border" />
        <div className="h-64 animate-pulse rounded-[2px] border border-border bg-card" />
        <div className="h-40 animate-pulse rounded-[2px] border border-border bg-card" />
      </div>
    );
  }

  // Error state
  if (state.error && !state.match) {
    return (
      <div className="flex h-full flex-col gap-4 p-4 md:p-6">
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
  const canClaim = match.status === "pending";

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
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
                      alt={`${overlord.cat_name} photo ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>

              <div>
                <p className="text-sm font-medium text-text-primary">
                  {overlord.cat_name}
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

      {/* Claim button */}
      {canClaim && (
        <section className="rounded-[2px] border border-accent/30 bg-accent/5 p-5">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-accent" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Initiate Claim Verification
                </p>
                <p className="text-xs text-text-secondary">
                  Prove ownership through security verification protocol
                </p>
              </div>
            </div>
            <button
              onClick={handleInitiateClaim}
              disabled={state.isClaimLoading}
              className="min-h-[44px] min-w-[44px] rounded-[2px] bg-accent px-6 py-2.5 font-mono text-sm font-bold uppercase tracking-wider text-background transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Initiate ownership claim on this match"
            >
              {state.isClaimLoading ? "INITIATING..." : "CLAIM OVERLORD"}
            </button>
          </div>
        </section>
      )}

      {/* Non-claimable status message */}
      {!canClaim && match.status !== "pending" && (
        <section className="rounded-[2px] border border-border bg-card p-4 text-center">
          <p className="font-mono text-xs text-text-secondary">
            {match.status === "claimed"
              ? "CLAIM IN PROGRESS — Verification pending"
              : match.status === "resolved"
                ? "MISSION COMPLETE — Overlord recovered"
                : "CLAIM REJECTED — Verification failed"}
          </p>
        </section>
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
