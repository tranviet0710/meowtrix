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
  if (score >= 70) return "text-accent";
  return "text-secondary";
}

function getScoreGlow(score: number): string {
  if (score >= 80) return "shadow-[0_0_12px_rgba(0,255,136,0.2)]";
  if (score >= 70) return "shadow-[0_0_12px_rgba(255,204,0,0.15)]";
  return "";
}

/**
 * MatchCard — Displays a single match suggestion with score and preview.
 *
 * Shows the overall similarity score as a large percentage, photo thumbnails
 * of both the Overlord and Agent, matched traits, and a score breakdown.
 *
 * Requirements: 8.3, 8.5, 8.7
 */
export function MatchCard({ match }: MatchCardProps) {
  const overlord = match.overlords;
  const agent = match.agents;
  const scoreColor = getScoreColor(match.overall_score);
  const scoreGlow = getScoreGlow(match.overall_score);

  return (
    <Link
      href={`/matches/${match.id}`}
      className={`group block rounded-[2px] border border-border bg-card p-4 transition-all duration-200 hover:border-accent/40 hover:bg-card/80 ${scoreGlow}`}
      aria-label={`Match suggestion: ${overlord?.pet_name ?? "Unknown"} — ${match.overall_score}% confidence`}
    >
      {/* Header: Score + Status */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`font-mono text-2xl font-bold ${scoreColor}`}
            aria-label={`Overall match score: ${match.overall_score}%`}
          >
            {match.overall_score}%
          </div>
          <span className="text-xs uppercase tracking-wider text-text-secondary">
            MATCH CONFIDENCE
          </span>
        </div>
        <span
          className={`rounded-[2px] px-2 py-0.5 font-mono text-xs uppercase ${
            match.status === "pending"
              ? "bg-accent/10 text-accent"
              : match.status === "claimed"
                ? "bg-success/10 text-success"
                : match.status === "resolved"
                  ? "bg-secondary/10 text-secondary"
                  : "bg-danger/10 text-danger"
          }`}
        >
          {match.status}
        </span>
      </div>

      {/* Photos comparison */}
      <div className="mb-3 flex items-center gap-3">
        {/* Overlord photo */}
        <div className="flex flex-col items-center gap-1">
          <div className="h-16 w-16 overflow-hidden rounded-[2px] border border-danger/30 bg-background">
            {overlord?.photos?.[0] ? (
              <img
                src={overlord.photos[0]}
                alt={`Lost pet: ${overlord.pet_name}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-text-secondary">
                ?
              </div>
            )}
          </div>
          <span className="text-[10px] font-mono uppercase text-danger">
            OVERLORD
          </span>
        </div>

        {/* Connection indicator */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="h-px w-6 bg-accent/50" />
          <span className="text-xs text-accent">⟷</span>
          <div className="h-px w-6 bg-accent/50" />
        </div>

        {/* Agent photo */}
        <div className="flex flex-col items-center gap-1">
          <div className="h-16 w-16 overflow-hidden rounded-[2px] border border-success/30 bg-background">
            {agent?.photos?.[0] ? (
              <img
                src={agent.photos[0]}
                alt={`Spotted cat: ${agent.description || "Agent sighting"}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-text-secondary">
                ?
              </div>
            )}
          </div>
          <span className="text-[10px] font-mono uppercase text-success">
            AGENT
          </span>
        </div>

        {/* Cat name and timing */}
        <div className="ml-3 flex flex-1 flex-col gap-1 overflow-hidden">
          <p className="truncate text-sm font-medium text-text-primary">
            {overlord?.pet_name ?? "Unknown Overlord"}
          </p>
          <p className="text-xs text-text-secondary">
            Detected{" "}
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
                  className="rounded-[1px] bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent"
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
