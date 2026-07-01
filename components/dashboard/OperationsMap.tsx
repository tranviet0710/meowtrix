"use client";

import { useEffect, useState } from "react";
import { MapViewDynamic } from "@/components/map/MapViewDynamic";
import { AvatarMarker } from "@/components/map/AvatarMarker";
import { MapPopup, MapEmptyState } from "@/components/map/MapPopup";
import type { Overlord } from "@/types";

/**
 * OperationsMap — Dashboard hero map showing active Overlords (missing pets).
 *
 * - Each pin is the pet's photo as a circular avatar with a red ring.
 * - Active Overlords pulse to draw attention.
 * - Agents (spotted / found sightings) are intentionally NOT rendered here —
 *   the dashboard focuses on active searches so recovery efforts stay in view.
 * - Empty state overlay shows when no active reports exist.
 */
export function OperationsMap() {
  const [overlords, setOverlords] = useState<Overlord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPins() {
      try {
        const overlordsRes = await fetch("/api/overlords?status=active", {
          credentials: "same-origin",
        });
        const overlordsJson = overlordsRes.ok
          ? await overlordsRes.json()
          : { overlords: [] };

        if (cancelled) return;

        setOverlords(
          Array.isArray(overlordsJson.overlords) ? overlordsJson.overlords : []
        );
      } catch (err) {
        console.error("[OperationsMap] Failed to load pins:", err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    loadPins();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sanity-filter rows missing coordinates
  const validOverlords = overlords.filter(
    (o) =>
      typeof o.last_seen_lat === "number" &&
      typeof o.last_seen_lng === "number" &&
      !Number.isNaN(o.last_seen_lat) &&
      !Number.isNaN(o.last_seen_lng)
  );

  const showEmptyState = loaded && validOverlords.length === 0;

  return (
    <>
      <MapViewDynamic className="h-full w-full">
        {validOverlords.map((o) => (
          <AvatarMarker
            key={`overlord-${o.id}`}
            position={[o.last_seen_lat, o.last_seen_lng]}
            type="overlord"
            status={o.status}
            photoUrl={o.photos?.[0]}
            petType={o.pet_type}
            altLabel={
              o.pet_name
                ? `${o.pet_name} — missing ${o.pet_type}`
                : `Missing ${o.pet_type}`
            }
          >
            <MapPopup
              photoUrl={o.photos?.[0]}
              name={o.pet_name}
              description={o.description}
              timestamp={o.last_seen_at}
              type="overlord"
            />
          </AvatarMarker>
        ))}
      </MapViewDynamic>
      {showEmptyState && <MapEmptyState />}
    </>
  );
}
