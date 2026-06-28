// temporal/activities/types.ts — Activity interface definitions for Search Protocol

/**
 * Activity interface for the Search Protocol workflow.
 * All activities are implemented as separate modules and composed via proxyActivities.
 */
export interface SearchProtocolActivities {
  /**
   * Check if an Overlord has been resolved (found).
   * Used at each escalation stage to short-circuit the workflow.
   */
  isOverlordResolved(overlordId: string): Promise<boolean>;

  /**
   * Notify nearby informants within a given radius of the Overlord's last-seen location.
   * Only includes informants with location_consent=true.
   * At 5km stage, excludes informants who were already notified at the 1km stage.
   *
   * @param overlordId - The Overlord record ID
   * @param radiusMeters - The radius in meters to search for nearby informants
   */
  notifyNearbyInformants(overlordId: string, radiusMeters: number): Promise<void>;

  /**
   * Generate an A4 PDF missing poster for the Overlord.
   * Contains cat photo, name, trait tags, and last-seen location.
   * Uploads the PDF to Supabase Storage (posters bucket) and
   * stores the URL on the Overlord record.
   */
  generateMissingPoster(overlordId: string): Promise<void>;

  /**
   * Send a notification to the Overlord owner indicating that the
   * 14-day automated search period has concluded.
   */
  sendSearchConcludedNotification(overlordId: string): Promise<void>;
}

/**
 * Activity interface for the Claim Reminder workflow.
 */
export interface ClaimReminderActivities {
  /**
   * Check if a match suggestion is still in "claimed" state.
   * Returns false if it's been resolved or reverted to pending.
   */
  isMatchStillClaimed(matchId: string): Promise<boolean>;

  /**
   * Send reminder notifications and emails to both parties
   * (overlord owner and agent reporter) for an unclosed claim.
   */
  sendClaimReminderNotifications(matchId: string): Promise<void>;
}

/**
 * Information about a nearby informant eligible for notifications.
 */
export interface NearbyInformant {
  id: string;
  display_name: string;
  residential_lat: number;
  residential_lng: number;
  distance_meters: number;
}
