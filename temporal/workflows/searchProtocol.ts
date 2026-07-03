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
 * Configurable stage timings and radii for the Escalating Search Protocol.
 *
 * All *DelayMs values are ADDITIVE — each stage sleeps for its own delay
 * after the previous stage completes. The absolute times below assume the
 * defaults are used and the workflow starts at t=0.
 *
 * Defaults (per specs/meowtrix/requirements.md §7):
 * - Stage 1 (t=6h):  Notify nearby helpers within 1km radius
 * - Stage 2 (t=24h): Auto-generate printable PDF flyer
 * - Stage 3 (t=48h): Notify expanded 5km radius (excludes previously notified)
 * - Stage 4 (t=14d): Send "search concluded" notification to the owner
 */
export interface SearchProtocolConfig {
  /** Delay from workflow start to Stage 1 (nearby notification). Default: 6h. */
  stage1DelayMs?: number;
  /** Additional delay from Stage 1 to Stage 2 (PDF flyer). Default: 18h → 24h total. */
  stage2DelayMs?: number;
  /** Additional delay from Stage 2 to Stage 3 (expanded radius). Default: 24h → 48h total. */
  stage3DelayMs?: number;
  /** Additional delay from Stage 3 to Stage 4 (search concluded). Default: 12d → 14d total. */
  stage4DelayMs?: number;
  /** Radius in meters for Stage 1 notification. Default: 1000m. */
  stage1RadiusMeters?: number;
  /** Radius in meters for Stage 3 expanded notification. Default: 5000m. */
  stage3RadiusMeters?: number;
}

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Default stage timing/radii — see SearchProtocolConfig for descriptions.
 * Exported so callers (API routes, tests) can reference them.
 */
export const DEFAULT_SEARCH_PROTOCOL_CONFIG: Required<SearchProtocolConfig> = {
  stage1DelayMs: 6 * MS_PER_HOUR,
  stage2DelayMs: 18 * MS_PER_HOUR,
  stage3DelayMs: 24 * MS_PER_HOUR,
  stage4DelayMs: 12 * MS_PER_DAY,
  stage1RadiusMeters: 1000,
  stage3RadiusMeters: 5000,
};

/**
 * Escalating Search Protocol workflow.
 *
 * At each stage, the workflow checks whether the Overlord has been resolved.
 * If so, it short-circuits without further side effects.
 *
 * Cancellation: Callers can also cancel the workflow via the Temporal Client
 * when the Overlord is manually marked resolved.
 * Durability: Temporal replays from the last completed stage on restart.
 *
 * @param overlordId - The UUID of the Overlord record to search for
 * @param config    - Optional per-workflow stage overrides
 */
export async function searchProtocolWorkflow(
  overlordId: string,
  config?: SearchProtocolConfig
): Promise<void> {
  const cfg: Required<SearchProtocolConfig> = {
    ...DEFAULT_SEARCH_PROTOCOL_CONFIG,
    ...(config ?? {}),
  };

  // Stage 1: notify a tight radius of nearby helpers (default t=6h, 1km).
  await sleep(cfg.stage1DelayMs);
  if (await isOverlordResolved(overlordId)) return;
  await notifyNearbyInformants(overlordId, cfg.stage1RadiusMeters);

  // Stage 2: auto-generate the printable PDF flyer (default t=24h).
  await sleep(cfg.stage2DelayMs);
  if (await isOverlordResolved(overlordId)) return;
  await generateMissingPoster(overlordId);

  // Stage 3: expand the notification radius, excluding already-notified helpers
  // (default t=48h, 5km).
  await sleep(cfg.stage3DelayMs);
  if (await isOverlordResolved(overlordId)) return;
  await notifyNearbyInformants(overlordId, cfg.stage3RadiusMeters);

  // Stage 4: automatically conclude the timeline (default t=14d).
  await sleep(cfg.stage4DelayMs);
  if (await isOverlordResolved(overlordId)) return;
  await sendSearchConcludedNotification(overlordId);
}
