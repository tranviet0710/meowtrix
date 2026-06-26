// app/api/settings/route.ts — GET/PATCH user settings (location consent, etc.)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { settingsSchema } from "@/lib/validators";

/**
 * GET /api/settings
 *
 * Returns the authenticated Informant's current settings including
 * location consent status and coordinates.
 *
 * Requirements: 1.11, 1.12
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: informant, error: fetchError } = await supabase
      .from("informants")
      .select("location_consent, residential_lat, residential_lng, display_name, email")
      .eq("id", user.id)
      .single();

    if (fetchError || !informant) {
      return NextResponse.json(
        { error: "Failed to fetch settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      location_consent: informant.location_consent ?? false,
      residential_lat: informant.residential_lat ?? null,
      residential_lng: informant.residential_lng ?? null,
      display_name: informant.display_name ?? "",
      email: informant.email ?? "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch settings: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings
 *
 * Updates the authenticated Informant's settings. Supports toggling
 * location consent and updating residential coordinates.
 *
 * Validation rules:
 * - If location_consent = true, residential_lat and residential_lng must be
 *   provided and valid (lat: -90 to 90, lng: -180 to 180).
 * - If location_consent = false, coordinates are cleared to null regardless
 *   of any values provided.
 *
 * Requirements: 1.2, 1.11, 1.12
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate input using settingsSchema
    const parsed = settingsSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { location_consent, residential_lat, residential_lng } = parsed.data;

    // Validate coordinate ranges when consent is enabled
    if (location_consent) {
      if (
        residential_lat == null ||
        residential_lng == null ||
        residential_lat < -90 ||
        residential_lat > 90 ||
        residential_lng < -180 ||
        residential_lng > 180
      ) {
        return NextResponse.json(
          { error: "Invalid coordinates. Latitude must be -90 to 90, longitude -180 to 180." },
          { status: 400 }
        );
      }
    }

    // Build update payload
    const updatePayload = location_consent
      ? {
          location_consent: true,
          residential_lat,
          residential_lng,
        }
      : {
          location_consent: false,
          residential_lat: null,
          residential_lng: null,
        };

    const { error: updateError } = await supabase
      .from("informants")
      .update(updatePayload)
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update settings: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      location_consent: updatePayload.location_consent,
      residential_lat: updatePayload.residential_lat,
      residential_lng: updatePayload.residential_lng,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to update settings: ${message}` },
      { status: 500 }
    );
  }
}
