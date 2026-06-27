"use client";
import { type ReactNode } from "react";

export interface StatCardProps {
  label: string;
  value: number | null;
  icon: ReactNode;
  isLoading: boolean;
  accentClass?: string;
}

export function StatCard({
  label,
  value,
  icon,
  isLoading,
  accentClass = "bg-[#FFDE4D]/10 text-[#FFDE4D]",
}: StatCardProps) {
  return (
    <div className="flex items-center gap-4 border-[3px] border-[#FFDE4D] bg-[#1A1A2E] p-4 shadow-[4px_4px_0px_#FFDE4D] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#FFDE4D]">
      <div
        className={`flex h-12 w-12 flex-shrink-0 items-center justify-center border-[2px] border-current ${accentClass}`}
      >
        {icon}
      </div>
      <div className="flex flex-col gap-1 overflow-hidden">
        <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
          {label}
        </span>
        {isLoading ? (
          <div
            className="h-7 w-16 animate-pulse bg-border"
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
