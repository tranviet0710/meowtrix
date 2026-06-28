// temporal/activities/claimReminder.ts — Activities for the Claim Reminder workflow

import { createClient } from "@supabase/supabase-js";
import { sendClaimReminderEmail } from "../../lib/email";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }

  return createClient(url, key);
}

/**
 * Check if a match suggestion is still in "claimed" state.
 */
export async function isMatchStillClaimed(matchId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("match_suggestions")
    .select("status")
    .eq("id", matchId)
    .single();

  if (error) {
    throw new Error(`Failed to check match status: ${error.message}`);
  }

  return data?.status === "claimed";
}

/**
 * Send reminder notifications and emails to both parties for an unclosed claim.
 */
export async function sendClaimReminderNotifications(matchId: string): Promise<void> {
  const supabase = getSupabaseClient();

  // Fetch match with overlord and agent details
  const { data: match, error: matchError } = await supabase
    .from("match_suggestions")
    .select(`
      id,
      overlord_id,
      agent_id,
      overlords:overlord_id (
        id,
        owner_id,
        pet_name
      ),
      agents:agent_id (
        id,
        reporter_id
      )
    `)
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    throw new Error(`Failed to fetch match ${matchId}: ${matchError?.message ?? "Not found"}`);
  }

  const overlord = match.overlords as unknown as { id: string; owner_id: string; pet_name: string } | null;
  const agent = match.agents as unknown as { id: string; reporter_id: string } | null;

  if (!overlord || !agent) {
    throw new Error(`Match ${matchId} missing overlord or agent data`);
  }

  // Fetch informant details for both parties
  const { data: ownerInfo } = await supabase
    .from("informants")
    .select("id, email, display_name")
    .eq("id", overlord.owner_id)
    .single();

  const { data: reporterInfo } = await supabase
    .from("informants")
    .select("id, email, display_name")
    .eq("id", agent.reporter_id)
    .single();

  if (!ownerInfo || !reporterInfo) {
    throw new Error(`Could not find informant details for match ${matchId}`);
  }

  // Send in-app notifications to both
  const notifications = [
    {
      recipient_id: ownerInfo.id,
      type: "claim_reminder" as const,
      title: `⏰ Reminder: Update status for ${overlord.pet_name}`,
      body: "It's been 24 hours since your claim. Please update the match status — mark as resolved if you've reunited, or revert if it didn't work out.",
      metadata: { match_id: matchId, overlord_id: overlord.id },
      read: false,
    },
    {
      recipient_id: reporterInfo.id,
      type: "claim_reminder" as const,
      title: `⏰ Reminder: Claim pending for ${overlord.pet_name}`,
      body: "It's been 24 hours since the owner claimed the pet you found. If the meetup didn't happen or failed, you can revert the claim on the match page.",
      metadata: { match_id: matchId, agent_id: agent.id },
      read: false,
    },
  ];

  await supabase.from("notifications").insert(notifications);

  // Send reminder emails to both
  try {
    await sendClaimReminderEmail({
      email: ownerInfo.email,
      displayName: ownerInfo.display_name,
      petName: overlord.pet_name,
      matchId,
    });

    await sendClaimReminderEmail({
      email: reporterInfo.email,
      displayName: reporterInfo.display_name,
      petName: overlord.pet_name,
      matchId,
    });
  } catch (emailError) {
    // Log but don't fail the activity — in-app notifications were already sent
    console.error(`[ClaimReminder] Email send failed:`, emailError);
  }

  console.log(`[ClaimReminder] Sent 24h reminder for match ${matchId}`);
}
