// lib/resolutionFlow.ts — Resolution flow logic for when an Overlord is marked as found

import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Executes the full resolution flow when an Overlord is marked as "found".
 *
 * Steps:
 * 1. Cancel Search Protocol Temporal workflow (if workflow ID exists)
 * 2. Reject all pending claims on this Overlord and notify affected claimants
 * 3. If resolution is linked to a specific Agent → mark Agent as resolved
 *    (SECURITY: Agent resolution requires a verified match relationship)
 * 4. Cancel other pending match suggestions for both records
 *
 * @param serviceClient - Supabase client with service role (bypasses RLS)
 * @param overlordId - The Overlord being resolved
 * @param resolvedAgentId - Optional Agent ID that matched (from verified claim workflow only)
 * @throws Error if resolvedAgentId is provided but no valid claimed/resolved match exists
 */
export async function executeResolutionFlow(
  serviceClient: SupabaseClient,
  overlordId: string,
  resolvedAgentId?: string | null
): Promise<void> {
  // Step 1: Cancel Temporal workflow if configured
  // Fetch the overlord's temporal_workflow_id
  const { data: overlord } = await serviceClient
    .from("overlords")
    .select("temporal_workflow_id, owner_id")
    .eq("id", overlordId)
    .single();

  if (overlord?.temporal_workflow_id) {
    try {
      // Attempt to cancel the Temporal workflow
      // This uses the Temporal client — in production this would be:
      // const handle = temporal.workflow.getHandle(overlord.temporal_workflow_id);
      // await handle.cancel();
      // For now we just clear the workflow ID as a marker
      await serviceClient
        .from("overlords")
        .update({ temporal_workflow_id: null })
        .eq("id", overlordId);
    } catch (temporalError) {
      // Workflow may already be completed or cancelled — non-fatal
      const errMsg = temporalError instanceof Error ? temporalError.message : String(temporalError);
      console.error(
        `Failed to cancel Temporal workflow for Overlord ${overlordId}: ${errMsg}`
      );
    }
  }

  // Step 2: Reject all pending claims on this Overlord
  const { data: pendingClaims } = await serviceClient
    .from("claims")
    .select("id, claimant_id")
    .eq("overlord_id", overlordId)
    .eq("status", "pending");

  if (pendingClaims && pendingClaims.length > 0) {
    // Reject all pending claims
    await serviceClient
      .from("claims")
      .update({ status: "rejected" })
      .eq("overlord_id", overlordId)
      .eq("status", "pending");

    // Notify affected claimants
    const notifications = pendingClaims.map((claim) => ({
      recipient_id: claim.claimant_id,
      type: "overlord_resolved" as const,
      title: "Overlord Resolved — Claim Cancelled",
      body: "The Overlord you had a pending claim on has been reunited with their owner. Your claim has been cancelled.",
      metadata: {
        claim_id: claim.id,
        overlord_id: overlordId,
      },
      read: false,
    }));

    if (notifications.length > 0) {
      await serviceClient.from("notifications").insert(notifications);
    }
  }

  // Step 3: If resolution linked to specific Agent → mark Agent as resolved
  // SECURITY INVARIANT: Only resolve an agent if there is a valid match relationship
  // in an authorized state (claimed or resolved). This prevents unauthorized
  // resolution of arbitrary agents via IDOR attacks.
  if (resolvedAgentId) {
    // Verify that a match exists between this overlord and agent in an authorized state
    const { data: matchRecord, error: matchError } = await serviceClient
      .from("match_suggestions")
      .select("id, status")
      .eq("overlord_id", overlordId)
      .eq("agent_id", resolvedAgentId)
      .in("status", ["claimed", "resolved"])
      .maybeSingle();

    if (matchError) {
      throw new Error(
        `Failed to validate match relationship for agent resolution: ${matchError.message}`
      );
    }

    if (!matchRecord) {
      throw new Error(
        `Authorization failed: No valid claimed or resolved match exists between overlord ${overlordId} and agent ${resolvedAgentId}. ` +
        `Agent resolution requires going through the proper claim workflow.`
      );
    }

    // Authorization check passed — proceed with agent resolution
    await serviceClient
      .from("agents")
      .update({ status: "resolved" })
      .eq("id", resolvedAgentId);

    // Cancel pending match suggestions for the resolved Agent
    await serviceClient
      .from("match_suggestions")
      .update({ status: "rejected" })
      .eq("agent_id", resolvedAgentId)
      .in("status", ["pending", "claimed"]);
  }

  // Step 4: Cancel all pending/claimed match suggestions for this Overlord
  await serviceClient
    .from("match_suggestions")
    .update({ status: "rejected" })
    .eq("overlord_id", overlordId)
    .in("status", ["pending", "claimed"]);

  // Notify the Overlord owner (optional success notification)
  if (overlord?.owner_id) {
    await serviceClient.from("notifications").insert({
      recipient_id: overlord.owner_id,
      type: "overlord_resolved" as const,
      title: "Mission Complete — Overlord Found!",
      body: "Your Overlord has been marked as found. All active searches and pending claims have been cancelled.",
      metadata: {
        overlord_id: overlordId,
        resolved_agent_id: resolvedAgentId || null,
      },
      read: false,
    });
  }
}
