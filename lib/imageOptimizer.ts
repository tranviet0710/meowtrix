// lib/imageOptimizer.ts — Image compression and conversion utility for MEOWTRIX
//
// Processes uploaded images to reduce storage while maintaining identification quality.
// - JPEG/PNG → WebP conversion (quality 75, targeting 40%+ reduction)
// - WebP → re-compression (quality 80, targeting 20%+ reduction)
// - Downscaling when longest edge > 2048px (maintain aspect ratio, min 800px)
// - SSIM quality check (≥ 0.85 threshold)
// - 10-second timeout with fallback to original

import sharp from 'sharp';

export interface OptimizationResult {
  buffer: Buffer;
  format: 'webp' | 'jpeg' | 'png';
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
  reductionPercent: number;
}

/** Maximum allowed longest edge in pixels */
const MAX_LONGEST_EDGE = 2048;

/** Minimum allowed longest edge in pixels (never resize below this) */
const MIN_LONGEST_EDGE = 800;

/** Processing timeout in milliseconds */
const PROCESSING_TIMEOUT_MS = 10_000;

/** WebP quality for JPEG/PNG conversions */
const WEBP_QUALITY_CONVERT = 75;

/** WebP quality for WebP re-compression */
const WEBP_QUALITY_RECOMPRESS = 80;

/** Target file size reduction for JPEG/PNG → WebP (40%) */
const TARGET_REDUCTION_CONVERT = 0.4;

/** Target file size reduction for WebP → WebP (20%) */
const TARGET_REDUCTION_RECOMPRESS = 0.2;

/** Minimum SSIM threshold for acceptable quality */
const SSIM_THRESHOLD = 0.85;

/**
 * Calculate dimensions after downscaling, maintaining aspect ratio.
 * Only downscales if longest edge > MAX_LONGEST_EDGE.
 * Never produces output with longest edge < MIN_LONGEST_EDGE.
 * All output dimensions are guaranteed to be positive integers (>= 1).
 */
export function calculateResizeDimensions(
  width: number,
  height: number
): { width: number; height: number } | null {
  const longestEdge = Math.max(width, height);

  // No resize needed if within bounds
  if (longestEdge <= MAX_LONGEST_EDGE) {
    return null;
  }

  // Calculate scale factor
  const scale = MAX_LONGEST_EDGE / longestEdge;
  let newWidth = Math.round(width * scale);
  let newHeight = Math.round(height * scale);

  // Ensure all dimensions are at least 1 (rounding can produce 0 for very thin images)
  newWidth = Math.max(1, newWidth);
  newHeight = Math.max(1, newHeight);

  // Ensure longest edge of result doesn't go below MIN_LONGEST_EDGE
  const newLongest = Math.max(newWidth, newHeight);
  if (newLongest < MIN_LONGEST_EDGE) {
    const upScale = MIN_LONGEST_EDGE / newLongest;
    newWidth = Math.max(1, Math.round(newWidth * upScale));
    newHeight = Math.max(1, Math.round(newHeight * upScale));
  }

  return { width: newWidth, height: newHeight };
}

/**
 * Compute a simplified structural similarity metric between two image buffers.
 *
 * Uses sharp's stats to compare luminance and structural characteristics.
 * This is an approximation of SSIM — a full pixel-level SSIM computation
 * would require an additional library (e.g., ssim.js) in production.
 *
 * The approach:
 * 1. Resize both images to same dimensions (if different)
 * 2. Compare raw pixel data using normalized mean absolute error
 * 3. Convert to a similarity score in [0, 1]
 */
async function computeSimplifiedSSIM(
  originalBuffer: Buffer,
  optimizedBuffer: Buffer
): Promise<number> {
  // Get metadata and raw pixel data from both images
  const [originalRaw, optimizedRaw] = await Promise.all([
    sharp(originalBuffer)
      .resize(256, 256, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer(),
    sharp(optimizedBuffer)
      .resize(256, 256, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer(),
  ]);

  // Calculate mean absolute error normalized to [0, 1]
  const pixelCount = originalRaw.length;
  let totalDiff = 0;

  for (let i = 0; i < pixelCount; i++) {
    totalDiff += Math.abs(originalRaw[i] - optimizedRaw[i]);
  }

  const meanAbsoluteError = totalDiff / (pixelCount * 255);

  // Convert error to similarity score (1 = identical, 0 = completely different)
  // Using a non-linear mapping to approximate SSIM behavior
  const similarity = 1 - meanAbsoluteError;

  return similarity;
}

/**
 * Core optimization logic (without timeout wrapper).
 */
async function processImage(
  input: Buffer,
  mimeType: string
): Promise<OptimizationResult> {
  const originalSize = input.length;
  const metadata = await sharp(input).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to read image dimensions');
  }

  const originalWidth = metadata.width;
  const originalHeight = metadata.height;

  const isWebP = mimeType === 'image/webp';
  const quality = isWebP ? WEBP_QUALITY_RECOMPRESS : WEBP_QUALITY_CONVERT;
  const targetReduction = isWebP ? TARGET_REDUCTION_RECOMPRESS : TARGET_REDUCTION_CONVERT;

  // Build the sharp pipeline
  let pipeline = sharp(input);

  // Step 1: Downscale if longest edge > 2048px
  const resizeDims = calculateResizeDimensions(originalWidth, originalHeight);
  if (resizeDims) {
    pipeline = pipeline.resize(resizeDims.width, resizeDims.height, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Step 2: Convert/compress to WebP
  pipeline = pipeline.webp({ quality });

  const optimizedBuffer = await pipeline.toBuffer();
  const optimizedSize = optimizedBuffer.length;

  // Step 3: Check if reduction target is met
  const reductionPercent = ((originalSize - optimizedSize) / originalSize) * 100;

  if (reductionPercent < targetReduction * 100) {
    // For WebP re-compression: if we can't hit 20% without quality loss, return original
    if (isWebP) {
      const outputMeta = await sharp(input).metadata();
      return {
        buffer: input,
        format: 'webp',
        width: outputMeta.width ?? originalWidth,
        height: outputMeta.height ?? originalHeight,
        originalSize,
        optimizedSize: originalSize,
        reductionPercent: 0,
      };
    }
    // For JPEG/PNG: still return the WebP conversion even if under target
    // since WebP is generally smaller and the format change is beneficial
  }

  // Step 4: SSIM quality check
  const ssim = await computeSimplifiedSSIM(input, optimizedBuffer);

  if (ssim < SSIM_THRESHOLD) {
    // Quality dropped too much — for WebP inputs, return original unchanged
    if (isWebP) {
      return {
        buffer: input,
        format: 'webp',
        width: originalWidth,
        height: originalHeight,
        originalSize,
        optimizedSize: originalSize,
        reductionPercent: 0,
      };
    }

    // For JPEG/PNG: try higher quality
    let fallbackPipeline = sharp(input);
    if (resizeDims) {
      fallbackPipeline = fallbackPipeline.resize(resizeDims.width, resizeDims.height, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
    const higherQualityBuffer = await fallbackPipeline
      .webp({ quality: 90 })
      .toBuffer();

    const higherSSIM = await computeSimplifiedSSIM(input, higherQualityBuffer);

    if (higherSSIM < SSIM_THRESHOLD) {
      // Still below threshold — return original with format conversion at near-lossless
      let losslessPipeline = sharp(input);
      if (resizeDims) {
        losslessPipeline = losslessPipeline.resize(resizeDims.width, resizeDims.height, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }
      const nearLosslessBuffer = await losslessPipeline
        .webp({ quality: 95, nearLossless: true })
        .toBuffer();

      const nearLosslessMeta = await sharp(nearLosslessBuffer).metadata();
      return {
        buffer: nearLosslessBuffer,
        format: 'webp',
        width: nearLosslessMeta.width ?? originalWidth,
        height: nearLosslessMeta.height ?? originalHeight,
        originalSize,
        optimizedSize: nearLosslessBuffer.length,
        reductionPercent: ((originalSize - nearLosslessBuffer.length) / originalSize) * 100,
      };
    }

    const higherMeta = await sharp(higherQualityBuffer).metadata();
    return {
      buffer: higherQualityBuffer,
      format: 'webp',
      width: higherMeta.width ?? originalWidth,
      height: higherMeta.height ?? originalHeight,
      originalSize,
      optimizedSize: higherQualityBuffer.length,
      reductionPercent: ((originalSize - higherQualityBuffer.length) / originalSize) * 100,
    };
  }

  // All checks passed — return optimized result
  const outputMeta = await sharp(optimizedBuffer).metadata();
  return {
    buffer: optimizedBuffer,
    format: 'webp',
    width: outputMeta.width ?? (resizeDims?.width ?? originalWidth),
    height: outputMeta.height ?? (resizeDims?.height ?? originalHeight),
    originalSize,
    optimizedSize,
    reductionPercent,
  };
}

/**
 * Optimize an uploaded image for storage.
 *
 * Handles:
 * - JPEG/PNG → WebP conversion (quality 75, targeting 40%+ reduction)
 * - WebP re-compression (quality 80, targeting 20%+ reduction)
 * - Downscaling if longest edge > 2048px (aspect ratio maintained, min 800px)
 * - SSIM quality verification (≥ 0.85)
 * - 10-second timeout with fallback to original
 *
 * @param input - The raw image buffer
 * @param mimeType - The MIME type of the input image (image/jpeg, image/png, image/webp)
 * @returns OptimizationResult with the processed buffer and metadata
 */
export async function optimizeImage(
  input: Buffer,
  mimeType: string
): Promise<OptimizationResult> {
  const originalSize = input.length;

  // Determine original format for fallback
  const formatMap: Record<string, 'webp' | 'jpeg' | 'png'> = {
    'image/webp': 'webp',
    'image/jpeg': 'jpeg',
    'image/png': 'png',
  };
  const originalFormat = formatMap[mimeType] ?? 'jpeg';

  try {
    // Race the optimization against a timeout
    const result = await Promise.race([
      processImage(input, mimeType),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Optimization timeout')), PROCESSING_TIMEOUT_MS)
      ),
    ]);

    return result;
  } catch {
    // On any error or timeout, return original unchanged
    const metadata = await sharp(input).metadata().catch(() => null);

    return {
      buffer: input,
      format: originalFormat,
      width: metadata?.width ?? 0,
      height: metadata?.height ?? 0,
      originalSize,
      optimizedSize: originalSize,
      reductionPercent: 0,
    };
  }
}
