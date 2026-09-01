// app/api/notifications/route.ts — GET notifications for user, PATCH mark as read
// Requirements: 7.2, 7.4, 7.9, 8.4, 9.3, 9.4, 9.9

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { sanitizeDatabaseError } from "@/lib/errorSanitizer";
import { z } from "zod";

/** Schema for PATCH request body — mark notifications as read */
const markReadSchema = z.object({
  ids: z
    .array(z.string().uuid("Each notification ID must be a valid UUID"))
    .min(1, "At least one notification ID is required")
    .max(100, "Cannot mark more than 100 notifications at once"),
});

/**
 * GET /api/notifications
 *
 * Returns notifications for the authenticated user, ordered by created_at descending.
 * Supports query params:
 * - unread_only=true — filter to only unread notifications
 * - page — page number (1-indexed, default 1)
 * - limit — items per page (default 20, max 100)
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread_only") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20)
    );

    const offset = (page - 1) * limit;

    // Build query — apply all filters before ordering and pagination
    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("recipient_id", user.id);

    if (unreadOnly) {
      query = query.eq("read", false);
    }

    const { data: notifications, error: fetchError, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (fetchError) {
      const sanitizedError = sanitizeDatabaseError(fetchError, "fetch notifications", "[Notifications GET]");
      return NextResponse.json(
        { error: sanitizedError },
        { status: 500 }
      );
    }

    // Also get unread count for convenience
    const { count: unreadCount, error: unreadError } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("read", false);

    if (unreadError) {
      const sanitizedError = sanitizeDatabaseError(unreadError, "fetch unread count", "[Notifications GET]");
      return NextResponse.json(
        { error: sanitizedError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      notifications: notifications ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        total_pages: Math.ceil((count ?? 0) / limit),
      },
      unread_count: unreadCount ?? 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch notifications: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 *
 * Marks the specified notifications as read.
 * Body: { ids: string[] }
 * Only marks notifications belonging to the authenticated user.
 */
export async function PATCH(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json();
    const parseResult = markReadSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { ids } = parseResult.data;

    // Update notifications — only mark those belonging to the user (RLS enforces this too)
    const { data: updated, error: updateError } = await supabase
      .from("notifications")
      .update({ read: true })
      .in("id", ids)
      .eq("recipient_id", user.id)
      .select("id");

    if (updateError) {
      const sanitizedError = sanitizeDatabaseError(updateError, "mark notifications as read", "[Notifications PATCH]");
      return NextResponse.json(
        { error: sanitizedError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      updated: (updated ?? []).map((n) => n.id),
      count: (updated ?? []).length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to mark notifications as read: ${message}` },
      { status: 500 }
    );
  }
}
