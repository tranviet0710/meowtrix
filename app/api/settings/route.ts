// app/api/settings/route.ts — GET/PATCH user settings (location consent, etc.)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { settingsSchema } from "@/lib/validators";
import { reverseGeocode } from "@/lib/geocoding";

/**
 * GET /api/settings
 *
 * Returns the authenticated Informant's current settings including
 * location consent status, coordinates, and human-readable residential area.
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
      .select(
        "location_consent, residential_lat, residential_lng, residential_area, display_name, email"
      )
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
      residential_area: informant.residential_area ?? "",
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
 * Updates the authenticated Informant's settings. Supports toggling location
 * consent and updating residential coordinates. When the caller doesn't
 * supply a `residential_area` label, we reverse-geocode the coordinates so
 * the profile and leaderboard show a place name instead of raw lat/lng.
 *
 * Validation rules:
 * - If location_consent = true, residential_lat and residential_lng must be
 *   provided and valid (lat: -90 to 90, lng: -180 to 180).
 * - If location_consent = false, coordinates and area are cleared.
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

    const {
      location_consent,
      residential_lat,
      residential_lng,
      residential_area: providedArea,
    } = parsed.data;

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

    // Resolve the human-readable area label.
    //   - Consent ON:  use what the client passed; otherwise reverse-geocode.
    //   - Consent OFF: always clear to empty string (DB column is NOT NULL).
    let residentialArea: string;
    if (!location_consent) {
      residentialArea = "";
    } else if (providedArea && providedArea.trim().length > 0) {
      residentialArea = providedArea.trim();
    } else {
      const label = await reverseGeocode(residential_lat!, residential_lng!);
      residentialArea = label ?? "";
    }

    const updatePayload = location_consent
      ? {
          location_consent: true,
          residential_lat,
          residential_lng,
          residential_area: residentialArea,
        }
      : {
          location_consent: false,
          residential_lat: null,
          residential_lng: null,
          residential_area: "",
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
      residential_area: updatePayload.residential_area,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to update settings: ${message}` },
      { status: 500 }
    );
  }
}
