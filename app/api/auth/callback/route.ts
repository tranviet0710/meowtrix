import { createClient, createServiceRoleClient } from "@/lib/supabaseServer";
import { getSafeRedirectPath } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = getSafeRedirectPath(url.searchParams.get("next"));
  const origin = url.origin;

  if (!code) {
    const errorUrl = new URL("/login", origin);
    errorUrl.searchParams.set("error", "Missing authorization code");
    return NextResponse.redirect(errorUrl);
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      const errorUrl = new URL("/login", origin);
      errorUrl.searchParams.set("error", "Authentication failed");
      return NextResponse.redirect(errorUrl);
    }

    // Create or update informant row for OAuth users
    const serviceClient = await createServiceRoleClient();
    const { data: existingInformant } = await serviceClient
      .from("informants")
      .select("id")
      .eq("id", data.user.id)
      .single();

    if (!existingInformant) {
      // New OAuth user — create informant row with defaults
      const displayName =
        data.user.user_metadata?.full_name ||
        data.user.user_metadata?.name ||
        data.user.email?.split("@")[0] ||
        "Informant";

      await serviceClient.from("informants").insert({
        id: data.user.id,
        email: data.user.email,
        display_name: displayName,
        residential_area: "",
        residential_lat: null,
        residential_lng: null,
        location_consent: false,
        total_points: 0,
        successful_matches: 0,
        is_seed: false,
      });
    }

    // Redirect to the intended destination or dashboard
    const redirectUrl = new URL(next, origin);
    return NextResponse.redirect(redirectUrl);
  } catch {
    const errorUrl = new URL("/login", origin);
    errorUrl.searchParams.set("error", "An unexpected error occurred");
    return NextResponse.redirect(errorUrl);
  }
}
