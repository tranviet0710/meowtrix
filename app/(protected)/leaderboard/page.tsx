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

/**
 * Leaderboard Page — Displays the ranked list of Informants.
 *
 * Features:
 * - Fetches from GET /api/leaderboard with pagination (50 per page)
 * - Terminal-style data table with monospace font
 * - Highlights current user row
 * - Pagination controls
 * - Empty state when no points earned
 * - Social sharing button (Facebook, Twitter/X, LINE)
 * - MEOWTRIX spy theme
 *
 * Requirements: 10.2, 10.3, 10.4, 10.6, 10.7, 10.8, 10.9
 */
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
    if (pagination?.has_previous) {
      setPage((p) => p - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination?.has_next) {
      setPage((p) => p + 1);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-[2px] bg-accent/10 border border-accent/30">
            <Trophy className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-text-primary uppercase tracking-wide">
              Informant Leaderboard
            </h1>
            <p className="text-xs font-mono text-text-secondary mt-0.5">
              TOP FIELD OPERATIVES — RANKED BY INTEL POINTS
            </p>
          </div>
        </div>
        <ShareButton />
      </div>

      {/* Content area */}
      <div className="border border-border rounded-[2px] bg-card overflow-hidden">
        {/* Loading state */}
        {isLoading && (
          <div className="p-8">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 animate-pulse"
                >
                  <div className="w-8 h-8 rounded-[2px] bg-border" />
                  <div className="flex-1 h-5 rounded-[2px] bg-border" />
                  <div className="w-16 h-5 rounded-[2px] bg-border" />
                </div>
              ))}
            </div>
            <p className="text-center text-xs font-mono text-text-secondary mt-6">
              DECRYPTING INTEL...
            </p>
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-[2px] bg-danger/10 border border-danger/30 mb-4">
              <span className="text-danger text-lg">⚠</span>
            </div>
            <p className="text-sm text-text-secondary mb-4">{error}</p>
            <button
              type="button"
              onClick={() => fetchLeaderboard(page)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-accent text-background rounded-[2px] hover:bg-accent-hover transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && entries.length === 0 && (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[2px] bg-accent/5 border border-border mb-6">
              <Trophy className="w-8 h-8 text-text-secondary" />
            </div>
            <h2 className="text-lg font-bold text-text-primary mb-2">
              No Rankings Available
            </h2>
            <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
              No Informants have earned points yet. Report spotted cats and help
              reunite lost Overlords with their owners to climb the ranks!
            </p>
            <p className="text-[10px] font-mono text-text-secondary/60 mt-4 uppercase tracking-wider">
              Intel points awarded upon verified claim resolution
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
                <span className="text-xs font-mono text-text-secondary">
                  PAGE {pagination.page}/{pagination.total_pages} — {pagination.total_entries} INFORMANTS
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePreviousPage}
                    disabled={!pagination.has_previous}
                    className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] w-10 h-10 rounded-[2px] border border-border text-text-secondary hover:border-accent/50 hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextPage}
                    disabled={!pagination.has_next}
                    className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] w-10 h-10 rounded-[2px] border border-border text-text-secondary hover:border-accent/50 hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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

      {/* Open Graph meta hint (rendered via Next.js metadata in actual deployment) */}
      {/* The OG preview includes: leaderboard title, top 3 informants, MEOWTRIX branding */}
    </div>
  );
}
