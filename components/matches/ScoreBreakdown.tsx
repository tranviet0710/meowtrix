"use client";

interface ScoreBreakdownProps {
  /** Visual trait similarity score (0-100) */
  visual: number;
  /** Text description similarity score (0-100) */
  description: number;
  /** Geographical proximity score (0-100) */
  proximity: number;
  /** Other fields (breed, fur length) score (0-100) */
  other: number;
}

interface ScoreBarProps {
  label: string;
  score: number;
  weight: string;
  colorClass: string;
}

function ScoreBar({ label, score, weight, colorClass }: ScoreBarProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary">
          {label}{" "}
          <span className="font-mono text-text-secondary/60">({weight})</span>
        </span>
        <span className={`font-mono text-xs font-bold ${colorClass}`}>
          {score}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-[1px] bg-border">
        <div
          className={`h-full transition-all duration-500 ease-out ${colorClass.replace("text-", "bg-")}`}
          style={{ width: `${score}%` }}
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} score: ${score}%`}
        />
      </div>
    </div>
  );
}

/**
 * ScoreBreakdown — Visual breakdown of match component scores.
 *
 * Displays each scoring dimension with a labeled progress bar showing
 * the weight and individual score percentage.
 *
 * Requirements: 8.7
 */
export function ScoreBreakdown({
  visual,
  description,
  proximity,
  other,
}: ScoreBreakdownProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-text-secondary">
        Score Breakdown
      </h3>
      <div className="flex flex-col gap-2.5">
        <ScoreBar
          label="Visual Traits"
          score={visual}
          weight="40%"
          colorClass="text-accent"
        />
        <ScoreBar
          label="Description"
          score={description}
          weight="25%"
          colorClass="text-success"
        />
        <ScoreBar
          label="Proximity"
          score={proximity}
          weight="25%"
          colorClass="text-[#6366F1]"
        />
        <ScoreBar
          label="Other"
          score={other}
          weight="10%"
          colorClass="text-secondary"
        />
      </div>
    </div>
  );
}
