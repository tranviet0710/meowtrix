// app/api/matches/route.ts — GET list match suggestions for the authenticated user

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";

/**
 * GET /api/matches
 *
 * Returns all match suggestions where the authenticated user is either
 * the Overlord owner or the Agent reporter.
 * Includes associated overlord and agent basic info.
 * Sorted by overall_score descending.
 */
export async function GET() {
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

    // Fetch match suggestions where user owns the overlord or reported the agent
    // We need to join overlords and agents to filter by owner/reporter
    const { data: matches, error: matchError } = await supabase
      .from("match_suggestions")
      .select(`
        *,
        overlords:overlord_id (
          id,
          cat_name,
          photos,
          last_seen_lat,
          last_seen_lng,
          last_seen_at,
          status,
          owner_id
        ),
        agents:agent_id (
          id,
          photos,
          description,
          sighting_lat,
          sighting_lng,
          sighted_at,
          status,
          reporter_id
        )
      `)
      .order("overall_score", { ascending: false });

    if (matchError) {
      return NextResponse.json(
        { error: `Failed to fetch matches: ${matchError.message}` },
        { status: 500 }
      );
    }

    // Filter to only include matches where user is the overlord owner or agent reporter
    const userMatches = (matches || []).filter((match) => {
      const overlord = match.overlords as { owner_id: string } | null;
      const agent = match.agents as { reporter_id: string } | null;
      return overlord?.owner_id === user.id || agent?.reporter_id === user.id;
    });

    return NextResponse.json({ matches: userMatches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch matches: ${message}` },
      { status: 500 }
    );
  }
}
