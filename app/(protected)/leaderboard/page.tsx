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
          <div className="flex items-center justify-center w-10 h-10 border-[3px] border-sidebar-active bg-sidebar-active/10 shadow-[3px_3px_0px_var(--color-sidebar-active)]">
            <Trophy className="w-5 h-5 text-sidebar-active" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-[family-name:var(--font-space-grotesk)] font-bold text-text-primary uppercase tracking-wide">
              Informant Leaderboard
            </h1>
            <p className="text-xs font-mono font-bold text-text-secondary mt-0.5 uppercase">
              Top Field Operatives — Ranked by Intel Points
            </p>
          </div>
        </div>
        <ShareButton />
      </div>

      {/* Content area */}
      <div className="border-[3px] border-sidebar-active bg-card shadow-[4px_4px_0px_var(--color-sidebar-active)] overflow-hidden">
        {/* Loading state */}
        {isLoading && (
          <div className="p-8">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-8 h-8 bg-border border-2 border-accent/30" />
                  <div className="flex-1 h-5 bg-border" />
                  <div className="w-16 h-5 bg-border" />
                </div>
              ))}
            </div>
            <p className="text-center text-xs font-mono font-bold text-text-secondary mt-6 uppercase">
              Decrypting Intel...
            </p>
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 border-[3px] border-danger bg-danger/10 shadow-[3px_3px_0px] shadow-danger/40 mb-4">
              <span className="text-danger text-lg">⚠</span>
            </div>
            <p className="text-sm font-bold text-text-secondary mb-4">{error}</p>
            <button
              type="button"
              onClick={() => fetchLeaderboard(page)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase bg-accent text-background border-[3px] border-accent shadow-[3px_3px_0px_#000] transition-all hover:brightness-110 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && entries.length === 0 && (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 border-[3px] border-sidebar-active/30 bg-sidebar-active/5 shadow-[3px_3px_0px] shadow-accent/20 mb-6">
              <Trophy className="w-8 h-8 text-text-secondary" />
            </div>
            <h2 className="text-lg font-[family-name:var(--font-space-grotesk)] font-bold text-text-primary mb-2 uppercase">
              No Rankings Available
            </h2>
            <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
              No Informants have earned points yet. Report spotted cats and help
              reunite lost Overlords with their owners to climb the ranks!
            </p>
            <p className="text-[10px] font-mono font-bold text-text-secondary/60 mt-4 uppercase tracking-wider">
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
              <div className="flex items-center justify-between px-4 py-3 border-t-[3px] border-sidebar-active">
                <span className="text-xs font-mono font-bold text-text-secondary uppercase">
                  Page {pagination.page}/{pagination.total_pages} — {pagination.total_entries} Informants
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePreviousPage}
                    disabled={!pagination.has_previous}
                    className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] w-10 h-10 border-[2px] border-sidebar-active text-text-secondary shadow-[2px_2px_0px_var(--color-sidebar-active)] transition-all hover:text-sidebar-active active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextPage}
                    disabled={!pagination.has_next}
                    className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] w-10 h-10 border-[2px] border-sidebar-active text-text-secondary shadow-[2px_2px_0px_var(--color-sidebar-active)] transition-all hover:text-sidebar-active active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-30 disabled:cursor-not-allowed"
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
