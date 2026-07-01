"use client";

import Link from "next/link";
import { ScoreBreakdown } from "./ScoreBreakdown";

interface MatchOverlord {
  id: string;
  pet_name: string;
  photos: string[];
  last_seen_at: string;
  status: string;
}

interface MatchAgent {
  id: string;
  photos: string[];
  description: string;
  sighted_at: string;
  status: string;
}

export interface MatchCardData {
  id: string;
  overall_score: number;
  visual_score: number;
  description_score: number;
  proximity_score: number;
  other_score: number;
  matched_traits: string[];
  status: string;
  created_at: string;
  overlords: MatchOverlord | null;
  agents: MatchAgent | null;
}

interface MatchCardProps {
  match: MatchCardData;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 70) return "text-primary";
  return "text-text-secondary";
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "New";
    case "claimed":
      return "Claim in progress";
    case "resolved":
      return "Reunited";
    case "rejected":
      return "Not a match";
    default:
      return status;
  }
}

/**
 * MatchCard — Warm, rounded card showing a possible match between a missing
 * pet and a sighting. Score displayed prominently, photos side-by-side.
 */
export function MatchCard({ match }: MatchCardProps) {
  const overlord = match.overlords;
  const agent = match.agents;
  const scoreColor = getScoreColor(match.overall_score);

  return (
    <Link
      href={`/matches/${match.id}`}
      className="group block rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-md)]"
      aria-label={`Match: ${overlord?.pet_name ?? "Unknown"} — ${match.overall_score}% match`}
    >
      {/* Header: Score + Status */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`font-[family-name:var(--font-space-grotesk)] text-3xl font-bold ${scoreColor}`}
            aria-label={`Overall match score: ${match.overall_score}%`}
          >
            {match.overall_score}%
          </div>
          <span className="text-xs font-medium text-text-secondary">
            match score
          </span>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
            match.status === "pending"
              ? "bg-primary/10 text-primary"
              : match.status === "claimed"
                ? "bg-accent/10 text-accent"
                : match.status === "resolved"
                  ? "bg-success/10 text-success"
                  : "bg-danger/10 text-danger"
          }`}
        >
          {getStatusLabel(match.status)}
        </span>
      </div>

      {/* Photos comparison */}
      <div className="mb-3 flex items-center gap-3">
        {/* Missing pet photo */}
        <div className="flex flex-col items-center gap-1">
          <div className="h-16 w-16 overflow-hidden rounded-xl border-2 border-danger/40 bg-muted">
            {overlord?.photos?.[0] ? (
              <img
                src={overlord.photos[0]}
                alt={`Missing pet: ${overlord.pet_name}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-text-secondary">
                ?
              </div>
            )}
          </div>
          <span className="text-[10px] font-semibold text-danger">Missing</span>
        </div>

        {/* Connection indicator */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="h-px w-6 bg-primary/50" />
          <span className="text-primary">↔</span>
          <div className="h-px w-6 bg-primary/50" />
        </div>

        {/* Sighting photo */}
        <div className="flex flex-col items-center gap-1">
          <div className="h-16 w-16 overflow-hidden rounded-xl border-2 border-success/40 bg-muted">
            {agent?.photos?.[0] ? (
              <img
                src={agent.photos[0]}
                alt={`Sighting: ${agent.description || "spotted pet"}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-text-secondary">
                ?
              </div>
            )}
          </div>
          <span className="text-[10px] font-semibold text-success">Sighting</span>
        </div>

        {/* Pet name and timing */}
        <div className="ml-3 flex flex-1 flex-col gap-1 overflow-hidden">
          <p className="truncate text-sm font-semibold text-text-primary">
            {overlord?.pet_name ?? "Unknown pet"}
          </p>
          <p className="text-xs text-text-secondary">
            Found{" "}
            {new Date(match.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          {match.matched_traits.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {match.matched_traits.slice(0, 3).map((trait) => (
                <span
                  key={trait}
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                >
                  {trait}
                </span>
              ))}
              {match.matched_traits.length > 3 && (
                <span className="text-[10px] text-text-secondary">
                  +{match.matched_traits.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="border-t border-border pt-3">
        <ScoreBreakdown
          visual={match.visual_score}
          description={match.description_score}
          proximity={match.proximity_score}
          other={match.other_score}
        />
      </div>
    </Link>
  );
}
