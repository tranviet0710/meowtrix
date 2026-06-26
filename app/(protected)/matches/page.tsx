"use client";

import { useCallback, useEffect, useState } from "react";
import { MatchCard, type MatchCardData } from "@/components/matches/MatchCard";
import { AlertTriangle, Shuffle } from "lucide-react";

interface MatchesState {
  matches: MatchCardData[];
  isLoading: boolean;
  error: string | null;
}

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Matches List Page — Displays all match suggestions for the authenticated user.
 *
 * Fetches from GET /api/matches and displays MatchCard components
 * sorted by overall_score descending.
 *
 * Requirements: 8.3, 8.5, 8.7
 */
export default function MatchesPage() {
  const [state, setState] = useState<MatchesState>({
    matches: [],
    isLoading: true,
    error: null,
  });

  const fetchMatches = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch("/api/matches", {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setState({
        matches: data.matches || [],
        isLoading: false,
        error: null,
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
          error: `Failed to load matches: ${message}`,
        }));
      }
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg font-bold uppercase tracking-wider text-accent">
            Match Intelligence
          </h1>
          <p className="mt-0.5 text-xs text-text-secondary">
            AI-powered suspect correlations — ranked by confidence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Shuffle className="h-5 w-5 text-accent" aria-hidden="true" />
          <span className="font-mono text-sm text-text-secondary">
            {!state.isLoading && `${state.matches.length} results`}
          </span>
        </div>
      </header>

      {/* Loading state */}
      {state.isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-[2px] border border-border bg-card"
              role="status"
              aria-label="Loading match suggestions"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {state.error && !state.isLoading && (
        <div
          className="flex flex-col items-center gap-3 rounded-[2px] border border-danger/50 bg-card p-6"
          role="alert"
          aria-label="Matches loading error"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/10">
            <AlertTriangle
              className="h-5 w-5 text-danger"
              aria-hidden="true"
            />
          </div>
          <p className="text-sm text-text-primary">{state.error}</p>
          <button
            onClick={fetchMatches}
            className="min-h-[44px] min-w-[44px] rounded-[2px] border border-accent bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
            aria-label="Retry loading matches"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!state.isLoading && !state.error && state.matches.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-[2px] border border-border bg-card p-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
            <Shuffle className="h-8 w-8 text-accent" aria-hidden="true" />
          </div>
          <div className="text-center">
            <p className="font-mono text-sm font-medium text-text-primary">
              NO CORRELATIONS DETECTED
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              The Match Engine is scanning for potential overlord-agent
              connections. New matches will appear here when detected.
            </p>
          </div>
        </div>
      )}

      {/* Match cards list */}
      {!state.isLoading && !state.error && state.matches.length > 0 && (
        <div className="flex flex-col gap-3">
          {state.matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}
