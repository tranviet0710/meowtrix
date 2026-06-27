"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, MapPin } from "lucide-react";

interface OverlordSummary {
  id: string;
  pet_name: string;
  pet_type: "cat" | "dog";
  status: "active" | "resolved";
  photos: string[];
  last_seen_at: string;
  created_at: string;
}

interface MyReportsState {
  reports: OverlordSummary[];
  isLoading: boolean;
  error: string | null;
}

const FETCH_TIMEOUT_MS = 10_000;

/**
 * MyReports — Lists the current user's filed Overlord reports.
 * Shows recent lost-pet reports with status, photo thumbnail, and links to detail.
 */
export function MyReports() {
  const [state, setState] = useState<MyReportsState>({
    reports: [],
    isLoading: true,
    error: null,
  });

  const fetchReports = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch("/api/overlords?mine=true", {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setState({ reports: data.overlords ?? [], isLoading: false, error: null });
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof DOMException && err.name === "AbortError") {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Request timed out.",
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
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Loading state
  if (state.isLoading) {
    return (
      <section className="rounded-[2px] border-[3px] border-sidebar-active bg-card p-4 shadow-[4px_4px_0px_var(--color-sidebar-active)]">
        <h2 className="mb-3 font-[family-name:var(--font-space-grotesk)] text-sm font-bold uppercase tracking-wider text-sidebar-active">
          My Filed Reports
        </h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-[2px] bg-border" />
          ))}
        </div>
      </section>
    );
  }

  // Error state
  if (state.error) {
    return (
      <section className="rounded-[2px] border-[3px] border-danger bg-card p-4 shadow-[4px_4px_0px_0px] shadow-danger/50">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-danger" aria-hidden="true" />
          <p className="text-sm text-text-primary">{state.error}</p>
        </div>
        <button
          onClick={fetchReports}
          className="mt-2 min-h-[44px] rounded-[2px] border-[3px] border-accent bg-accent/10 px-3 py-1.5 text-xs font-bold uppercase text-accent shadow-[3px_3px_0px_0px] shadow-accent/40 transition-all hover:bg-accent/20 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Retry
        </button>
      </section>
    );
  }

  // Empty state
  if (state.reports.length === 0) {
    return (
      <section className="rounded-[2px] border-[3px] border-border bg-card p-6 text-center">
        <h2 className="mb-2 font-[family-name:var(--font-space-grotesk)] text-sm font-bold uppercase tracking-wider text-text-secondary">
          No Reports Filed
        </h2>
        <p className="text-xs text-text-secondary mb-3">
          You haven&apos;t filed any Overlord reports yet.
        </p>
        <Link
          href="/report-lost"
          className="inline-flex min-h-[44px] items-center rounded-[2px] border-[3px] border-danger bg-danger/10 px-4 py-2 text-sm font-bold uppercase text-danger shadow-[3px_3px_0px_0px] shadow-danger/40 transition-all hover:bg-danger/20 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
        >
          Report Lost Overlord
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-[2px] border-[3px] border-sidebar-active bg-card p-4 shadow-[4px_4px_0px_var(--color-sidebar-active)]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-[family-name:var(--font-space-grotesk)] text-sm font-bold uppercase tracking-wider text-sidebar-active">
          My Filed Reports
        </h2>
        <Link
          href="/report-lost"
          className="text-xs font-bold uppercase text-accent hover:underline"
        >
          + New Report
        </Link>
      </div>

      <div className="space-y-2">
        {state.reports.map((report) => (
          <Link
            key={report.id}
            href={`/overlords/${report.id}`}
            className="flex items-center gap-3 rounded-[2px] border border-border bg-background p-3 transition-colors hover:border-accent/50 hover:bg-accent/5"
          >
            {/* Thumbnail */}
            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-[2px] border border-border bg-card">
              {report.photos[0] ? (
                <img
                  src={report.photos[0]}
                  alt={report.pet_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-text-secondary text-xs">
                  ?
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text-primary truncate">
                {report.pet_name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <Clock className="h-3 w-3 text-text-secondary" aria-hidden="true" />
                <span className="text-xs text-text-secondary font-mono">
                  {new Date(report.created_at).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}
                </span>
              </div>
            </div>

            {/* Status badge */}
            <span
              className={`flex-shrink-0 rounded-[2px] px-2 py-0.5 font-mono text-[10px] uppercase ${
                report.status === "active"
                  ? "bg-danger/10 text-danger"
                  : "bg-success/10 text-success"
              }`}
            >
              {report.status === "active" ? "MISSING" : "FOUND"}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
