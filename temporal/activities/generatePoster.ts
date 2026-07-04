// temporal/activities/generatePoster.ts — A4 PDF missing poster generation
// Requirements: 7.3, 7.7

import PDFDocument from 'pdfkit';
import { isIP } from "node:net";
import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client for use in Temporal activities.
 */
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
    );
  }

  return createClient(url, key);
}

/**
 * Build a validated URL for image fetching.
 */
function isPrivateOrLoopbackHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true;
  }

  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    const octets = normalized.split(".").map(Number);
    const [a, b] = octets;
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    );
  }

  if (ipVersion === 6) {
    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  return false;
}

function getAllowedImageHosts(): string[] {
  const hosts = new Set<string>();
  const envHosts = process.env.IMAGE_FETCH_ALLOWED_HOSTS;
  if (envHosts) {
    for (const host of envHosts.split(",")) {
      const value = host.trim().toLowerCase();
      if (value) {
        hosts.add(value);
      }
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      hosts.add(new URL(supabaseUrl).hostname.toLowerCase());
    } catch {
      // Ignore invalid env value
    }
  }

  return Array.from(hosts);
}

function buildValidatedImageUrl(imageUrl: string): string {
  try {
    // Minimal path validation
    if (imageUrl.includes('/../') || /\/%2e%2e\//i.test(imageUrl)) {
      throw new Error('Invalid path');
    }
    
    const url = new URL(imageUrl);
    
    // Protocol + host checks
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }

    if (url.username || url.password) {
      throw new Error("Invalid auth in URL");
    }

    const hostname = url.hostname.toLowerCase();
    if (isPrivateOrLoopbackHost(hostname)) {
      throw new Error("Private host is not allowed");
    }

    const allowedHosts = getAllowedImageHosts();
    if (allowedHosts.length > 0 && !allowedHosts.includes(hostname)) {
      throw new Error("Host is not allowed");
    }
    
    return url.href;
  } catch {
    throw new Error('Invalid URL');
  }
}

/**
 * Fetch an image from a URL and return it as a Buffer.
 */
async function fetchImageBuffer(url: string): Promise<Buffer> {
  const validatedUrl = buildValidatedImageUrl(url);
  const response = await fetch(validatedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${url}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generate an A4 PDF missing poster for an Overlord.
 *
 * The poster contains:
 * - "MISSING CAT" header
 * - Cat photo (first available)
 * - Cat name
 * - Trait tags (color, pattern, breed, features)
 * - Last-seen location coordinates
 * - Contact info (generic "Report sighting via MEOWTRIX")
 *
 * The PDF is uploaded to the Supabase Storage 'posters' bucket
 * and the URL is stored on the Overlord record.
 */
export async function generateMissingPoster(overlordId: string): Promise<void> {
  const supabase = getSupabaseClient();

  // Fetch Overlord details
  const { data: overlord, error: overlordError } = await supabase
    .from('overlords')
    .select(
      'id, pet_name, description, photos, trait_tags, last_seen_lat, last_seen_lng, last_seen_at'
    )
    .eq('id', overlordId)
    .single();

  if (overlordError || !overlord) {
    throw new Error(
      `Failed to fetch Overlord ${overlordId}: ${overlordError?.message ?? 'Not found'}`
    );
  }

  // Create A4 PDF document (595.28 x 841.89 points)
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 50, right: 50 },
  });

  // Collect PDF output into a buffer
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const pdfReady = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // --- PDF Content ---

  const pageWidth = 595.28 - 100; // minus margins

  // Header: MISSING PET
  doc
    .fontSize(36)
    .font('Helvetica-Bold')
    .fillColor('#FF4444')
    .text('MISSING PET', { align: 'center' });

  doc.moveDown(0.5);

  // Divider line
  doc
    .strokeColor('#FF4444')
    .lineWidth(2)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke();

  doc.moveDown(1);

  // Cat photo (if available)
  if (overlord.photos && overlord.photos.length > 0) {
    try {
      const imageBuffer = await fetchImageBuffer(overlord.photos[0]);
      const imageX = (pageWidth - 250) / 2 + 50; // center a 250pt wide image
      doc.image(imageBuffer, imageX, doc.y, {
        width: 250,
        height: 250,
        fit: [250, 250],
        align: 'center',
      });
      doc.moveDown(1);
      doc.y += 260; // Move past the image
    } catch (imageError) {
      // If image fetch fails, skip and continue with text-only poster
      console.warn(
        `[SearchProtocol] Failed to include image in poster: ${imageError}`
      );
      doc.moveDown(1);
    }
  }

  // Cat name
  doc
    .fontSize(28)
    .font('Helvetica-Bold')
    .fillColor('#000000')
    .text(overlord.pet_name, { align: 'center' });

  doc.moveDown(0.5);

  // Description
  if (overlord.description) {
    doc
      .fontSize(14)
      .font('Helvetica')
      .fillColor('#333333')
      .text(overlord.description, { align: 'center' });

    doc.moveDown(0.5);
  }

  // Trait tags
  const traits = overlord.trait_tags;
  if (traits) {
    doc.moveDown(0.5);
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Identifying Features:', { align: 'left' });

    doc.moveDown(0.3);
    doc.fontSize(12).font('Helvetica').fillColor('#333333');

    const traitLines: string[] = [];
    if (traits.primary_color) {
      traitLines.push(`Color: ${traits.primary_color}${traits.secondary_color ? ` / ${traits.secondary_color}` : ''}`);
    }
    if (traits.pattern_type) {
      traitLines.push(`Pattern: ${traits.pattern_type}`);
    }
    if (traits.fur_length) {
      traitLines.push(`Fur Length: ${traits.fur_length}`);
    }
    if (traits.breed_estimate) {
      traitLines.push(`Breed: ${traits.breed_estimate}`);
    }
    if (traits.distinguishing_features && traits.distinguishing_features.length > 0) {
      traitLines.push(`Features: ${traits.distinguishing_features.join(', ')}`);
    }

    for (const line of traitLines) {
      doc.text(`• ${line}`);
    }

    doc.moveDown(0.5);
  }

  // Last-seen location
  doc.moveDown(0.5);
  doc
    .fontSize(14)
    .font('Helvetica-Bold')
    .fillColor('#000000')
    .text('Last Seen:', { align: 'left' });

  doc
    .fontSize(12)
    .font('Helvetica')
    .fillColor('#333333')
    .text(
      `Location: ${overlord.last_seen_lat.toFixed(6)}, ${overlord.last_seen_lng.toFixed(6)}`
    );

  if (overlord.last_seen_at) {
    const lastSeenDate = new Date(overlord.last_seen_at);
    doc.text(`Date: ${lastSeenDate.toLocaleDateString()} ${lastSeenDate.toLocaleTimeString()}`);
  }

  // Footer: contact info
  doc.moveDown(2);
  doc
    .strokeColor('#FFCC00')
    .lineWidth(2)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke();

  doc.moveDown(0.5);
  doc
    .fontSize(14)
    .font('Helvetica-Bold')
    .fillColor('#000000')
    .text('If you spot this cat, please report the sighting on MEOWTRIX', {
      align: 'center',
    });

  doc.moveDown(0.3);
  doc
    .fontSize(11)
    .font('Helvetica')
    .fillColor('#666666')
    .text('Your help brings lost overlords home. 🐱', { align: 'center' });

  // Finalize the document
  doc.end();

  const pdfBuffer = await pdfReady;

  // Upload to Supabase Storage (posters bucket)
  const fileName = `poster_${overlordId}.pdf`;
  if (fileName.includes('..')) {
    throw new Error('Invalid file name');
  }
  const { error: uploadError } = await supabase.storage
    .from('posters')
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(
      `Failed to upload poster for Overlord ${overlordId}: ${uploadError.message}`
    );
  }

  // Get the public URL for the poster
  const { data: urlData } = supabase.storage
    .from('posters')
    .getPublicUrl(fileName);

  const posterUrl = urlData.publicUrl;

  // Update Overlord record with the poster URL
  const { error: updateError } = await supabase
    .from('overlords')
    .update({ poster_url: posterUrl })
    .eq('id', overlordId);

  if (updateError) {
    throw new Error(
      `Failed to update Overlord ${overlordId} with poster URL: ${updateError.message}`
    );
  }

  console.log(
    `[SearchProtocol] Generated and uploaded missing poster for Overlord ${overlordId}: ${posterUrl}`
  );
}
