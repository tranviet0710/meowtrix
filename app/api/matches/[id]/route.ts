// app/api/matches/[id]/route.ts — GET match suggestion detail

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { sanitizeDatabaseError } from "@/lib/errorSanitizer";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/matches/[id]
 *
 * Returns detailed match suggestion with full overlord and agent data,
 * including score breakdown (visual, description, proximity, other).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    // Fetch the match suggestion with full overlord and agent details
    const { data: match, error: matchError } = await supabase
      .from("match_suggestions")
      .select(`
        *,
        overlords:overlord_id (
          id,
          owner_id,
          pet_name,
          pet_type,
          description,
          last_seen_lat,
          last_seen_lng,
          last_seen_at,
          status,
          photos,
          trait_tags,
          tagging_status,
          poster_url,
          created_at
        ),
        agents:agent_id (
          id,
          reporter_id,
          description,
          sighting_lat,
          sighting_lng,
          sighted_at,
          status,
          photos,
          trait_tags,
          tagging_status,
          created_at
        )
      `)
      .eq("id", id)
      .single();

    if (matchError) {
      if (matchError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Match suggestion not found" },
          { status: 404 }
        );
      }
      const sanitizedError = sanitizeDatabaseError(matchError, "fetch match", "[Match GET]");
      return NextResponse.json(
        { error: sanitizedError },
        { status: 500 }
      );
    }

    if (!match) {
      return NextResponse.json(
        { error: "Match suggestion not found" },
        { status: 404 }
      );
    }

    // Verify the user is either the overlord owner or the agent reporter
    const overlord = match.overlords as { owner_id: string } | null;
    const agent = match.agents as { reporter_id: string } | null;

    if (overlord?.owner_id !== user.id && agent?.reporter_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You are not involved in this match" },
        { status: 403 }
      );
    }

    // Return the match with score breakdown
    return NextResponse.json({
      match: {
        id: match.id,
        overlord_id: match.overlord_id,
        agent_id: match.agent_id,
        overall_score: match.overall_score,
        score_breakdown: {
          visual: match.visual_score,
          description: match.description_score,
          proximity: match.proximity_score,
          other: match.other_score,
        },
        matched_traits: match.matched_traits,
        status: match.status,
        created_at: match.created_at,
        overlord: match.overlords,
        agent: match.agents,
      },
    });
  } catch (error) {
    // Log the actual error server-side for debugging
    console.error("Match detail fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch match detail" },
      { status: 500 }
    );
  }
}
