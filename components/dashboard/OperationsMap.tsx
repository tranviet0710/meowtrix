"use client";

import { useEffect, useState } from "react";
import { MapViewDynamic } from "@/components/map/MapViewDynamic";
import { AvatarMarker } from "@/components/map/AvatarMarker";
import { MapPopup, MapEmptyState } from "@/components/map/MapPopup";
import type { Agent, Overlord } from "@/types";

/**
 * OperationsMap — Dashboard hero map showing active missing pets and sightings.
 *
 * - Missing pets (Overlords) show as pins with a red ring; active ones pulse.
 * - Sightings (Agents) show as pins with a green ring.
 * - Only active records are rendered — reunited / resolved cases are hidden
 *   so the map stays focused on ongoing recovery efforts.
 * - Empty state overlay shows when no active records exist.
 */
export function OperationsMap() {
  const [overlords, setOverlords] = useState<Overlord[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPins() {
      try {
        const [overlordsRes, agentsRes] = await Promise.all([
          fetch("/api/overlords?status=active", {
            credentials: "same-origin",
          }),
          fetch("/api/agents?status=active", {
            credentials: "same-origin",
          }),
        ]);

        const overlordsJson = overlordsRes.ok
          ? await overlordsRes.json()
          : { overlords: [] };
        const agentsJson = agentsRes.ok
          ? await agentsRes.json()
          : { agents: [] };

        if (cancelled) return;

        setOverlords(
          Array.isArray(overlordsJson.overlords) ? overlordsJson.overlords : []
        );
        setAgents(
          Array.isArray(agentsJson.agents) ? agentsJson.agents : []
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

  const validAgents = agents.filter(
    (a) =>
      typeof a.sighting_lat === "number" &&
      typeof a.sighting_lng === "number" &&
      !Number.isNaN(a.sighting_lat) &&
      !Number.isNaN(a.sighting_lng)
  );

  const showEmptyState =
    loaded && validOverlords.length === 0 && validAgents.length === 0;

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

        {validAgents.map((a) => (
          <AvatarMarker
            key={`agent-${a.id}`}
            position={[a.sighting_lat, a.sighting_lng]}
            type="agent"
            status={a.status}
            photoUrl={a.photos?.[0]}
            petType={a.pet_type}
            altLabel={`Sighting of a ${a.pet_type}`}
          >
            <MapPopup
              photoUrl={a.photos?.[0]}
              description={a.description}
              timestamp={a.sighted_at}
              type="agent"
            />
          </AvatarMarker>
        ))}
      </MapViewDynamic>
      {showEmptyState && <MapEmptyState />}
    </>
  );
}
