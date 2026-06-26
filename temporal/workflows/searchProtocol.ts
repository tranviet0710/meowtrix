// temporal/workflows/searchProtocol.ts — Escalating Search Protocol workflow
// Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.9, 7.10

import { proxyActivities, sleep } from '@temporalio/workflow';
import type { SearchProtocolActivities } from '../activities/types';

const {
  isOverlordResolved,
  notifyNearbyInformants,
  generateMissingPoster,
  sendSearchConcludedNotification,
} = proxyActivities<SearchProtocolActivities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '10 seconds',
    backoffCoefficient: 2,
  },
});

/**
 * Escalating Search Protocol workflow.
 *
 * Timeline:
 * - 6h:  Notify informants within 1km radius (location_consent=true only)
 * - 24h: Generate printable PDF missing poster (A4)
 * - 48h: Notify informants within 5km radius (exclude previously notified, location_consent=true only)
 * - 14d: Auto-terminate and send search concluded notification
 *
 * Cancellation: Triggered when Overlord is marked as resolved.
 * Durability: Temporal replays from last completed stage on system restart.
 *
 * @param overlordId - The UUID of the Overlord record to search for
 */
export async function searchProtocolWorkflow(overlordId: string): Promise<void> {
  // Stage 1: 6 hours — notify 1km radius (only consented informants)
  await sleep('6 hours');
  if (await isOverlordResolved(overlordId)) return;
  await notifyNearbyInformants(overlordId, 1000);

  // Stage 2: 24 hours total — generate PDF poster
  await sleep('18 hours');
  if (await isOverlordResolved(overlordId)) return;
  await generateMissingPoster(overlordId);

  // Stage 3: 48 hours total — notify 5km radius (exclude previously notified)
  await sleep('24 hours');
  if (await isOverlordResolved(overlordId)) return;
  await notifyNearbyInformants(overlordId, 5000);

  // Stage 4: 14 days total — auto-terminate
  await sleep('12 days');
  if (await isOverlordResolved(overlordId)) return;
  await sendSearchConcludedNotification(overlordId);
}
