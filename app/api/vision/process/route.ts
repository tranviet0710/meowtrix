import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabaseServer";
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

    const supabase = await createServiceRoleClient();
    const table = body.record_type === "overlord" ? "overlords" : "agents";

    let taggingStatus: TaggingStatus;
    let traitTags = null;

    try {
      const result = await extractTraitsFromImage(body.photo_url);

      if (result === null) {
        // Response was incomplete (missing required fields)
        taggingStatus = "incomplete";
      } else {
        traitTags = result;
        taggingStatus = "complete";
      }
    } catch {
      // Both attempts failed — mark for manual review
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
      } catch {
        // Match evaluation failure should not fail the vision processing response
        // It will be retried when the record is re-evaluated
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
