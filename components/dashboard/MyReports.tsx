"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";

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
 * MyReports — Lists the current user's filed missing-pet reports.
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
      <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <h2 className="mb-3 font-semibold text-sm text-text-primary">
          My Reports
        </h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-border" />
          ))}
        </div>
      </section>
    );
  }

  // Error state
  if (state.error) {
    return (
      <section className="rounded-xl border border-danger/40 bg-card p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-danger" aria-hidden="true" />
          <p className="text-sm text-text-primary">{state.error}</p>
        </div>
        <button
          onClick={fetchReports}
          className="mt-2 min-h-[40px] rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
        >
          Retry
        </button>
      </section>
    );
  }

  // Empty state
  if (state.reports.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 text-center shadow-[var(--shadow-soft)]">
        <h2 className="mb-2 font-semibold text-sm text-text-primary">
          No Reports Yet
        </h2>
        <p className="text-xs text-text-secondary mb-4">
          You haven&apos;t reported any missing pets yet.
        </p>
        <Link
          href="/report-lost"
          className="inline-flex min-h-[40px] items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-primary)] transition-all hover:-translate-y-0.5"
        >
          Report a Missing Pet
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm text-text-primary">My Reports</h2>
        <Link
          href="/report-lost"
          className="text-xs font-semibold text-primary hover:underline"
        >
          + New Report
        </Link>
      </div>

      <div className="space-y-2">
        {state.reports.map((report) => (
          <Link
            key={report.id}
            href={`/overlords/${report.id}`}
            className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition-all hover:border-primary/50 hover:bg-primary/5"
          >
            {/* Thumbnail */}
            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
              {report.photos[0] ? (
                <img
                  src={report.photos[0]}
                  alt={report.pet_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-text-secondary text-lg">
                  🐾
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">
                {report.pet_name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <Clock className="h-3 w-3 text-text-secondary" aria-hidden="true" />
                <span className="text-xs text-text-secondary">
                  {new Date(report.created_at).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}
                </span>
              </div>
            </div>

            {/* Status badge */}
            <span
              className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                report.status === "active"
                  ? "bg-danger/10 text-danger"
                  : "bg-success/10 text-success"
              }`}
            >
              {report.status === "active" ? "Missing" : "Home"}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
