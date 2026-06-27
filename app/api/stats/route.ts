// app/api/stats/route.ts — GET dashboard statistics
// Requirements: 11.1, 11.6, 11.7

import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabaseServer";

export interface DashboardStats {
  total_overlords: number;
  active_searches: number;
  informants_online: number;
}

/**
 * GET /api/stats
 *
 * Returns dashboard statistics:
 * - total_overlords: Total Overlord records tracked
 * - active_searches: Overlords with status 'active' (not yet found)
 * - informants_online: Informants with activity in the last 5 minutes
 *   (approximated by counting informants with sessions — uses auth.users last_sign_in_at
 *   as a proxy since Supabase doesn't expose real-time session presence without Realtime Presence)
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Verify authentication
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

    // Fetch total overlords count
    const { count: totalOverlords, error: totalError } = await supabase
      .from("overlords")
      .select("*", { count: "exact", head: true });

    if (totalError) {
      return NextResponse.json(
        { error: `Failed to fetch total overlords: ${totalError.message}` },
        { status: 500 }
      );
    }

    // Fetch active searches (overlords with status 'active')
    const { count: activeSearches, error: activeError } = await supabase
      .from("overlords")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    if (activeError) {
      return NextResponse.json(
        { error: `Failed to fetch active searches: ${activeError.message}` },
        { status: 500 }
      );
    }

    // Update the current user's last_active_at timestamp (ignore if column doesn't exist yet)
    const serviceClient = await createServiceRoleClient();
    try {
      await serviceClient
        .from("informants")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", user.id);
    } catch {
      // Column might not exist yet if migration hasn't been applied
    }

    // Fetch informants online (active session within last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    let onlineCount = 0;

    const { count: informantsOnline, error: onlineError } = await serviceClient
      .from("informants")
      .select("*", { count: "exact", head: true })
      .gte("last_active_at", fiveMinutesAgo);

    if (!onlineError && informantsOnline !== null) {
      onlineCount = informantsOnline;
    } else {
      // Fallback: count all informants if column doesn't exist
      const { count: totalInformants } = await serviceClient
        .from("informants")
        .select("*", { count: "exact", head: true });
      onlineCount = totalInformants ?? 0;
    }

    const stats: DashboardStats = {
      total_overlords: totalOverlords ?? 0,
      active_searches: activeSearches ?? 0,
      informants_online: onlineCount,
    };

    return NextResponse.json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch stats: ${message}` },
      { status: 500 }
    );
  }
}
