"use client";

import { type ReactNode } from "react";

export interface StatCardProps {
  /** Label displayed above the value */
  label: string;
  /** The stat value to display */
  value: number | null;
  /** Icon component rendered in the card */
  icon: ReactNode;
  /** Whether the card is in loading state */
  isLoading: boolean;
  /** Accent color class for the icon background */
  accentClass?: string;
}

/**
 * StatCard — A single stat card with loading skeleton support.
 *
 * Displays a labeled numeric value with an icon. Shows a pulsing skeleton
 * while data is loading. Uses the dark command-center aesthetic.
 */
export function StatCard({
  label,
  value,
  icon,
  isLoading,
  accentClass = "bg-accent/10 text-accent",
}: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-[2px] border border-border bg-card p-4 transition-colors hover:border-accent/30">
      {/* Icon */}
      <div
        className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[2px] ${accentClass}`}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1 overflow-hidden">
        <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
          {label}
        </span>

        {isLoading ? (
          <div
            className="h-7 w-16 animate-pulse rounded-[2px] bg-border"
            role="status"
            aria-label={`Loading ${label}`}
          />
        ) : (
          <span className="font-mono text-2xl font-bold text-text-primary">
            {value !== null ? value.toLocaleString() : "—"}
          </span>
        )}
      </div>
    </div>
  );
}
