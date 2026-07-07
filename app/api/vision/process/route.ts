import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabaseServer";
import { extractTraitsFromImage } from "@/lib/gemini";
import { triggerMatchEvaluation } from "@/lib/matchTrigger";
import type { TaggingStatus } from "@/types";

interface ProcessRequest {
  record_id: string;
  record_type: "overlord" | "agent";
  photo_url: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ProcessRequest;

    // Validate request body
    if (!body.record_id || !body.record_type || !body.photo_url) {
      return NextResponse.json(
        { error: "Missing required fields: record_id, record_type, photo_url" },
        { status: 400 }
      );
    }

    if (body.record_type !== "overlord" && body.record_type !== "agent") {
      return NextResponse.json(
        { error: "record_type must be 'overlord' or 'agent'" },
        { status: 400 }
      );
    }

    // Authenticate the user
    const authClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify ownership of the record before processing
    const table = body.record_type === "overlord" ? "overlords" : "agents";
    const ownershipField = body.record_type === "overlord" ? "owner_id" : "reporter_id";

    const { data: record, error: fetchError } = await authClient
      .from(table)
      .select(`id, ${ownershipField}`)
      .eq("id", body.record_id)
      .single();

    if (fetchError || !record) {
      return NextResponse.json(
        { error: "Record not found" },
        { status: 404 }
      );
    }

    // Verify the authenticated user owns this record
    if (record[ownershipField] !== user.id) {
      return NextResponse.json(
        { error: "Forbidden — you can only process your own records" },
        { status: 403 }
      );
    }

    // Now use service role client for the actual processing
    const supabase = await createServiceRoleClient();

    let taggingStatus: TaggingStatus;
    let traitTags = null;

    try {
      const result = await extractTraitsFromImage(body.photo_url);

      if (result === null) {
        // Response was incomplete (missing required fields)
        taggingStatus = "incomplete";
        console.warn(`[Vision] extractTraitsFromImage returned null (incomplete response) for ${body.record_type} ${body.record_id}, photo: ${body.photo_url}`);
      } else {
        traitTags = result;
        taggingStatus = "complete";
      }
    } catch (extractError) {
      // Both attempts failed — mark for manual review
      const errMsg = extractError instanceof Error ? extractError.message : String(extractError);
      const errStack = extractError instanceof Error ? extractError.stack : undefined;
      console.error(`[Vision] extractTraitsFromImage failed for ${body.record_type} ${body.record_id}, photo: ${body.photo_url}: ${errMsg}`, errStack);
      taggingStatus = "manual_review";
    }

    // Update the record in the database
    const updateData: Record<string, unknown> = {
      tagging_status: taggingStatus,
    };

    if (traitTags) {
      updateData.trait_tags = traitTags;
    }

    const { error: updateError } = await supabase
      .from(table)
      .update(updateData)
      .eq("id", body.record_id);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update record: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Trigger match evaluation when tagging is complete
    if (taggingStatus === "complete" && traitTags) {
      try {
        await triggerMatchEvaluation(supabase, body.record_id, body.record_type);
      } catch (matchError) {
        // Match evaluation failure should not fail the vision processing response
        // It will be retried when the record is re-evaluated
        const errMsg = matchError instanceof Error ? matchError.message : String(matchError);
        const errStack = matchError instanceof Error ? matchError.stack : undefined;
        console.error(`[Vision] triggerMatchEvaluation failed for ${body.record_type} ${body.record_id}: ${errMsg}`, errStack);
      }
    }

    return NextResponse.json({
      success: true,
      record_id: body.record_id,
      tagging_status: taggingStatus,
      trait_tags: traitTags,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Vision processing failed: ${message}` },
      { status: 500 }
    );
  }
}
