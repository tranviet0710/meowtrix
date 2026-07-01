"use client";

import { useEffect, useState } from "react";
import { MapViewDynamic } from "@/components/map/MapViewDynamic";
import { MapMarker } from "@/components/map/MapMarker";
import { MapPopup, MapEmptyState } from "@/components/map/MapPopup";
import type { Overlord, Agent } from "@/types";

/**
 * OperationsMap — Dashboard hero map with live pins for active Overlords
 * (lost pets) and Agents (spotted pets).
 *
 * - Overlords render as red pulsing pins (danger red #FF4444)
 * - Agents render as green static pins (success green #00FF88)
 * - Empty state overlay shows when no reports exist yet
 * - Errors surface silently — the map itself keeps working
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
          fetch("/api/overlords?status=active", { credentials: "same-origin" }),
          fetch("/api/agents?status=active", { credentials: "same-origin" }),
        ]);

        const [overlordsJson, agentsJson] = await Promise.all([
          overlordsRes.ok ? overlordsRes.json() : { overlords: [] },
          agentsRes.ok ? agentsRes.json() : { agents: [] },
        ]);

        if (cancelled) return;

        setOverlords(
          Array.isArray(overlordsJson.overlords) ? overlordsJson.overlords : []
        );
        setAgents(Array.isArray(agentsJson.agents) ? agentsJson.agents : []);
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
          <MapMarker
            key={`overlord-${o.id}`}
            position={[o.last_seen_lat, o.last_seen_lng]}
            type="overlord"
            status={o.status}
          >
            <MapPopup
              photoUrl={o.photos?.[0]}
              name={o.pet_name}
              description={o.description}
              timestamp={o.last_seen_at}
              type="overlord"
            />
          </MapMarker>
        ))}
        {validAgents.map((a) => (
          <MapMarker
            key={`agent-${a.id}`}
            position={[a.sighting_lat, a.sighting_lng]}
            type="agent"
            status={a.status}
          >
            <MapPopup
              photoUrl={a.photos?.[0]}
              description={a.description}
              timestamp={a.sighted_at}
              type="agent"
            />
          </MapMarker>
        ))}
      </MapViewDynamic>
      {showEmptyState && <MapEmptyState />}
    </>
  );
}
