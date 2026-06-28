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
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-[2px] bg-accent/20 text-accent font-mono font-bold text-sm border border-accent/40 shadow-[0_0_6px_rgba(255,204,0,0.3)]">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-[2px] bg-white/10 text-text-primary font-mono font-bold text-sm border border-white/20">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-[2px] bg-amber-700/20 text-amber-400 font-mono font-bold text-sm border border-amber-700/30">
        3
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 font-mono text-sm text-text-secondary">
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
        className="w-full border-collapse font-mono text-sm"
        role="table"
        aria-label="Informant leaderboard"
      >
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-secondary w-16">
              Rank
            </th>
            <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Informant
            </th>
            <th
              scope="col"
              className="hidden md:table-cell px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-secondary"
            >
              Region
            </th>
            <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-secondary text-right w-28">
              Points
            </th>
            <th scope="col" className="hidden sm:table-cell px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-secondary text-right w-28">
              Matches
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
                  border-b border-border/50 transition-colors
                  focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent
                  ${
                    isCurrentUser
                      ? "bg-accent/5 border-l-2 border-l-accent shadow-[inset_0_0_12px_rgba(255,204,0,0.05)]"
                      : "hover:bg-white/[0.02]"
                  }
                `}
                aria-current={isCurrentUser ? "true" : undefined}
                aria-label={`Rank ${entry.rank}: ${entry.display_name}, ${entry.total_points} points, ${entry.successful_matches} matches${isCurrentUser ? " (you)" : ""}`}
              >
                {/* Rank */}
                <td className="px-4 py-3 align-top">
                  <RankBadge rank={entry.rank} />
                </td>

                {/* Informant name + masked email */}
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={`font-medium ${
                        isCurrentUser ? "text-accent" : "text-text-primary"
                      }`}
                    >
                      {entry.display_name}
                      {isCurrentUser && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-accent/70 bg-accent/10 px-1.5 py-0.5 rounded-[2px]">
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
                      <MapPin className="h-3 w-3 text-accent/70" aria-hidden="true" />
                      {entry.residential_area}
                    </span>
                  ) : (
                    <span className="text-xs italic text-text-secondary/60">
                      Undisclosed
                    </span>
                  )}
                </td>

                {/* Points */}
                <td className="px-4 py-3 text-right align-top">
                  <span
                    className={`font-bold ${
                      isCurrentUser ? "text-accent" : "text-text-primary"
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
