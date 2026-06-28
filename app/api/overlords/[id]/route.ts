// app/api/overlords/[id]/route.ts — GET detail, PATCH update, DELETE Overlord

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabaseServer";
import { executeResolutionFlow } from "@/lib/resolutionFlow";
import { stripVerificationFields } from "@/lib/stripVerificationFields";

/**
 * GET /api/overlords/[id]
 *
 * Returns the full Overlord detail.
 * - Includes verification fields ONLY if the authenticated user is the owner.
 * - Returns 404 if not found.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Authenticate
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the overlord using service role to get all fields including verification
    const serviceClient = await createServiceRoleClient();
    const { data: overlord, error: fetchError } = await serviceClient
      .from("overlords")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !overlord) {
      return NextResponse.json(
        { error: "Overlord not found" },
        { status: 404 }
      );
    }

    // If the user is the owner, return full record including verification fields
    if (overlord.owner_id === user.id) {
      return NextResponse.json({ overlord });
    }

    // For non-owners, strip verification fields
    return NextResponse.json({
      overlord: stripVerificationFields(overlord),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch Overlord: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/overlords/[id]
 *
 * Updates an Overlord record. Owner only.
 * Supported updates:
 * - status: to 'resolved' (triggers resolution flow)
 * - description: updated text
 * - photos: updated photo array
 *
 * Returns 403 for non-owners.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Authenticate
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch existing Overlord to verify ownership
    const serviceClient = await createServiceRoleClient();
    const { data: existingOverlord, error: fetchError } = await serviceClient
      .from("overlords")
      .select("id, owner_id, status")
      .eq("id", id)
      .single();

    if (fetchError || !existingOverlord) {
      return NextResponse.json(
        { error: "Overlord not found" },
        { status: 404 }
      );
    }

    // Only the owner can update
    if (existingOverlord.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden — only the owner can update this Overlord" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Build update payload — only allow specific fields
    const updateData: Record<string, unknown> = {};

    if (body.description !== undefined) {
      if (
        typeof body.description !== "string" ||
        body.description.length > 500
      ) {
        return NextResponse.json(
          { error: "Description must be a string of at most 500 characters" },
          { status: 400 }
        );
      }
      updateData.description = body.description;
    }

    if (body.photos !== undefined) {
      if (
        !Array.isArray(body.photos) ||
        body.photos.length < 1 ||
        body.photos.length > 5
      ) {
        return NextResponse.json(
          { error: "Photos must be an array of 1 to 5 URLs" },
          { status: 400 }
        );
      }
      updateData.photos = body.photos;

      // Trigger Vision Service for new photos (fire-and-forget)
      const baseUrl = request.nextUrl.origin;
      for (const photoUrl of body.photos as string[]) {
        fetch(`${baseUrl}/api/vision/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            record_id: id,
            record_type: "overlord",
            photo_url: photoUrl,
          }),
        }).catch((fetchErr) => {
          const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
          console.error(`[Overlord PATCH] Vision process fetch failed for overlord ${id}, photo: ${photoUrl}: ${errMsg}`);
        });
      }
    }

    if (body.status !== undefined) {
      if (body.status !== "resolved") {
        return NextResponse.json(
          { error: "Status can only be updated to 'resolved'" },
          { status: 400 }
        );
      }
      if (existingOverlord.status === "resolved") {
        return NextResponse.json(
          { error: "Overlord is already resolved" },
          { status: 400 }
        );
      }
      updateData.status = "resolved";
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid update fields provided" },
        { status: 400 }
      );
    }

    // Apply the update
    const { data: updatedOverlord, error: updateError } = await serviceClient
      .from("overlords")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError || !updatedOverlord) {
      return NextResponse.json(
        { error: `Failed to update Overlord: ${updateError?.message ?? "Unknown error"}` },
        { status: 500 }
      );
    }

    // If status changed to resolved, trigger the resolution flow
    if (body.status === "resolved") {
      const resolvedAgentId = body.resolved_agent_id ?? null;
      try {
        await executeResolutionFlow(serviceClient, id, resolvedAgentId);
      } catch (resolutionError) {
        // Resolution flow errors are non-fatal — the status update already succeeded
        const errMsg = resolutionError instanceof Error ? resolutionError.message : String(resolutionError);
        const errStack = resolutionError instanceof Error ? resolutionError.stack : undefined;
        console.error(
          `[Overlord PATCH] Resolution flow failed for ${id}: ${errMsg}`, errStack
        );
      }
    }

    // Return updated record (owner sees everything)
    return NextResponse.json({ overlord: updatedOverlord });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to update Overlord: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/overlords/[id]
 *
 * Deletes an Overlord record. Owner only.
 * Hard delete — removes the record from the database.
 * Returns 403 for non-owners.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Authenticate
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch existing Overlord to verify ownership
    const serviceClient = await createServiceRoleClient();
    const { data: existingOverlord, error: fetchError } = await serviceClient
      .from("overlords")
      .select("id, owner_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingOverlord) {
      return NextResponse.json(
        { error: "Overlord not found" },
        { status: 404 }
      );
    }

    // Only the owner can delete
    if (existingOverlord.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden — only the owner can delete this Overlord" },
        { status: 403 }
      );
    }

    // Delete the record
    const { error: deleteError } = await serviceClient
      .from("overlords")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json(
        { error: `Failed to delete Overlord: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Overlord deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to delete Overlord: ${message}` },
      { status: 500 }
    );
  }
}
