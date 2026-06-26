// app/api/leaderboard/route.ts — GET paginated leaderboard

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";

const PAGE_SIZE = 50;

/**
 * GET /api/leaderboard
 *
 * Returns a paginated leaderboard of Informants sorted by total_points descending,
 * with ties broken by earliest first_match_at (earliest match ranks higher).
 *
 * Query parameters:
 *   - page (optional): Page number, 1-indexed. Defaults to 1.
 *
 * Only Informants with at least 1 point are included.
 *
 * Supports Realtime subscription on the client side for live updates
 * (Supabase Realtime handles push within 5 seconds).
 *
 * Requirements: 10.1, 10.2, 10.5
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify the user is authenticated
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

    // Parse pagination parameter
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get("page");
    const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    // Fetch total count of informants with at least 1 point
    const { count: totalCount, error: countError } = await supabase
      .from("informants")
      .select("*", { count: "exact", head: true })
      .gt("total_points", 0);

    if (countError) {
      return NextResponse.json(
        { error: `Failed to fetch leaderboard count: ${countError.message}` },
        { status: 500 }
      );
    }

    // Fetch leaderboard entries:
    // Sort by total_points DESC, then by first_match_at ASC (earliest first),
    // with nulls last for first_match_at
    const { data: entries, error: fetchError } = await supabase
      .from("informants")
      .select("id, display_name, total_points, successful_matches, first_match_at")
      .gt("total_points", 0)
      .order("total_points", { ascending: false })
      .order("first_match_at", { ascending: true, nullsFirst: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (fetchError) {
      return NextResponse.json(
        { error: `Failed to fetch leaderboard: ${fetchError.message}` },
        { status: 500 }
      );
    }

    // Build leaderboard response with rank positions
    const leaderboard = (entries || []).map((entry, index) => ({
      rank: offset + index + 1,
      informant_id: entry.id,
      display_name: entry.display_name,
      total_points: entry.total_points,
      successful_matches: entry.successful_matches,
      first_match_at: entry.first_match_at,
    }));

    const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);

    return NextResponse.json({
      leaderboard,
      pagination: {
        page,
        page_size: PAGE_SIZE,
        total_entries: totalCount || 0,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_previous: page > 1,
      },
      current_user_id: user.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch leaderboard: ${message}` },
      { status: 500 }
    );
  }
}
