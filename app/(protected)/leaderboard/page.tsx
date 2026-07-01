"use client";

import { useEffect, useState, useCallback } from "react";
import { Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { ShareButton } from "@/components/leaderboard/ShareButton";
import type { LeaderboardEntry } from "@/types";

interface PaginationInfo {
  page: number;
  page_size: number;
  total_entries: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  pagination: PaginationInfo;
  current_user_id: string;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchLeaderboard = useCallback(async (pageNum: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/leaderboard?page=${pageNum}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch leaderboard");
      }

      const data: LeaderboardResponse = await response.json();
      setEntries(data.leaderboard);
      setPagination(data.pagination);
      setCurrentUserId(data.current_user_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard(page);
  }, [page, fetchLeaderboard]);

  const handlePreviousPage = () => {
    if (pagination?.has_previous) setPage((p) => p - 1);
  };

  const handleNextPage = () => {
    if (pagination?.has_next) setPage((p) => p + 1);
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-[family-name:var(--font-space-grotesk)] font-bold text-text-primary">
              Top Helpers
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              Ranked by verified reunions
            </p>
          </div>
        </div>
        <ShareButton />
      </div>

      {/* Content area */}
      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)] overflow-hidden">
        {/* Loading state */}
        {isLoading && (
          <div className="p-8">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-8 h-8 bg-border rounded-lg" />
                  <div className="flex-1 h-5 bg-border rounded-md" />
                  <div className="w-16 h-5 bg-border rounded-md" />
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-text-secondary mt-6">
              Loading rankings…
            </p>
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-danger/10 mb-4">
              <span className="text-danger text-lg">⚠</span>
            </div>
            <p className="text-sm text-text-primary mb-4">{error}</p>
            <button
              type="button"
              onClick={() => fetchLeaderboard(page)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg shadow-[var(--shadow-primary)] transition-all hover:-translate-y-0.5 hover:brightness-105"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && entries.length === 0 && (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
              <Trophy className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-[family-name:var(--font-space-grotesk)] font-semibold text-text-primary mb-2">
              No rankings yet
            </h2>
            <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
              Post a sighting or help reunite a lost pet with its owner to
              start climbing the leaderboard.
            </p>
            <p className="text-xs text-text-secondary/70 mt-4">
              Points are awarded once a match is verified.
            </p>
          </div>
        )}

        {/* Leaderboard table */}
        {!isLoading && !error && entries.length > 0 && (
          <>
            <LeaderboardTable entries={entries} currentUserId={currentUserId} />

            {/* Pagination */}
            {pagination && pagination.total_pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-text-secondary">
                  Page {pagination.page} of {pagination.total_pages} —{" "}
                  {pagination.total_entries} helpers
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePreviousPage}
                    disabled={!pagination.has_previous}
                    className="inline-flex items-center justify-center min-w-[40px] min-h-[40px] w-10 h-10 rounded-lg border border-border text-text-secondary transition-all hover:text-primary hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextPage}
                    disabled={!pagination.has_next}
                    className="inline-flex items-center justify-center min-w-[40px] min-h-[40px] w-10 h-10 rounded-lg border border-border text-text-secondary transition-all hover:text-primary hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
