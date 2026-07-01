"use client";
import { type ReactNode } from "react";

export interface StatCardProps {
  label: string;
  value: number | null;
  icon: ReactNode;
  isLoading: boolean;
  accentClass?: string;
}

/**
 * StatCard — Soft, warm dashboard stat tile.
 * The icon sits in a soft-tinted rounded square; the value uses a bold
 * display font. Hover lifts the card gently.
 */
export function StatCard({
  label,
  value,
  icon,
  isLoading,
  accentClass = "bg-primary/10 text-primary",
}: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <div
        className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${accentClass}`}
      >
        {icon}
      </div>
      <div className="flex flex-col gap-1 overflow-hidden">
        <span className="text-xs font-medium text-text-secondary">
          {label}
        </span>
        {isLoading ? (
          <div
            className="h-7 w-16 animate-pulse rounded-md bg-border"
            role="status"
            aria-label={`Loading ${label}`}
          />
        ) : (
          <span className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-text-primary">
            {value !== null ? value.toLocaleString() : "—"}
          </span>
        )}
      </div>
    </div>
  );
}
