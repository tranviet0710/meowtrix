"use client";

import { Mail, MapPin } from "lucide-react";
import type { LeaderboardEntry } from "@/types";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserId: string;
}

/**
 * Rank indicator badge — gold/silver/bronze for top 3, muted for others.
 */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm">
        🥇
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-text-primary font-bold text-sm">
        🥈
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brutal-orange/20 text-brutal-orange font-bold text-sm">
        🥉
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 text-sm font-semibold text-text-secondary">
      {rank}
    </span>
  );
}

/**
 * LeaderboardTable — Data-table style leaderboard with monospace font,
 * rank indicators, contact info, and current user row highlighting.
 *
 * Renders a terminal-style table matching the MEOWTRIX spy theme.
 * Supports keyboard navigation for accessibility compliance.
 *
 * Requirements: 10.2, 10.3, 10.4
 */
export function LeaderboardTable({ entries, currentUserId }: LeaderboardTableProps) {
  return (
    <div className="w-full overflow-x-auto" role="region" aria-label="Leaderboard rankings">
      <table
        className="w-full border-collapse text-sm"
        role="table"
        aria-label="Top helpers leaderboard"
      >
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="px-4 py-3 text-xs font-semibold text-text-secondary w-16">
              Rank
            </th>
            <th scope="col" className="px-4 py-3 text-xs font-semibold text-text-secondary">
              Helper
            </th>
            <th
              scope="col"
              className="hidden md:table-cell px-4 py-3 text-xs font-semibold text-text-secondary"
            >
              Area
            </th>
            <th scope="col" className="px-4 py-3 text-xs font-semibold text-text-secondary text-right w-28">
              Points
            </th>
            <th scope="col" className="hidden sm:table-cell px-4 py-3 text-xs font-semibold text-text-secondary text-right w-28">
              Reunions
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isCurrentUser = entry.informant_id === currentUserId;
            return (
              <tr
                key={entry.informant_id}
                tabIndex={0}
                className={`
                  border-b border-border/60 transition-colors
                  focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary
                  ${
                    isCurrentUser
                      ? "bg-primary/5 border-l-2 border-l-primary"
                      : "hover:bg-muted/40"
                  }
                `}
                aria-current={isCurrentUser ? "true" : undefined}
                aria-label={`Rank ${entry.rank}: ${entry.display_name}, ${entry.total_points} points, ${entry.successful_matches} reunions${isCurrentUser ? " (you)" : ""}`}
              >
                {/* Rank */}
                <td className="px-4 py-3 align-top">
                  <RankBadge rank={entry.rank} />
                </td>

                {/* Helper name + masked email */}
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={`font-semibold ${
                        isCurrentUser ? "text-primary" : "text-text-primary"
                      }`}
                    >
                      {entry.display_name}
                      {isCurrentUser && (
                        <span className="ml-2 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          you
                        </span>
                      )}
                    </span>
                    {entry.email_masked && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-text-secondary/80">
                        <Mail className="h-3 w-3" aria-hidden="true" />
                        {entry.email_masked}
                      </span>
                    )}
                  </div>
                </td>

                {/* Region (residential_area) */}
                <td className="hidden md:table-cell px-4 py-3 align-top">
                  {entry.residential_area ? (
                    <span className="inline-flex items-center gap-1 text-xs text-text-primary/90">
                      <MapPin className="h-3 w-3 text-primary/70" aria-hidden="true" />
                      {entry.residential_area}
                    </span>
                  ) : (
                    <span className="text-xs italic text-text-secondary/60">
                      Not shared
                    </span>
                  )}
                </td>

                {/* Points */}
                <td className="px-4 py-3 text-right align-top">
                  <span
                    className={`font-[family-name:var(--font-space-grotesk)] font-bold ${
                      isCurrentUser ? "text-primary" : "text-text-primary"
                    }`}
                  >
                    {entry.total_points.toLocaleString()}
                  </span>
                </td>

                {/* Successful matches */}
                <td className="hidden sm:table-cell px-4 py-3 text-right text-text-secondary align-top">
                  {entry.successful_matches}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
