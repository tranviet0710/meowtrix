"use client";

import { Flame, Radar } from "lucide-react";

export interface MapLayerToggles {
  probabilityZones: boolean;
  activityHeatmap: boolean;
}

interface MapLayersControlProps {
  value: MapLayerToggles;
  onChange: (next: MapLayerToggles) => void;
  className?: string;
}

/**
 * MapLayersControl — Floating map-layer switcher shown on top of the map.
 *
 * Users can independently toggle:
 * - Probability zones: predictive radius for each missing pet
 * - Activity heatmap: density of all recent reports in the area
 *
 * Positioned by the parent (typically top-right corner over the map). Uses
 * app design tokens (bg-card, border-border, text-primary) so it looks right
 * in both light and dark themes.
 */
export function MapLayersControl({
  value,
  onChange,
  className = "",
}: MapLayersControlProps) {
  return (
    <div
      className={`pointer-events-auto flex flex-col gap-2 rounded-xl border border-border bg-card/95 p-2 shadow-[var(--shadow-soft)] backdrop-blur-sm ${className}`}
      role="group"
      aria-label="Map layers"
    >
      <span className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
        Map layers
      </span>

      <LayerToggle
        icon={<Radar className="h-3.5 w-3.5" aria-hidden="true" />}
        label="Probability zones"
        description="Where each missing pet may be now"
        checked={value.probabilityZones}
        onChange={(checked) =>
          onChange({ ...value, probabilityZones: checked })
        }
      />

      <LayerToggle
        icon={<Flame className="h-3.5 w-3.5" aria-hidden="true" />}
        label="Activity heatmap"
        description="Areas with the most recent reports"
        checked={value.activityHeatmap}
        onChange={(checked) =>
          onChange({ ...value, activityHeatmap: checked })
        }
      />
    </div>
  );
}

interface LayerToggleProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function LayerToggle({
  icon,
  label,
  description,
  checked,
  onChange,
}: LayerToggleProps) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 transition-colors min-w-[200px] max-w-[240px] ${
        checked
          ? "border-primary/40 bg-primary/10"
          : "border-border/60 bg-transparent hover:bg-primary/5"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--color-primary)]"
        aria-label={label}
      />
      <span className="flex flex-1 flex-col gap-0.5 leading-tight">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <span
            className={
              checked ? "text-[var(--color-primary)]" : "text-text-secondary"
            }
          >
            {icon}
          </span>
          {label}
        </span>
        <span className="text-[10px] text-text-secondary">{description}</span>
      </span>
    </label>
  );
}
