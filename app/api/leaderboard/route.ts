// app/api/leaderboard/route.ts — GET paginated leaderboard

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabaseServer";

const PAGE_SIZE = 50;

/**
 * Mask the local-part of an email so we don't leak full addresses on a public
 * leaderboard. Examples:
 *   "alice@example.com"  -> "a***e@example.com"
 *   "b@x.io"             -> "b***@x.io"
 */
function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const atIdx = email.indexOf("@");
  if (atIdx <= 0) return null;
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx);
  if (local.length <= 2) return `${local[0]}***${domain}`;
  return `${local[0]}***${local[local.length - 1]}${domain}`;
}

/**
 * GET /api/leaderboard
 *
 * Returns a paginated leaderboard of Informants sorted by total_points
 * descending, ties broken by earliest first_match_at.
 *
 * Public-safe fields returned per entry: display_name, total_points,
 * successful_matches, residential_area (when shared), masked email.
 *
 * Note: the `informants` table has an RLS policy that limits SELECT to the
 * authenticated user's own row. To render a leaderboard of *other* informants
 * we read via the service-role client and explicitly project only the
 * leaderboard-safe columns.
 *
 * Query parameters:
 *   - page (optional): Page number, 1-indexed. Defaults to 1.
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate the caller against the user-scoped client (RLS-aware).
    const userClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Pagination
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get("page");
    const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    // Service-role read bypasses the per-user SELECT policy so every authed
    // user can see the public leaderboard. We deliberately project only
    // leaderboard-safe columns — never anything sensitive.
    const adminClient = await createServiceRoleClient();

    const { count: totalCount, error: countError } = await adminClient
      .from("informants")
      .select("*", { count: "exact", head: true })
      .gt("total_points", 0);

    if (countError) {
      return NextResponse.json(
        { error: `Failed to fetch leaderboard count: ${countError.message}` },
        { status: 500 }
      );
    }

    const { data: entries, error: fetchError } = await adminClient
      .from("informants")
      .select(
        "id, display_name, email, residential_area, location_consent, total_points, successful_matches, first_match_at"
      )
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

    const leaderboard = (entries ?? []).map((entry, index) => ({
      rank: offset + index + 1,
      informant_id: entry.id,
      display_name: entry.display_name,
      total_points: entry.total_points,
      successful_matches: entry.successful_matches,
      first_match_at: entry.first_match_at,
      // Only expose residential_area when the informant has opted in.
      // Falls back to null so the UI can render "Undisclosed".
      residential_area:
        entry.location_consent && entry.residential_area
          ? entry.residential_area
          : null,
      email_masked: maskEmail(entry.email),
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
