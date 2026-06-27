// app/api/upload/route.ts — Image upload + optimization API route
//
// Flow:
// 1. Accept multipart form data with a single file field
// 2. Validate file format (JPEG/PNG/WebP) and size (≤5MB)
// 3. Authenticate user via Supabase session
// 4. Optimize image via imageOptimizer
// 5. Upload optimized buffer to Supabase Storage (cat-photos bucket)
// 6. Return public URL with dimensions

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabaseServer';
import { optimizeImage } from '@/lib/imageOptimizer';
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '@/lib/validators';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // 2. Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // 3. Validate file format
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid file format. Only JPEG, PNG, and WebP images are accepted',
        },
        { status: 400 }
      );
    }

    // 4. Validate file size (≤5MB)
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'File size must be 5MB or less' },
        { status: 400 }
      );
    }

    // 5. Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 6. Optimize image
    const optimized = await optimizeImage(buffer, file.type);

    // 7. Determine file extension based on optimization result
    const ext = optimized.format === 'webp' ? 'webp' : getExtensionFromMime(file.type);

    // 8. Generate unique storage path: {user_id}/{uuid}.{ext}
    const fileId = crypto.randomUUID();
    const storagePath = `${user.id}/${fileId}.${ext}`;

    // 9. Upload to Supabase Storage using service role client
    const serviceClient = await createServiceRoleClient();
    const { error: uploadError } = await serviceClient.storage
      .from('cat-photos')
      .upload(storagePath, optimized.buffer, {
        contentType: `image/${optimized.format}`,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { success: false, error: 'Failed to upload image to storage' },
        { status: 500 }
      );
    }

    // 10. Get a signed URL (bucket is private, so public URLs won't work)
    // Use a long-lived signed URL (1 year) since these are stored in the DB
    const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
      .from('cat-photos')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year

    if (signedUrlError || !signedUrlData?.signedUrl) {
      // Fallback: construct the public URL (may work if bucket is later made public)
      const { data: urlData } = serviceClient.storage
        .from('cat-photos')
        .getPublicUrl(storagePath);

      return NextResponse.json({
        success: true,
        url: urlData.publicUrl,
        width: optimized.width,
        height: optimized.height,
      });
    }

    return NextResponse.json({
      success: true,
      url: signedUrlData.signedUrl,
      width: optimized.width,
      height: optimized.height,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/** Map MIME type to file extension for fallback cases */
function getExtensionFromMime(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
}
