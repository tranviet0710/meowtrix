// tests/unit/imageOptimizer.test.ts — Unit tests for the image optimizer utility

import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { optimizeImage, calculateResizeDimensions } from '@/lib/imageOptimizer';

// --- Helper to create test images ---

async function createTestJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 64, b: 200 },
    },
  })
    .jpeg({ quality: 95 })
    .toBuffer();
}

async function createTestPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 100, g: 150, b: 50, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

async function createTestWebp(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .webp({ quality: 95 })
    .toBuffer();
}

// --- calculateResizeDimensions tests ---

describe('calculateResizeDimensions', () => {
  it('returns null when longest edge is within bounds', () => {
    expect(calculateResizeDimensions(1920, 1080)).toBeNull();
    expect(calculateResizeDimensions(2048, 1536)).toBeNull();
    expect(calculateResizeDimensions(800, 600)).toBeNull();
  });

  it('scales down when longest edge exceeds 2048', () => {
    const result = calculateResizeDimensions(4096, 2048);
    expect(result).not.toBeNull();
    expect(result!.width).toBe(2048);
    expect(result!.height).toBe(1024);
  });

  it('maintains aspect ratio for portrait images', () => {
    const result = calculateResizeDimensions(1500, 3000);
    expect(result).not.toBeNull();
    // Longest edge (height) should scale to 2048
    expect(result!.height).toBe(2048);
    expect(result!.width).toBe(1024);
  });

  it('maintains aspect ratio for landscape images', () => {
    const result = calculateResizeDimensions(4000, 3000);
    expect(result).not.toBeNull();
    expect(result!.width).toBe(2048);
    expect(result!.height).toBe(1536);
  });

  it('does not resize below MIN_LONGEST_EDGE', () => {
    // Edge case: very tall, narrow image where scaling to 2048 height
    // would result in an extremely small width. But since the longest edge
    // at 2048 is still above 800, this should be fine.
    const result = calculateResizeDimensions(100, 10000);
    expect(result).not.toBeNull();
    // The longest is 10000, scale to 2048. Width = 100 * (2048/10000) = 20
    // But longest edge is 2048 which is >= 800, so no upscale needed
    expect(result!.height).toBe(2048);
    expect(result!.width).toBe(Math.round(100 * (2048 / 10000)));
  });
});

// --- optimizeImage tests ---

describe('optimizeImage', () => {
  it('converts JPEG to WebP', async () => {
    const jpeg = await createTestJpeg(1024, 768);
    const result = await optimizeImage(jpeg, 'image/jpeg');

    expect(result.format).toBe('webp');
    expect(result.originalSize).toBe(jpeg.length);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('converts PNG to WebP', async () => {
    const png = await createTestPng(1024, 768);
    const result = await optimizeImage(png, 'image/png');

    expect(result.format).toBe('webp');
    expect(result.originalSize).toBe(png.length);
  });

  it('re-compresses WebP', async () => {
    const webp = await createTestWebp(1024, 768);
    const result = await optimizeImage(webp, 'image/webp');

    expect(result.format).toBe('webp');
    expect(result.originalSize).toBe(webp.length);
  });

  it('downscales images with longest edge > 2048px', async () => {
    const large = await createTestJpeg(4096, 3072);
    const result = await optimizeImage(large, 'image/jpeg');

    expect(result.width).toBeLessThanOrEqual(2048);
    expect(result.height).toBeLessThanOrEqual(2048);
    // Should maintain aspect ratio (4:3)
    const ratio = result.width / result.height;
    expect(ratio).toBeCloseTo(4 / 3, 1);
  });

  it('does not downscale images at or below 2048px', async () => {
    const small = await createTestJpeg(1920, 1080);
    const result = await optimizeImage(small, 'image/jpeg');

    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });

  it('does not downscale images with longest edge <= 800px', async () => {
    const tiny = await createTestJpeg(800, 600);
    const result = await optimizeImage(tiny, 'image/jpeg');

    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  it('returns optimizedSize less than or equal to originalSize for JPEG', async () => {
    // Use a larger image to ensure WebP conversion saves space
    const jpeg = await createTestJpeg(2048, 1536);
    const result = await optimizeImage(jpeg, 'image/jpeg');

    expect(result.optimizedSize).toBeLessThanOrEqual(result.originalSize);
  });

  it('reports accurate reductionPercent', async () => {
    const jpeg = await createTestJpeg(2048, 1536);
    const result = await optimizeImage(jpeg, 'image/jpeg');

    const expectedReduction =
      ((result.originalSize - result.optimizedSize) / result.originalSize) * 100;
    expect(result.reductionPercent).toBeCloseTo(expectedReduction, 1);
  });

  it('handles invalid/corrupted input gracefully', async () => {
    const garbage = Buffer.from('not a real image at all');
    const result = await optimizeImage(garbage, 'image/jpeg');

    // Should fallback to returning original
    expect(result.buffer).toBe(garbage);
    expect(result.reductionPercent).toBe(0);
  });

  it('returns original format in result when optimization fails', async () => {
    const garbage = Buffer.from('corrupted');
    const result = await optimizeImage(garbage, 'image/png');

    expect(result.format).toBe('png');
    expect(result.reductionPercent).toBe(0);
  });
});
