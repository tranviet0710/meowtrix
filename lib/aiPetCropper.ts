// lib/aiPetCropper.ts — Pet-region cropping for AI-assisted report creation.
//
// Takes a screenshot buffer plus normalized bounding boxes (0..1) returned by
// the Gemini vision model in `lib/aiScreenshotExtractor.ts` and produces up to
// 5 WebP crops that are small enough to be base64-encoded into a JSON payload
// for the browser. Also exposes `preparePreview` so the API route can send a
// downscaled preview of the whole screenshot for the "Full screenshot" tile.
//
// Design references:
// - .kiro/specs/create-report-with-ai/design.md § "lib/aiPetCropper.ts"
// - Requirements 6.1 (≤ 5 crops), 6.2 (full-screenshot tile), 6.4 (zero-crop fallback)

import sharp from 'sharp';

/**
 * A cropped or downscaled region ready for the client. The buffer is a WebP
 * payload that the API route base64-encodes into a `data:image/webp;base64,…`
 * URL for the JSON response.
 */
export interface CroppedRegion {
  /** Stable per-response id: "crop-1"…"crop-5" for detections, "full" for the preview. */
  id: string;
  buffer: Buffer;
  mimeType: 'image/webp';
  width: number;
  height: number;
}

/** Maximum number of AI crops returned to the client (Requirement 6.1). */
const MAX_CROPS = 5;

/** Longest-edge cap for individual crops. Keeps base64 payloads small. */
const MAX_CROP_LONGEST_EDGE = 640;

/** Longest-edge cap for the full-screenshot preview tile. */
const MAX_PREVIEW_LONGEST_EDGE = 720;

/** WebP quality for AI crops. */
const CROP_WEBP_QUALITY = 80;

/** WebP quality for the full-screenshot preview. */
const PREVIEW_WEBP_QUALITY = 78;

/**
 * Minimum crop area (in image-pixel²) below which a region is discarded as a
 * "degenerate" bounding box. Chosen so a 32×32 pixel square is the smallest
 * useful thumbnail; anything smaller is almost certainly a false positive.
 */
const MIN_CROP_AREA_PX = 32 * 32;

/** Normalized bounding box the Gemini extractor returns for a pet region. */
export interface NormalizedRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Clamp a number into [min, max]. Non-finite inputs collapse to `min`.
 */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Convert one normalized region into an integer-pixel extract rectangle
 * clamped to the image dimensions. Returns `null` when the resulting box has
 * area smaller than `MIN_CROP_AREA_PX` (degenerate) or when the bounding box
 * lies entirely outside the image.
 */
function normalizedRegionToPixelBox(
  region: NormalizedRegion,
  imageWidth: number,
  imageHeight: number
): { left: number; top: number; width: number; height: number } | null {
  const nx = clamp(region.x, 0, 1);
  const ny = clamp(region.y, 0, 1);
  const nw = clamp(region.w, 0, 1);
  const nh = clamp(region.h, 0, 1);

  // Convert to pixel coordinates first, then clamp so left+width and top+height
  // never exceed the image bounds.
  let left = Math.round(nx * imageWidth);
  let top = Math.round(ny * imageHeight);
  let width = Math.round(nw * imageWidth);
  let height = Math.round(nh * imageHeight);

  left = clamp(left, 0, Math.max(0, imageWidth - 1));
  top = clamp(top, 0, Math.max(0, imageHeight - 1));

  // Keep the crop inside the image regardless of what the model returned.
  const maxWidth = imageWidth - left;
  const maxHeight = imageHeight - top;
  width = clamp(width, 0, maxWidth);
  height = clamp(height, 0, maxHeight);

  if (width <= 0 || height <= 0) return null;
  if (width * height < MIN_CROP_AREA_PX) return null;

  return { left, top, width, height };
}

/**
 * Extract, downscale, and WebP-encode a single region from the screenshot.
 * Returns the encoded buffer along with the final width/height as reported by
 * sharp so the client can lay out the tile without guessing.
 */
async function extractRegion(
  screenshot: Buffer,
  box: { left: number; top: number; width: number; height: number }
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(screenshot)
    .extract(box)
    .resize({
      width: MAX_CROP_LONGEST_EDGE,
      height: MAX_CROP_LONGEST_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: CROP_WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return { buffer: data, width: info.width, height: info.height };
}

/**
 * Crop candidate pet regions out of a screenshot.
 *
 * Steps:
 * 1. Read the real screenshot dimensions from `sharp.metadata()`.
 * 2. Convert each 0..1-normalized bbox to pixel coordinates and clamp to the
 *    image bounds.
 * 3. Discard boxes whose area is smaller than `MIN_CROP_AREA_PX` (32×32 px).
 * 4. Process at most `MAX_CROPS` (5) surviving boxes — extras are dropped
 *    silently to satisfy Requirement 6.1.
 * 5. Each survivor is downscaled so its longest edge is ≤ 640 px and encoded
 *    as WebP quality 80.
 *
 * The function never throws when a single region fails to extract; a failure
 * simply excludes that region from the returned list so the caller can still
 * offer the full-screenshot fallback (Requirement 6.4).
 */
export async function cropRegions(
  screenshot: Buffer,
  regions: NormalizedRegion[]
): Promise<CroppedRegion[]> {
  if (regions.length === 0) return [];

  const metadata = await sharp(screenshot).metadata();
  if (!metadata.width || !metadata.height) {
    // Without real dimensions we cannot compute pixel boxes; return no crops
    // and let the caller fall back to the full-screenshot tile.
    return [];
  }

  const imageWidth = metadata.width;
  const imageHeight = metadata.height;

  const results: CroppedRegion[] = [];
  for (const region of regions) {
    if (results.length >= MAX_CROPS) break;

    const box = normalizedRegionToPixelBox(region, imageWidth, imageHeight);
    if (!box) continue;

    try {
      const { buffer, width, height } = await extractRegion(screenshot, box);
      results.push({
        id: `crop-${results.length + 1}`,
        buffer,
        mimeType: 'image/webp',
        width,
        height,
      });
    } catch (err) {
      // Skip this region but keep processing the rest — a bad bbox from the
      // model should never take the whole extraction down.
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[aiPetCropper] Failed to extract region: ${message}`);
    }
  }

  return results;
}

/**
 * Produce a WebP preview of the entire screenshot for the "Full screenshot"
 * tile in the photo picker (Requirement 6.2 / 6.4). The preview is downscaled
 * so its longest edge is ≤ 720 px and encoded at WebP quality 78.
 *
 * The result uses the id `"full"` so the client can distinguish it from AI
 * crops without inspecting dimensions.
 */
export async function preparePreview(screenshot: Buffer): Promise<CroppedRegion> {
  const { data, info } = await sharp(screenshot)
    .resize({
      width: MAX_PREVIEW_LONGEST_EDGE,
      height: MAX_PREVIEW_LONGEST_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: PREVIEW_WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return {
    id: 'full',
    buffer: data,
    mimeType: 'image/webp',
    width: info.width,
    height: info.height,
  };
}
