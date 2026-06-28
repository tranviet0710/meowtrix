// temporal/workflows/claimReminder.ts — 24h claim reminder workflow

import { proxyActivities, sleep } from "@temporalio/workflow";
import type { ClaimReminderActivities } from "../activities/types";

const { isMatchStillClaimed, sendClaimReminderNotifications } =
  proxyActivities<ClaimReminderActivities>({
    startToCloseTimeout: "5 minutes",
    retry: {
      maximumAttempts: 3,
      initialInterval: "10 seconds",
      backoffCoefficient: 2,
    },
  });

/**
 * Claim Reminder Workflow.
 *
 * After a match is claimed, waits 24 hours and checks if the match status
 * is still "claimed" (neither resolved nor reverted).
 * If still claimed, sends reminder notifications + emails to both parties.
 *
 * @param matchId - The UUID of the match suggestion
 */
export async function claimReminderWorkflow(matchId: string): Promise<void> {
  // Wait 24 hours
  await sleep("24 hours");

  // Check if the match is still in "claimed" state
  const stillClaimed = await isMatchStillClaimed(matchId);
  if (!stillClaimed) {
    // Already resolved or reverted — nothing to do
    return;
  }

  // Send reminder notifications and emails to both parties
  await sendClaimReminderNotifications(matchId);
}
