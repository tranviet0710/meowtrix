// app/api/overlords/route.ts — POST create Overlord, GET list Overlords

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabaseServer";
import { overlordFormSchema } from "@/lib/validators";
import { extractTraitsFromImage } from "@/lib/gemini";
import { triggerMatchEvaluation } from "@/lib/matchTrigger";
import { reverseGeocode } from "@/lib/geocoding";
import { sanitizeDatabaseError } from "@/lib/errorSanitizer";
import { Connection, Client } from "@temporalio/client";
import {
  getClientConnectionOptions,
  getTemporalNamespace,
  getTemporalTaskQueue,
  isTemporalConfigured,
} from "@/lib/temporalClient";

const TASK_QUEUE = getTemporalTaskQueue();

/**
 * Read an optional `SearchProtocolConfig` from environment variables so
 * operators can retune the tier timeline without redeploying the worker.
 *
 * Recognised env vars (all in milliseconds, integer):
 *   SEARCH_PROTOCOL_STAGE1_DELAY_MS
 *   SEARCH_PROTOCOL_STAGE2_DELAY_MS
 *   SEARCH_PROTOCOL_STAGE3_DELAY_MS
 *   SEARCH_PROTOCOL_STAGE4_DELAY_MS
 *   SEARCH_PROTOCOL_STAGE1_RADIUS_M
 *   SEARCH_PROTOCOL_STAGE3_RADIUS_M
 *
 * Returns `undefined` when no overrides are set, so the workflow falls back
 * to its own defaults (1h / 6h / 48h / 14d, 1km / 5km).
 */
function readSearchProtocolConfigFromEnv():
  | Record<string, number>
  | undefined {
  const keys: Array<[string, string]> = [
    ["SEARCH_PROTOCOL_STAGE1_DELAY_MS", "stage1DelayMs"],
    ["SEARCH_PROTOCOL_STAGE2_DELAY_MS", "stage2DelayMs"],
    ["SEARCH_PROTOCOL_STAGE3_DELAY_MS", "stage3DelayMs"],
    ["SEARCH_PROTOCOL_STAGE4_DELAY_MS", "stage4DelayMs"],
    ["SEARCH_PROTOCOL_STAGE1_RADIUS_M", "stage1RadiusMeters"],
    ["SEARCH_PROTOCOL_STAGE3_RADIUS_M", "stage3RadiusMeters"],
  ];

  const cfg: Record<string, number> = {};
  for (const [envKey, cfgKey] of keys) {
    const raw = process.env[envKey];
    if (!raw) continue;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      cfg[cfgKey] = parsed;
    }
  }

  return Object.keys(cfg).length > 0 ? cfg : undefined;
}

/** Fields that must never be returned to non-owners */
const VERIFICATION_FIELDS = [
  "verification_name",
  "verification_marking",
  "verification_trait",
] as const;

/**
 * POST /api/overlords
 *
 * Creates a new Overlord record.
 * - Validates input with overlordFormSchema
 * - Sets owner_id from authenticated user
 * - Triggers Vision Service for uploaded photos (fire-and-forget)
 * - Triggers Search Protocol (Temporal workflow)
 * - Returns created Overlord (excluding verification fields)
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
    const parsed = overlordFormSchema.safeParse(body);
    if (!parsed.success) {
      console.error('[Overlord POST] Validation failed:', JSON.stringify(parsed.error.flatten(), null, 2));
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      pet_name,
      pet_type,
      description,
      last_seen_lat,
      last_seen_lng,
      last_seen_at,
      verification_name,
      verification_marking,
      verification_trait,
    } = parsed.data;

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

    // Create the Overlord record using the service role client to bypass
    // potential RLS issues with returning the full record
    const serviceClient = await createServiceRoleClient();

    // Reverse-geocode last-seen coordinates into a human-readable label
    // (best-effort — fall back to null if the geocoder is unreachable).
    const last_seen_address = await reverseGeocode(last_seen_lat, last_seen_lng);

    const { data: overlord, error: insertError } = await serviceClient
      .from("overlords")
      .insert({
        owner_id: user.id,
        pet_name,
        pet_type,
        description,
        last_seen_lat,
        last_seen_lng,
        last_seen_address,
        last_seen_at,
        status: "active",
        photos,
        trait_tags: null,
        tagging_status: "pending",
        verification_name,
        verification_marking,
        verification_trait,
        poster_url: null,
        temporal_workflow_id: null,
        is_seed: false,
      })
      .select()
      .single();

    if (insertError || !overlord) {
      const sanitizedError = sanitizeDatabaseError(insertError, "create Overlord", "[Overlord POST]");
      return NextResponse.json(
        { error: sanitizedError },
        { status: 500 }
      );
    }

    // Trigger Vision Service directly for each photo
    for (const photoUrl of photos) {
      try {
        const traitTags = await extractTraitsFromImage(photoUrl);
        if (traitTags) {
          const { error: updateError } = await serviceClient
            .from("overlords")
            .update({ trait_tags: traitTags, tagging_status: "complete" })
            .eq("id", overlord.id);

          if (updateError) {
            console.error(`[Overlord POST] Failed to update trait_tags for overlord ${overlord.id}: ${updateError.message}`, updateError);
          }

          // Trigger match evaluation
          await triggerMatchEvaluation(serviceClient, overlord.id, "overlord");
          break; // One successful tag is enough
        } else {
          console.warn(`[Overlord POST] extractTraitsFromImage returned null for overlord ${overlord.id}, photo: ${photoUrl}`);
        }
      } catch (visionError) {
        // Vision failures are non-blocking
        const errMsg = visionError instanceof Error ? visionError.message : String(visionError);
        const errStack = visionError instanceof Error ? visionError.stack : undefined;
        console.error(`[Overlord POST] Vision/matching failed for overlord ${overlord.id}, photo: ${photoUrl}: ${errMsg}`, errStack);
      }
    }

    // Start Search Protocol (Temporal workflow) if configured
    let temporalWorkflowId: string | null = null;
    if (isTemporalConfigured()) {
      try {
        const connection = await Connection.connect(getClientConnectionOptions());
        const client = new Client({
          connection,
          namespace: getTemporalNamespace(),
        });
        const workflowId = `search-protocol-${overlord.id}`;

        const overrideConfig = readSearchProtocolConfigFromEnv();
        const workflowArgs: unknown[] = overrideConfig
          ? [overlord.id, overrideConfig]
          : [overlord.id];

        await client.workflow.start("searchProtocolWorkflow", {
          args: workflowArgs,
          taskQueue: TASK_QUEUE,
          workflowId,
        });

        temporalWorkflowId = workflowId;

        // Store the workflow ID on the record
        await serviceClient
          .from("overlords")
          .update({ temporal_workflow_id: workflowId })
          .eq("id", overlord.id);
      } catch (temporalError) {
        // Temporal not available — non-fatal, continue without workflow
        const errMsg = temporalError instanceof Error ? temporalError.message : String(temporalError);
        const errStack = temporalError instanceof Error ? temporalError.stack : undefined;
        console.error(
          `[Overlord POST] Failed to start Search Protocol for ${overlord.id}: ${errMsg}`, errStack
        );
      }
    }

    // Notify nearby informants who have location consent about the missing pet
    try {
      const RADIUS_DEG = 0.045; // ~5km
      const { data: nearbyInformants } = await serviceClient
        .from("informants")
        .select("id")
        .eq("location_consent", true)
        .neq("id", user.id)
        .gte("residential_lat", last_seen_lat - RADIUS_DEG)
        .lte("residential_lat", last_seen_lat + RADIUS_DEG)
        .gte("residential_lng", last_seen_lng - RADIUS_DEG)
        .lte("residential_lng", last_seen_lng + RADIUS_DEG);

      if (nearbyInformants && nearbyInformants.length > 0) {
        const notifications = nearbyInformants.map((informant) => ({
          recipient_id: informant.id,
          type: "lost_nearby",
          title: "Lost Pet Nearby!",
          body: `"${pet_name}" (${pet_type}) was reported missing near your area. Keep an eye out!`,
          metadata: {
            overlord_id: overlord.id,
            photo_thumbnail: photos[0] ?? null,
          },
          read: false,
        }));

        await serviceClient.from("notifications").insert(notifications);
      }
    } catch (notifyError) {
      // Non-blocking
      const errMsg = notifyError instanceof Error ? notifyError.message : String(notifyError);
      console.error(`[Overlord POST] Nearby notification failed for overlord ${overlord.id}: ${errMsg}`);
    }

    // Return the created record without verification fields
    const response = { ...overlord, temporal_workflow_id: temporalWorkflowId };
    for (const field of VERIFICATION_FIELDS) {
      delete (response as Record<string, unknown>)[field];
    }

    return NextResponse.json({ overlord: response }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create Overlord: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/overlords
 *
 * Lists Overlord records with optional filters:
 * - status: 'active' | 'resolved'
 * - owner_id: filter by specific owner
 *
 * Never includes verification fields in list response.
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
    const ownerId = searchParams.get("owner_id");
    const mine = searchParams.get("mine");
    const petType = searchParams.get("pet_type");
    const since = searchParams.get("since"); // ISO datetime — last_seen_at >= since

    // Select all columns except verification fields
    let query = supabase
      .from("overlords")
      .select(
        "id, owner_id, pet_name, pet_type, description, last_seen_lat, last_seen_lng, last_seen_address, last_seen_at, status, photos, trait_tags, tagging_status, poster_url, temporal_workflow_id, is_seed, created_at"
      )
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
        query = query.gte("last_seen_at", sinceDate.toISOString());
      }
    }

    // If mine=true, filter to current user's reports only
    if (mine === "true") {
      query = query.eq("owner_id", user.id);
    } else if (ownerId) {
      query = query.eq("owner_id", ownerId);
    }

    const { data: overlords, error: fetchError } = await query;

    if (fetchError) {
      const sanitizedError = sanitizeDatabaseError(fetchError, "fetch Overlords", "[Overlord GET]");
      return NextResponse.json(
        { error: sanitizedError },
        { status: 500 }
      );
    }

    return NextResponse.json({ overlords: overlords ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch Overlords: ${message}` },
      { status: 500 }
    );
  }
}
