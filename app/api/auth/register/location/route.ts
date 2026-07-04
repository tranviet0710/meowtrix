import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabaseServer';
import { z } from 'zod';

/**
 * Schema for the location consent step.
 * If location_consent is true, lat/lng must be provided.
 * residential_area is optional text for display purposes.
 */
const locationConsentSchema = z
  .object({
    location_consent: z.boolean(),
    residential_lat: z.number().nullable().optional(),
    residential_lng: z.number().nullable().optional(),
    residential_area: z.string().max(200).optional().default(''),
  })
  .refine(
    (data) => {
      if (data.location_consent) {
        return data.residential_lat != null && data.residential_lng != null;
      }
      return true;
    },
    {
      message: 'Location coordinates are required when consent is enabled',
      path: ['residential_lat'],
    }
  );

/**
 * POST /api/auth/register/location
 *
 * Handles the location consent step of registration.
 * The user must be authenticated (just completed sign-up).
 * Accepts the user's location consent choice and optional coordinates
 * from the map picker.
 *
 * Request body:
 *   { location_consent: boolean, residential_lat?: number, residential_lng?: number, residential_area?: string }
 *
 * Response:
 *   { success: true } or { success: false, error: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate input
    const parsed = locationConsentSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? 'Invalid input';
      console.error('[Register/Location] Validation failed:', JSON.stringify(parsed.error.issues, null, 2));
      return NextResponse.json(
        { success: false, error: firstError },
        { status: 400 }
      );
    }

    const { location_consent, residential_lat, residential_lng, residential_area } =
      parsed.data;

    // Use service role client to update the informant row (bypasses RLS)
    const serviceClient = await createServiceRoleClient();

    const updateData = location_consent
      ? {
          location_consent: true,
          residential_lat: residential_lat!,
          residential_lng: residential_lng!,
          residential_area: residential_area || '',
        }
      : {
          location_consent: false,
          residential_lat: null,
          residential_lng: null,
          residential_area: residential_area || '',
        };

    const { error: updateError } = await serviceClient
      .from('informants')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update location consent:', updateError.message);
      return NextResponse.json(
        { success: false, error: 'Failed to save location preference' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Location consent error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
