"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { PetRegion } from "@/types/ai";

/**
 * AiPhotoPicker — grid of toggleable tiles for up to 5 AI-detected pet crops
 * plus a "Full screenshot" tile. Selection is controlled by the parent; the
 * component enforces the [1, 5] cap silently (extra clicks past 5 are ignored)
 * and exposes `isPhotoSelectionValid` so the modal can decide when to enable
 * "Apply to form".
 *
 * When zero AI crops are returned, only the full-screenshot tile is rendered
 * as the sole selectable candidate (Requirement 6.4).
 *
 * _Requirements: 6.2, 6.3, 6.4, 13.3_
 */

const MIN_SELECTED = 1;
const MAX_SELECTED = 5;

export interface AiPhotoPickerProps {
  /** Up to 5 AI crops, in the order returned by the extractor. */
  regions: PetRegion[];
  /** Always present so the user can pick "the whole post". */
  fullScreenshot: PetRegion;
  /** Currently-selected tile ids, controlled by the parent. */
  selectedIds: string[];
  /** Called with the next selection whenever the user toggles a tile. */
  onChange: (selectedIds: string[]) => void;
}

/**
 * Returns true when the current selection is within [1, 5] and therefore
 * eligible to enable "Apply to form".
 */
export function isPhotoSelectionValid(selectedIds: string[]): boolean {
  return (
    selectedIds.length >= MIN_SELECTED && selectedIds.length <= MAX_SELECTED
  );
}

interface Tile {
  region: PetRegion;
  label: string;
  alt: string;
}

function buildTiles(regions: PetRegion[], fullScreenshot: PetRegion): Tile[] {
  const cropTiles: Tile[] = regions.slice(0, MAX_SELECTED).map((region, i) => ({
    region,
    label: `AI crop ${i + 1}`,
    alt: `AI-detected pet crop ${i + 1}`,
  }));

  const fullTile: Tile = {
    region: fullScreenshot,
    label: "Full screenshot",
    alt: "Full screenshot from original post",
  };

  return [...cropTiles, fullTile];
}

export function AiPhotoPicker({
  regions,
  fullScreenshot,
  selectedIds,
  onChange,
}: AiPhotoPickerProps) {
  const tiles = React.useMemo(
    () => buildTiles(regions, fullScreenshot),
    [regions, fullScreenshot]
  );

  const selectedSet = React.useMemo(
    () => new Set(selectedIds),
    [selectedIds]
  );

  const toggle = React.useCallback(
    (id: string) => {
      if (selectedSet.has(id)) {
        // Deselect.
        onChange(selectedIds.filter((existingId) => existingId !== id));
        return;
      }
      // Cap at MAX_SELECTED — extra clicks past the cap are ignored silently.
      if (selectedIds.length >= MAX_SELECTED) {
        return;
      }
      onChange([...selectedIds, id]);
    },
    [onChange, selectedIds, selectedSet]
  );

  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-label="Choose which photos to attach to the report"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
      >
        {tiles.map((tile) => {
          const selected = selectedSet.has(tile.region.id);
          return (
            <button
              key={tile.region.id}
              type="button"
              onClick={() => toggle(tile.region.id)}
              aria-pressed={selected}
              aria-label={
                selected
                  ? `${tile.label} (selected). Click to deselect.`
                  : `${tile.label}. Click to select.`
              }
              className={cn(
                "group relative aspect-square overflow-hidden rounded-lg border border-border bg-card text-left transition-all",
                "hover:-translate-y-[1px] hover:shadow-soft",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                selected &&
                  "ring-2 ring-primary ring-offset-2 ring-offset-background"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tile.region.data_url}
                alt={tile.alt}
                className="h-full w-full object-cover"
              />

              <span
                aria-hidden="true"
                className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white"
              >
                {tile.label}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-text-secondary">
        Pick 1–5 photos to add to the report.
      </p>
    </div>
  );
}
