// temporal/activities/sendNotification.ts — Notification delivery activities
// Requirements: 7.2, 7.4, 7.8, 7.9, 7.10

import { createClient } from '@supabase/supabase-js';
import { findNearbyInformants } from './findNearbyInformants';

/**
 * Creates a Supabase client for use in Temporal activities.
 */
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
    );
  }

  return createClient(url, key);
}

/**
 * Check if an Overlord has been resolved (status = 'resolved').
 * Used to short-circuit the workflow at each escalation stage.
 */
export async function isOverlordResolved(overlordId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('overlords')
    .select('status')
    .eq('id', overlordId)
    .single();

  if (error) {
    throw new Error(`Failed to check Overlord status: ${error.message}`);
  }

  return data?.status === 'resolved';
}

/**
 * Notify nearby informants within a given radius of the Overlord's last-seen location.
 * Only includes informants with location_consent=true.
 * At 5km stage, excludes informants who were already notified at the 1km stage
 * (determined by existing 'escalation' notifications for this Overlord).
 *
 * If no informants are found within the radius, logs the skipped attempt and returns
 * without error (Requirement 7.10).
 */
export async function notifyNearbyInformants(
  overlordId: string,
  radiusMeters: number
): Promise<void> {
  const supabase = getSupabaseClient();

  // Fetch Overlord details for the notification content
  const { data: overlord, error: overlordError } = await supabase
    .from('overlords')
    .select('id, pet_name, pet_type, photos, last_seen_lat, last_seen_lng, owner_id')
    .eq('id', overlordId)
    .single();

  if (overlordError || !overlord) {
    throw new Error(
      `Failed to fetch Overlord ${overlordId}: ${overlordError?.message ?? 'Not found'}`
    );
  }

  // Find previously notified informants for this Overlord (to exclude at expanded radius)
  const { data: previousNotifications } = await supabase
    .from('notifications')
    .select('recipient_id')
    .eq('type', 'escalation')
    .contains('metadata', { overlord_id: overlordId });

  const previouslyNotifiedIds = (previousNotifications ?? []).map(
    (n) => n.recipient_id
  );

  // Always exclude the owner from receiving notifications about their own pet
  const excludeIds = Array.from(
    new Set([...previouslyNotifiedIds, overlord.owner_id])
  );

  // Find eligible informants within the radius
  const nearbyInformants = await findNearbyInformants(
    overlord.last_seen_lat,
    overlord.last_seen_lng,
    radiusMeters,
    excludeIds
  );

  // Requirement 7.10: If no informants found, log and proceed without error
  if (nearbyInformants.length === 0) {
    console.log(
      `[SearchProtocol] No informants within ${radiusMeters}m of Overlord ${overlordId}. Skipping notification.`
    );
    return;
  }

  // Create notification records for each eligible informant
  const photoThumbnail = overlord.photos?.[0] ?? null;
  const notifications = nearbyInformants.map((informant) => ({
    recipient_id: informant.id,
    type: 'escalation' as const,
    title: `🚨 Missing Pet Alert: ${overlord.pet_name}`,
    body: `A ${overlord.pet_type ?? 'pet'} named "${overlord.pet_name}" was reported missing ${(informant.distance_meters / 1000).toFixed(1)}km from your area. Keep an eye out!`,
    metadata: {
      overlord_id: overlordId,
      pet_name: overlord.pet_name,
      pet_type: overlord.pet_type,
      photo_thumbnail: photoThumbnail,
      last_seen_lat: overlord.last_seen_lat,
      last_seen_lng: overlord.last_seen_lng,
      radius_meters: radiusMeters,
    },
    read: false,
  }));

  const { error: insertError } = await supabase
    .from('notifications')
    .insert(notifications);

  if (insertError) {
    throw new Error(
      `Failed to insert notifications for Overlord ${overlordId}: ${insertError.message}`
    );
  }

  console.log(
    `[SearchProtocol] Notified ${nearbyInformants.length} informants within ${radiusMeters}m for Overlord ${overlordId}`
  );
}

/**
 * Send a notification to the Overlord owner indicating that the
 * 14-day automated search period has concluded.
 * Requirement 7.9
 */
export async function sendSearchConcludedNotification(
  overlordId: string
): Promise<void> {
  const supabase = getSupabaseClient();

  // Fetch Overlord to get owner_id and pet_name
  const { data: overlord, error: overlordError } = await supabase
    .from('overlords')
    .select('owner_id, pet_name')
    .eq('id', overlordId)
    .single();

  if (overlordError || !overlord) {
    throw new Error(
      `Failed to fetch Overlord ${overlordId}: ${overlordError?.message ?? 'Not found'}`
    );
  }

  const { error: insertError } = await supabase.from('notifications').insert({
    recipient_id: overlord.owner_id,
    type: 'search_concluded',
    title: `Search Protocol Concluded: ${overlord.pet_name}`,
    body: `The 14-day automated search period for "${overlord.pet_name}" has concluded. You can still check for manual match suggestions on the dashboard.`,
    metadata: {
      overlord_id: overlordId,
      pet_name: overlord.pet_name,
    },
    read: false,
  });

  if (insertError) {
    throw new Error(
      `Failed to send search concluded notification: ${insertError.message}`
    );
  }

  console.log(
    `[SearchProtocol] Search concluded notification sent to owner for Overlord ${overlordId}`
  );
}
