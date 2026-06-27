"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StatCard } from "./StatCard";
import { AlertTriangle, Search, Users } from "lucide-react";

interface DashboardStats {
  total_overlords: number;
  active_searches: number;
  informants_online: number;
}

/** Refresh interval in milliseconds (30 seconds) */
const REFRESH_INTERVAL_MS = 30_000;

/** Fetch timeout in milliseconds (10 seconds) */
const FETCH_TIMEOUT_MS = 10_000;

interface StatGridState {
  stats: DashboardStats | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * StatGrid — Grid of dashboard stat cards with auto-refresh every 30s.
 *
 * Displays:
 * - Total Overlords tracked
 * - Active searches in progress
 * - Informants online (active session within last 5 minutes)
 *
 * Features:
 * - Loading skeletons on initial load
 * - Auto-refresh every 30 seconds
 * - Error state with retry button on 10s timeout
 */
export function StatGrid() {
  const [state, setState] = useState<StatGridState>({
    stats: null,
    isLoading: true,
    error: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch("/api/stats", {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }

      const data: DashboardStats = await response.json();
      setState({ stats: data, isLoading: false, error: null });
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof DOMException && err.name === "AbortError") {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Stats request timed out. Check your connection.",
        }));
      } else {
        const message = err instanceof Error ? err.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: `Failed to load stats: ${message}`,
        }));
      }
    }
  }, []);

  // Initial fetch + interval
  useEffect(() => {
    fetchStats();

    intervalRef.current = setInterval(fetchStats, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchStats]);

  // Error state with retry
  if (state.error && !state.stats) {
    return (
      <div
        className="flex flex-col items-center gap-3 border-[3px] border-danger bg-card p-6 shadow-[4px_4px_0px_0px] shadow-danger/50"
        role="alert"
        aria-label="Stats loading error"
      >
        <div className="flex h-10 w-10 items-center justify-center border-2 border-danger bg-danger/10">
          <AlertTriangle className="h-5 w-5 text-danger" aria-hidden="true" />
        </div>
        <p className="text-sm font-bold uppercase text-text-primary">{state.error}</p>
        <button
          onClick={fetchStats}
          className="min-h-[44px] min-w-[44px] border-[3px] border-accent bg-accent/10 px-4 py-2 text-sm font-bold uppercase text-accent shadow-[3px_3px_0px_0px] shadow-accent/40 transition-all hover:bg-accent/20 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label="Retry loading statistics"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 auto-rows-auto">
      <StatCard
        label="Overlords Tracked"
        value={state.stats?.total_overlords ?? null}
        icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
        isLoading={state.isLoading && !state.stats}
        accentClass="bg-[#FF6B97]/10 text-[#FF6B97]"
      />
      <StatCard
        label="Active Searches"
        value={state.stats?.active_searches ?? null}
        icon={<Search className="h-5 w-5" aria-hidden="true" />}
        isLoading={state.isLoading && !state.stats}
        accentClass="bg-[#FF9F1C]/10 text-[#FF9F1C]"
      />
      <StatCard
        label="Informants Online"
        value={state.stats?.informants_online ?? null}
        icon={<Users className="h-5 w-5" aria-hidden="true" />}
        isLoading={state.isLoading && !state.stats}
        accentClass="bg-[#51E5A5]/10 text-[#51E5A5]"
      />
    </div>
  );
}
