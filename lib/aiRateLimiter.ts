// lib/aiRateLimiter.ts — Rolling-24h extraction quota for AI-assisted reports.
//
// Backs Requirement 11.1 (max 5 successful AI extractions per authenticated
// user per rolling 24-hour window). The store is the `ai_extraction_events`
// table added in migration 00008; RLS lets a user read their own rows but
// only the service role writes.
//
// This module is intentionally thin — it does not open a Supabase client
// itself. Callers pass in whichever client they already have: the route
// handler uses the service-role client so both the read (bypassing RLS is
// harmless because we filter by `user_id`) and the write (which RLS would
// otherwise block) use the same connection.
//
// Design reference: `.kiro/specs/create-report-with-ai/design.md` →
// "Server Modules" → "lib/aiRateLimiter.ts".

import type { SupabaseClient } from '@supabase/supabase-js';

/** Maximum successful extractions per user per rolling window (Req 11.1). */
const QUOTA_LIMIT = 5;

/** Rolling window length in milliseconds — 24 hours. */
const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Table name used by both the read and the write. */
const EVENTS_TABLE = 'ai_extraction_events';

/**
 * Result of a quota check. Mirrors the `quota` block in `ExtractionSuccess`
 * plus an `allowed` flag the route handler uses to short-circuit with 429.
 */
export interface ExtractionQuota {
  /** True when the caller may perform another extraction (count < 5). */
  allowed: boolean;
  /** Remaining extractions in the current 24h window (0..5). */
  remaining: number;
  /**
   * ISO-8601 timestamp approximating when the next slot opens up. When the
   * user has at least one event in the window, this is the oldest event's
   * `created_at + 24h`. When no events are in-window, this is `now + 24h`.
   * Best-effort — a small clock skew is acceptable for a warm hint.
   */
  resets_at: string;
}

/**
 * Row shape returned by the created_at select. Kept local so we don't leak
 * a Supabase-generated database type from this file's public surface.
 */
interface EventRow {
  created_at: string;
}

/**
 * Compute the current quota state for `userId`.
 *
 * Runs the design's query:
 *   `select created_at from ai_extraction_events
 *    where user_id = :uid and created_at > now() - interval '24 hours'
 *    order by created_at asc`
 *
 * The cutoff is computed client-side (`now - 24h`) rather than in SQL so this
 * works with the standard PostgREST filter API without a server-side function.
 * The result is functionally equivalent because both endpoints compare against
 * the same clock — the row's `created_at` is set by the DB `default now()`.
 *
 * Throws when the database call fails so the route handler can surface an
 * appropriate 5xx rather than silently letting a broken quota through.
 */
export async function checkExtractionQuota(
  client: SupabaseClient,
  userId: string
): Promise<ExtractionQuota> {
  const now = Date.now();
  const cutoffIso = new Date(now - WINDOW_MS).toISOString();

  const { data, error } = await client
    .from(EVENTS_TABLE)
    .select('created_at')
    .eq('user_id', userId)
    .gt('created_at', cutoffIso)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(
      `[aiRateLimiter] Failed to read extraction events: ${error.message}`
    );
  }

  const events = (data ?? []) as EventRow[];
  const count = events.length;
  const remaining = Math.max(0, QUOTA_LIMIT - count);
  const allowed = count < QUOTA_LIMIT;

  let resetsAt: string;
  if (events.length > 0) {
    // Oldest event first because we ordered asc. Once it ages out of the
    // window a new slot opens.
    const oldest = new Date(events[0].created_at).getTime();
    const oldestValid = Number.isFinite(oldest) ? oldest : now;
    resetsAt = new Date(oldestValid + WINDOW_MS).toISOString();
  } else {
    resetsAt = new Date(now + WINDOW_MS).toISOString();
  }

  return { allowed, remaining, resets_at: resetsAt };
}

/**
 * Record a single successful extraction for `userId`.
 *
 * The caller MUST invoke this only after Gemini has returned a schema-valid
 * response — failed or rate-limited attempts do not count toward the quota
 * (design § "Success-only quota" and Requirement 11.1's "successful" wording).
 *
 * `id` and `created_at` are populated by column defaults, so we only send
 * `user_id`. Uses whichever client the caller passed in; the route handler
 * passes the service-role client because the `ai_extraction_events` table
 * has no user-facing INSERT policy.
 */
export async function recordSuccessfulExtraction(
  client: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await client.from(EVENTS_TABLE).insert({ user_id: userId });

  if (error) {
    throw new Error(
      `[aiRateLimiter] Failed to record extraction event: ${error.message}`
    );
  }
}
