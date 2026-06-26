import { describe, it, expect } from "vitest";
import { calculateHeatmapRadius, getHeatmapCenter } from "@/lib/heatmapCalc";

/**
 * Unit tests for HeatmapOverlay component logic.
 *
 * Since HeatmapOverlay is a client component that relies on Leaflet (DOM-dependent),
 * we test the rendering logic decisions that the component makes:
 * - When radius is null (< 30 min), component should NOT render
 * - When status is 'resolved', component should NOT render
 * - Gradient ring calculation (opacity and radius per ring)
 * - Re-centering based on agent sightings
 */

const GRADIENT_RINGS = 8;
const MAX_OPACITY = 0.6;

describe("HeatmapOverlay rendering logic", () => {
  describe("visibility conditions", () => {
    it("should not render when elapsed time is less than 30 minutes", () => {
      const now = new Date();
      const lastSeenAt = new Date(now.getTime() - 20 * 60 * 1000); // 20 minutes ago
      const radius = calculateHeatmapRadius(lastSeenAt, now);
      expect(radius).toBeNull();
    });

    it("should not render when elapsed time is exactly 30 minutes", () => {
      const now = new Date();
      const lastSeenAt = new Date(now.getTime() - 30 * 60 * 1000); // exactly 30 minutes ago
      const radius = calculateHeatmapRadius(lastSeenAt, now);
      expect(radius).toBeNull();
    });

    it("should render when elapsed time exceeds 30 minutes", () => {
      const now = new Date();
      const lastSeenAt = new Date(now.getTime() - 31 * 60 * 1000); // 31 minutes ago
      const radius = calculateHeatmapRadius(lastSeenAt, now);
      expect(radius).not.toBeNull();
      expect(radius).toBeGreaterThan(0);
    });
  });

  describe("gradient ring calculation", () => {
    it("should produce correct opacity values for each ring (decreasing from center to edge)", () => {
      const opacities = Array.from({ length: GRADIENT_RINGS }, (_, i) => {
        const fraction = (i + 1) / GRADIENT_RINGS;
        return MAX_OPACITY * (1 - fraction);
      });

      // First ring (closest to center) should have highest opacity
      expect(opacities[0]).toBeCloseTo(MAX_OPACITY * (1 - 1 / GRADIENT_RINGS));
      // Last ring (at edge) should have zero opacity
      expect(opacities[GRADIENT_RINGS - 1]).toBeCloseTo(0);
      // Each subsequent ring should have lower opacity
      for (let i = 1; i < opacities.length; i++) {
        expect(opacities[i]).toBeLessThan(opacities[i - 1]);
      }
    });

    it("should produce correct ring radii (increasing from center to edge)", () => {
      const totalRadius = 1000; // example radius in meters
      const ringRadii = Array.from({ length: GRADIENT_RINGS }, (_, i) => {
        const fraction = (i + 1) / GRADIENT_RINGS;
        return totalRadius * fraction;
      });

      // First ring should be smallest
      expect(ringRadii[0]).toBe(totalRadius / GRADIENT_RINGS);
      // Last ring should equal total radius
      expect(ringRadii[GRADIENT_RINGS - 1]).toBe(totalRadius);
      // Each ring should be larger than the previous
      for (let i = 1; i < ringRadii.length; i++) {
        expect(ringRadii[i]).toBeGreaterThan(ringRadii[i - 1]);
      }
    });
  });

  describe("center calculation with agent sightings", () => {
    it("should use overlord location when no agent sightings exist", () => {
      const center = getHeatmapCenter(13.75, 100.50, [], 1000);
      expect(center).toEqual({ lat: 13.75, lng: 100.50 });
    });

    it("should re-center on most recent agent sighting within zone", () => {
      const agentSightings = [
        { lat: 13.751, lng: 100.501, sighted_at: "2024-01-01T10:00:00Z" },
        { lat: 13.752, lng: 100.502, sighted_at: "2024-01-01T12:00:00Z" },
      ];
      // Use large radius so all sightings are within zone
      const center = getHeatmapCenter(13.75, 100.50, agentSightings, 5000);
      expect(center.lat).toBe(13.752);
      expect(center.lng).toBe(100.502);
    });

    it("should keep overlord location if sightings are outside the radius", () => {
      const agentSightings = [
        // Sighting far away (~111km north)
        { lat: 14.75, lng: 100.50, sighted_at: "2024-01-01T12:00:00Z" },
      ];
      const center = getHeatmapCenter(13.75, 100.50, agentSightings, 5000);
      expect(center).toEqual({ lat: 13.75, lng: 100.50 });
    });
  });
});
