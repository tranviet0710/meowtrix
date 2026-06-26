// app/api/agents/route.ts — POST create Agent, GET list Agents

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabaseServer";
import { agentFormSchema } from "@/lib/validators";

/**
 * POST /api/agents
 *
 * Creates a new Agent (spotted cat) record.
 * - Validates input with agentFormSchema
 * - Sets reporter_id from authenticated user
 * - Sets sighted_at to the system-generated timestamp (moment of submission)
 * - Triggers Vision Service for uploaded photos (fire-and-forget)
 * - Match Engine is triggered from the vision route after tagging completes
 * - Returns created Agent
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate with Zod schema
    const parsed = agentFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { description, sighting_lat, sighting_lng } = parsed.data;

    // Photos array should be passed separately (already uploaded via /api/upload)
    const photos: string[] = body.photos ?? [];
    if (!Array.isArray(photos) || photos.length < 1) {
      return NextResponse.json(
        { error: "At least 1 photo URL is required" },
        { status: 400 }
      );
    }
    if (photos.length > 5) {
      return NextResponse.json(
        { error: "Maximum 5 photos allowed" },
        { status: 400 }
      );
    }

    // System-generated sighting timestamp (moment of submission)
    const sighted_at = new Date().toISOString();

    // Create the Agent record using the service role client
    const serviceClient = await createServiceRoleClient();

    const { data: agent, error: insertError } = await serviceClient
      .from("agents")
      .insert({
        reporter_id: user.id,
        description,
        sighting_lat,
        sighting_lng,
        sighted_at,
        status: "active",
        photos,
        trait_tags: null,
        tagging_status: "pending",
        is_seed: false,
      })
      .select()
      .single();

    if (insertError || !agent) {
      return NextResponse.json(
        { error: `Failed to create Agent: ${insertError?.message ?? "Unknown error"}` },
        { status: 500 }
      );
    }

    // Fire-and-forget: Trigger Vision Service for each photo
    // Match Engine will be triggered from the vision route after tagging completes
    const baseUrl = request.nextUrl.origin;
    for (const photoUrl of photos) {
      fetch(`${baseUrl}/api/vision/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record_id: agent.id,
          record_type: "agent",
          photo_url: photoUrl,
        }),
      }).catch(() => {
        // Fire-and-forget — vision failures are non-blocking
      });
    }

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create Agent: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents
 *
 * Lists Agent records with optional filters:
 * - status: 'active' | 'resolved'
 * - reporter_id: filter by specific reporter
 *
 * Sorted by created_at descending.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const reporterId = searchParams.get("reporter_id");

    let query = supabase
      .from("agents")
      .select("*")
      .order("created_at", { ascending: false });

    if (status && (status === "active" || status === "resolved")) {
      query = query.eq("status", status);
    }

    if (reporterId) {
      query = query.eq("reporter_id", reporterId);
    }

    const { data: agents, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json(
        { error: `Failed to fetch Agents: ${fetchError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ agents: agents ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch Agents: ${message}` },
      { status: 500 }
    );
  }
}
