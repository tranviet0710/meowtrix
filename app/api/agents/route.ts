// app/api/agents/route.ts — POST create Agent, GET list Agents

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabaseServer";
import { agentFormSchema } from "@/lib/validators";
import { extractTraitsFromImage } from "@/lib/gemini";
import { triggerMatchEvaluation } from "@/lib/matchTrigger";
import { reverseGeocode } from "@/lib/geocoding";
import { sanitizeDatabaseError } from "@/lib/errorSanitizer";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * POST /api/agents
 *
 * Creates a new Agent (spotted pet) record.
 * - Validates input with agentFormSchema
 * - Sets reporter_id from authenticated user
 * - Triggers Vision Service directly (not via HTTP)
 * - Match Engine is triggered after tagging completes
 * - Sends notifications to nearby overlord owners
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
      console.error('[Agent POST] Validation failed:', JSON.stringify(parsed.error.flatten(), null, 2));
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { pet_type, description, sighting_lat, sighting_lng } = parsed.data;

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

    // Use user-provided sighting time or fallback to current timestamp
    const sighted_at = body.sighted_at
      ? new Date(body.sighted_at).toISOString()
      : new Date().toISOString();

    // Create the Agent record using the service role client
    const serviceClient = await createServiceRoleClient();

    // Reverse-geocode sighting coordinates into a human-readable label
    // (best-effort — falls back to null if the geocoder is unreachable).
    const sighting_address = await reverseGeocode(sighting_lat, sighting_lng);

    const { data: agent, error: insertError } = await serviceClient
      .from("agents")
      .insert({
        reporter_id: user.id,
        pet_type,
        description,
        sighting_lat,
        sighting_lng,
        sighting_address,
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
      const sanitizedError = sanitizeDatabaseError(insertError, "create Agent", "[Agent POST]");
      return NextResponse.json(
        { error: sanitizedError },
        { status: 500 }
      );
    }

    // Notify nearby overlord owners that a pet was spotted in their area
    try {
      await notifyNearbyOverlordOwners(serviceClient, agent.id, pet_type, sighting_lat, sighting_lng, photos[0] ?? null);
    } catch (notifyError) {
      // Non-blocking — notification failure doesn't affect agent creation
      const errMsg = notifyError instanceof Error ? notifyError.message : String(notifyError);
      const errStack = notifyError instanceof Error ? notifyError.stack : undefined;
      console.error(`[Agent POST] Notification failed for agent ${agent.id}: ${errMsg}`, errStack);
    }

    // Process vision + matching directly (no HTTP call to self)
    // Run in background-like manner but awaited to ensure it completes
    try {
      for (const photoUrl of photos) {
        const traitTags = await extractTraitsFromImage(photoUrl);

        if (traitTags) {
          const { error: updateError } = await serviceClient
            .from("agents")
            .update({ trait_tags: traitTags, tagging_status: "complete" })
            .eq("id", agent.id);

          if (updateError) {
            console.error(`[Agent POST] Failed to update trait_tags for agent ${agent.id}: ${updateError.message}`, updateError);
          }

          // Trigger match evaluation
          await triggerMatchEvaluation(serviceClient, agent.id, "agent");
          break; // One successful tag is enough to trigger matching
        } else {
          console.warn(`[Agent POST] extractTraitsFromImage returned null for agent ${agent.id}, photo: ${photoUrl}`);
        }
      }
    } catch (visionError) {
      // Vision/matching failures are non-blocking — agent record is still created
      const errMsg = visionError instanceof Error ? visionError.message : String(visionError);
      const errStack = visionError instanceof Error ? visionError.stack : undefined;
      console.error(`[Agent POST] Vision/matching failed for agent ${agent.id}: ${errMsg}`, errStack);
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
 * Notify owners of active overlords near the sighting location.
 * Sends a notification to anyone who has a lost pet within ~5km of the spotted agent.
 */
async function notifyNearbyOverlordOwners(
  supabase: SupabaseClient,
  agentId: string,
  petType: string,
  sightingLat: number,
  sightingLng: number,
  photoUrl: string | null
) {
  // Rough bounding box: ~5km radius (0.045 degrees ≈ 5km)
  const RADIUS_DEG = 0.045;

  const { data: nearbyOverlords } = await supabase
    .from("overlords")
    .select("id, owner_id, pet_name, pet_type")
    .eq("status", "active")
    .eq("pet_type", petType)
    .gte("last_seen_lat", sightingLat - RADIUS_DEG)
    .lte("last_seen_lat", sightingLat + RADIUS_DEG)
    .gte("last_seen_lng", sightingLng - RADIUS_DEG)
    .lte("last_seen_lng", sightingLng + RADIUS_DEG);

  if (!nearbyOverlords || nearbyOverlords.length === 0) return;

  // Send notification to each overlord owner
  const notifications = nearbyOverlords.map((overlord) => ({
    recipient_id: overlord.owner_id,
    type: "nearby_sighting",
    title: "Nearby Sighting Reported!",
    body: `A ${petType} was spotted near where "${overlord.pet_name}" was last seen. Check it out!`,
    metadata: {
      agent_id: agentId,
      overlord_id: overlord.id,
      photo_thumbnail: photoUrl,
    },
    read: false,
  }));

  await supabase.from("notifications").insert(notifications);
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
    const mine = searchParams.get("mine");
    const petType = searchParams.get("pet_type");
    const since = searchParams.get("since"); // ISO datetime — sighted_at >= since

    let query = supabase
      .from("agents")
      .select("*")
      .order("created_at", { ascending: false });

    if (status && (status === "active" || status === "resolved")) {
      query = query.eq("status", status);
    }

    if (petType === "cat" || petType === "dog") {
      query = query.eq("pet_type", petType);
    }

    if (since) {
      const sinceDate = new Date(since);
      if (!Number.isNaN(sinceDate.getTime())) {
        query = query.gte("sighted_at", sinceDate.toISOString());
      }
    }

    if (mine === "true") {
      query = query.eq("reporter_id", user.id);
    } else if (reporterId) {
      query = query.eq("reporter_id", reporterId);
    }

    const { data: agents, error: fetchError } = await query;

    if (fetchError) {
      const sanitizedError = sanitizeDatabaseError(fetchError, "fetch Agents", "[Agent GET]");
      return NextResponse.json(
        { error: sanitizedError },
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
