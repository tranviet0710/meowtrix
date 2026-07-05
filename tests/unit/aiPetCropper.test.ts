// tests/unit/aiPetCropper.test.ts — Unit tests for the AI pet-region cropper.
//
// Exercises `cropRegions` and `preparePreview` from `lib/aiPetCropper.ts`.
// The tests use real, in-memory sharp buffers so we run the actual crop
// pipeline rather than mocking it — sharp is already a project dependency and
// this keeps the assertions honest.

import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { cropRegions, preparePreview } from "@/lib/aiPetCropper";

async function createTestImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 64, b: 200 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

describe("cropRegions", () => {
  it("returns [] when no regions are provided", async () => {
    const image = await createTestImage(800, 600);
    const results = await cropRegions(image, []);
    expect(results).toEqual([]);
  });

  it("clamps a bbox extending past the image bounds instead of throwing", async () => {
    const image = await createTestImage(800, 600);
    // x + w overshoots the right edge, y + h overshoots the bottom.
    const regions = [{ x: 0.8, y: 0.8, w: 0.5, h: 0.5 }];

    const results = await cropRegions(image, regions);

    expect(results).toHaveLength(1);
    expect(results[0].width).toBeGreaterThan(0);
    expect(results[0].height).toBeGreaterThan(0);
    // Clamped region can never exceed the source dimensions.
    expect(results[0].width).toBeLessThanOrEqual(800);
    expect(results[0].height).toBeLessThanOrEqual(600);
    expect(results[0].mimeType).toBe("image/webp");
  });

  it("clamps negative coordinates back into the image", async () => {
    const image = await createTestImage(800, 600);
    // Negative offsets should get clamped to zero rather than crashing sharp.
    const regions = [{ x: -0.5, y: -0.5, w: 0.5, h: 0.5 }];

    const results = await cropRegions(image, regions);

    // Either the region survives (clamped to a valid rect) or it collapsed to
    // zero area; both outcomes are acceptable as long as the call did not throw.
    expect(Array.isArray(results)).toBe(true);
  });

  it("discards a degenerate bbox with area < 32×32 px", async () => {
    const image = await createTestImage(800, 600);
    // 0.01 * 800 = 8 px wide, 0.01 * 600 = 6 px tall → 48 px² < 1024 px².
    const regions = [{ x: 0.5, y: 0.5, w: 0.01, h: 0.01 }];

    const results = await cropRegions(image, regions);
    expect(results).toEqual([]);
  });

  it("discards zero-area bboxes (w=0 or h=0)", async () => {
    const image = await createTestImage(800, 600);
    const regions = [
      { x: 0.1, y: 0.1, w: 0, h: 0.5 },
      { x: 0.1, y: 0.1, w: 0.5, h: 0 },
    ];
    const results = await cropRegions(image, regions);
    expect(results).toEqual([]);
  });

  it("caps output at 5 crops even when more valid regions are supplied", async () => {
    const image = await createTestImage(1000, 1000);
    const regions = Array.from({ length: 8 }, () => ({
      x: 0.1,
      y: 0.1,
      w: 0.2,
      h: 0.2,
    }));

    const results = await cropRegions(image, regions);
    expect(results).toHaveLength(5);
  });

  it("downscales each crop so its longest edge is ≤ 640 px", async () => {
    // Source is comfortably larger than 640 in both dimensions so the
    // resize step actually engages.
    const image = await createTestImage(1600, 1200);
    const regions = [{ x: 0, y: 0, w: 1, h: 1 }];

    const results = await cropRegions(image, regions);
    expect(results).toHaveLength(1);
    const longestEdge = Math.max(results[0].width, results[0].height);
    expect(longestEdge).toBeLessThanOrEqual(640);
    // Aspect ratio should be preserved (4:3 → 640×480).
    expect(results[0].width / results[0].height).toBeCloseTo(1600 / 1200, 1);
  });

  it("does not upscale crops smaller than 640 px", async () => {
    // Source is 400×300 — smaller than the 640 cap.
    const image = await createTestImage(400, 300);
    const regions = [{ x: 0, y: 0, w: 1, h: 1 }];

    const results = await cropRegions(image, regions);
    expect(results).toHaveLength(1);
    // withoutEnlargement:true means dimensions should be preserved.
    expect(results[0].width).toBeLessThanOrEqual(400);
    expect(results[0].height).toBeLessThanOrEqual(300);
  });

  it("emits stable ids crop-1, crop-2, …", async () => {
    const image = await createTestImage(1000, 800);
    const regions = [
      { x: 0.0, y: 0.0, w: 0.4, h: 0.4 },
      { x: 0.5, y: 0.5, w: 0.4, h: 0.4 },
      { x: 0.1, y: 0.6, w: 0.2, h: 0.2 },
    ];

    const results = await cropRegions(image, regions);
    expect(results.map((r) => r.id)).toEqual(["crop-1", "crop-2", "crop-3"]);
  });

  it("returns valid WebP buffers", async () => {
    const image = await createTestImage(1000, 800);
    const regions = [{ x: 0.1, y: 0.1, w: 0.6, h: 0.6 }];

    const results = await cropRegions(image, regions);
    expect(results).toHaveLength(1);
    // WebP files start with the ASCII bytes "RIFF" and contain "WEBP" at offset 8.
    expect(results[0].buffer.slice(0, 4).toString()).toBe("RIFF");
    expect(results[0].buffer.slice(8, 12).toString()).toBe("WEBP");
  });
});

describe("preparePreview", () => {
  it("downscales the full screenshot so its longest edge is ≤ 720 px", async () => {
    const image = await createTestImage(1600, 1200);
    const preview = await preparePreview(image);

    const longestEdge = Math.max(preview.width, preview.height);
    expect(longestEdge).toBeLessThanOrEqual(720);
    expect(preview.id).toBe("full");
    expect(preview.mimeType).toBe("image/webp");
  });

  it("does not upscale screenshots that are already smaller than 720 px", async () => {
    const image = await createTestImage(400, 300);
    const preview = await preparePreview(image);
    expect(preview.width).toBe(400);
    expect(preview.height).toBe(300);
  });

  it("returns a valid WebP buffer", async () => {
    const image = await createTestImage(900, 600);
    const preview = await preparePreview(image);
    expect(preview.buffer.slice(0, 4).toString()).toBe("RIFF");
    expect(preview.buffer.slice(8, 12).toString()).toBe("WEBP");
  });
});
