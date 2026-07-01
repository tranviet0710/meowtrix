"use client";

import { useEffect, useMemo, useState } from "react";
import { MapViewDynamic } from "@/components/map/MapViewDynamic";
import { AvatarMarker } from "@/components/map/AvatarMarker";
import { MapPopup, MapEmptyState } from "@/components/map/MapPopup";
import { HeatmapOverlay } from "@/components/map/HeatmapOverlay";
import { ActivityHeatmapLayer } from "@/components/map/ActivityHeatmapLayer";
import {
  MapLayersControl,
  type MapLayerToggles,
} from "@/components/map/MapLayersControl";
import type { Agent, Overlord } from "@/types";

/**
 * OperationsMap — Dashboard hero map showing active missing pets and sightings.
 *
 * - Missing pets (Overlords) show as pins with a red ring; active ones pulse.
 * - Sightings (Agents) show as pins with a green ring.
 * - Only active records are rendered — reunited / resolved cases are hidden
 *   so the map stays focused on ongoing recovery efforts.
 * - Two optional map layers can be toggled by the user:
 *   • Probability zones — a widening predicted-location halo per active missing pet
 *   • Activity heatmap — density of all recent reports across the area
 * - Empty state overlay shows when no active records exist.
 */
export function OperationsMap() {
  const [overlords, setOverlords] = useState<Overlord[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [layers, setLayers] = useState<MapLayerToggles>({
    probabilityZones: true,
    activityHeatmap: false,
  });

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
  const validOverlords = useMemo(
    () =>
      overlords.filter(
        (o) =>
          typeof o.last_seen_lat === "number" &&
          typeof o.last_seen_lng === "number" &&
          !Number.isNaN(o.last_seen_lat) &&
          !Number.isNaN(o.last_seen_lng)
      ),
    [overlords]
  );

  const validAgents = useMemo(
    () =>
      agents.filter(
        (a) =>
          typeof a.sighting_lat === "number" &&
          typeof a.sighting_lng === "number" &&
          !Number.isNaN(a.sighting_lat) &&
          !Number.isNaN(a.sighting_lng)
      ),
    [agents]
  );

  // Sightings feed for probability zone re-centering. Shape matches the
  // string-timestamp overload of getHeatmapCenter.
  const agentSightings = useMemo(
    () =>
      validAgents.map((a) => ({
        lat: a.sighting_lat,
        lng: a.sighting_lng,
        sighted_at: a.sighted_at,
      })),
    [validAgents]
  );

  // Aggregate all report locations for the density heatmap. Missing pets
  // carry more weight than sightings so the "hot zones" trend toward areas
  // with active lost cases, not just casual sightings.
  const heatmapPoints = useMemo(
    () => [
      ...validOverlords.map((o) => ({
        lat: o.last_seen_lat,
        lng: o.last_seen_lng,
        weight: 2,
      })),
      ...validAgents.map((a) => ({
        lat: a.sighting_lat,
        lng: a.sighting_lng,
        weight: 1,
      })),
    ],
    [validOverlords, validAgents]
  );

  const showEmptyState =
    loaded && validOverlords.length === 0 && validAgents.length === 0;

  return (
    <>
      <MapViewDynamic className="h-full w-full">
        {/* Probability zones per active missing pet */}
        {layers.probabilityZones &&
          validOverlords.map((o) => (
            <HeatmapOverlay
              key={`heat-${o.id}`}
              overlordId={o.id}
              lastSeenLat={o.last_seen_lat}
              lastSeenLng={o.last_seen_lng}
              lastSeenAt={o.last_seen_at}
              agentSightings={agentSightings}
              status={o.status}
            />
          ))}

        {/* City-wide activity density */}
        {layers.activityHeatmap && heatmapPoints.length > 0 && (
          <ActivityHeatmapLayer points={heatmapPoints} />
        )}

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

      {/* Floating layer toggles — top-right so they don't clash with the
          "Live Map" caption in the top-left of the dashboard card. */}
      <div className="pointer-events-none absolute right-3 top-3 z-[500]">
        <MapLayersControl value={layers} onChange={setLayers} />
      </div>

      {showEmptyState && <MapEmptyState />}
    </>
  );
}
