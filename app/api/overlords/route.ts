// app/api/overlords/route.ts — POST create Overlord, GET list Overlords

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabaseServer";
import { overlordFormSchema } from "@/lib/validators";
import { Connection, Client } from "@temporalio/client";

const TASK_QUEUE = "meowtrix-search-protocol";

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

    const { data: overlord, error: insertError } = await serviceClient
      .from("overlords")
      .insert({
        owner_id: user.id,
        pet_name,
        pet_type,
        description,
        last_seen_lat,
        last_seen_lng,
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
      return NextResponse.json(
        { error: `Failed to create Overlord: ${insertError?.message ?? "Unknown error"}` },
        { status: 500 }
      );
    }

    // Fire-and-forget: Trigger Vision Service for each photo
    const baseUrl = request.nextUrl.origin;
    for (const photoUrl of photos) {
      fetch(`${baseUrl}/api/vision/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record_id: overlord.id,
          record_type: "overlord",
          photo_url: photoUrl,
        }),
      }).catch(() => {
        // Fire-and-forget — vision failures are non-blocking
      });
    }

    // Start Search Protocol (Temporal workflow) if configured
    let temporalWorkflowId: string | null = null;
    if (process.env.TEMPORAL_ADDRESS) {
      try {
        const connection = await Connection.connect({
          address: process.env.TEMPORAL_ADDRESS,
        });
        const client = new Client({ connection });
        const workflowId = `search-protocol-${overlord.id}`;

        await client.workflow.start("searchProtocolWorkflow", {
          args: [overlord.id],
          taskQueue: TASK_QUEUE,
          workflowId,
        });

        temporalWorkflowId = workflowId;

        // Store the workflow ID on the record
        await serviceClient
          .from("overlords")
          .update({ temporal_workflow_id: workflowId })
          .eq("id", overlord.id);
      } catch {
        // Temporal not available — non-fatal, continue without workflow
        console.error(
          `[Overlord POST] Failed to start Search Protocol for ${overlord.id}`
        );
      }
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

    // Select all columns except verification fields
    let query = supabase
      .from("overlords")
      .select(
        "id, owner_id, pet_name, pet_type, description, last_seen_lat, last_seen_lng, last_seen_at, status, photos, trait_tags, tagging_status, poster_url, temporal_workflow_id, is_seed, created_at"
      )
      .order("created_at", { ascending: false });

    if (status && (status === "active" || status === "resolved")) {
      query = query.eq("status", status);
    }

    if (ownerId) {
      query = query.eq("owner_id", ownerId);
    }

    const { data: overlords, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json(
        { error: `Failed to fetch Overlords: ${fetchError.message}` },
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
