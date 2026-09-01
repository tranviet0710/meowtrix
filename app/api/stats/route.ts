// app/api/stats/route.ts — GET dashboard statistics
// Requirements: 11.1, 11.6, 11.7

import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabaseServer";
import { sanitizeDatabaseError } from "@/lib/errorSanitizer";

// Ensure this route is always dynamic (never cached at build time)
export const dynamic = "force-dynamic";

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
      const sanitizedError = sanitizeDatabaseError(totalError, "fetch total overlords", "[Stats GET]");
      return NextResponse.json(
        { error: sanitizedError },
        { status: 500 }
      );
    }

    // Fetch active searches (overlords with status 'active')
    const { count: activeSearches, error: activeError } = await supabase
      .from("overlords")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    if (activeError) {
      const sanitizedError = sanitizeDatabaseError(activeError, "fetch active searches", "[Stats GET]");
      return NextResponse.json(
        { error: sanitizedError },
        { status: 500 }
      );
    }

    // Fetch informants online (active within last 5 minutes)
    // Note: User presence updates are handled by POST /api/presence to prevent CSRF
    const serviceClient = await createServiceRoleClient();
    // Use Supabase's server-side time calculation to avoid client/server clock skew
    const { data: rpcResult, error: onlineError } = await serviceClient
      .rpc("count_online_informants", { minutes_ago: 5 });

    // Fallback: if RPC doesn't exist, use client-side time calculation
    let onlineCount: number;
    if (onlineError || rpcResult === null || rpcResult === undefined) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count, error: fallbackError } = await serviceClient
        .from("informants")
        .select("*", { count: "exact", head: true })
        .gte("last_active_at", fiveMinutesAgo);

      onlineCount = (!fallbackError && count !== null) ? count : 1;
    } else {
      onlineCount = typeof rpcResult === "number" ? rpcResult : 1;
    }

    const stats: DashboardStats = {
      total_overlords: totalOverlords ?? 0,
      active_searches: activeSearches ?? 0,
      informants_online: onlineCount,
    };

    return NextResponse.json(stats, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch stats: ${message}` },
      { status: 500 }
    );
  }
}
