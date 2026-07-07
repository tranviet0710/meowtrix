// app/api/agents/[id]/route.ts — GET detail, PATCH update, DELETE Agent

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabaseServer";
import { sanitizeDatabaseError } from "@/lib/errorSanitizer";

/**
 * GET /api/agents/[id]
 *
 * Returns the full Agent detail.
 * Returns 404 if not found.
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

    // Fetch the agent
    const { data: agent, error: fetchError } = await supabase
      .from("agents")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ agent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch Agent: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agents/[id]
 *
 * Updates an Agent record. Reporter only.
 * Supported updates:
 * - description: updated text
 * - photos: updated photo array
 * - status: to 'resolved'
 *
 * Returns 403 for non-reporters.
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

    // Fetch existing Agent to verify reporter ownership
    const serviceClient = await createServiceRoleClient();
    const { data: existingAgent, error: fetchError } = await serviceClient
      .from("agents")
      .select("id, reporter_id, status")
      .eq("id", id)
      .single();

    if (fetchError || !existingAgent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // Only the reporter can update
    if (existingAgent.reporter_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden — only the reporter can update this Agent" },
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

      // Fire-and-forget: Trigger Vision Service for new photos
      const baseUrl = request.nextUrl.origin;
      const cookieHeader = request.headers.get("cookie");
      for (const photoUrl of body.photos as string[]) {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (cookieHeader) {
          headers["Cookie"] = cookieHeader;
        }
        fetch(`${baseUrl}/api/vision/process`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            record_id: id,
            record_type: "agent",
            photo_url: photoUrl,
          }),
        }).catch((fetchErr) => {
          const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
          console.error(`[Agent PATCH] Vision process fetch failed for agent ${id}, photo: ${photoUrl}: ${errMsg}`);
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
      if (existingAgent.status === "resolved") {
        return NextResponse.json(
          { error: "Agent is already resolved" },
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
    const { data: updatedAgent, error: updateError } = await serviceClient
      .from("agents")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError || !updatedAgent) {
      const sanitizedError = sanitizeDatabaseError(updateError, "update Agent", "[Agent PATCH]");
      return NextResponse.json(
        { error: sanitizedError },
        { status: 500 }
      );
    }

    return NextResponse.json({ agent: updatedAgent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to update Agent: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/[id]
 *
 * Deletes an Agent record. Reporter only.
 * Hard delete — removes the record from the database.
 * Returns 403 for non-reporters.
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

    // Fetch existing Agent to verify reporter ownership
    const serviceClient = await createServiceRoleClient();
    const { data: existingAgent, error: fetchError } = await serviceClient
      .from("agents")
      .select("id, reporter_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingAgent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // Only the reporter can delete
    if (existingAgent.reporter_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden — only the reporter can delete this Agent" },
        { status: 403 }
      );
    }

    // Delete the record
    const { error: deleteError } = await serviceClient
      .from("agents")
      .delete()
      .eq("id", id);

    if (deleteError) {
      const sanitizedError = sanitizeDatabaseError(deleteError, "delete Agent", "[Agent DELETE]");
      return NextResponse.json(
        { error: sanitizedError },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Agent deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to delete Agent: ${message}` },
      { status: 500 }
    );
  }
}
