-- =============================================================================
-- Migration 00008: Add `ai_extraction_events` table for AI extraction quota
-- =============================================================================
-- Purpose:
--   Support the AI-assisted "Create with AI from a screenshot" feature on the
--   Lost Report and Spotted Report pages. Each successful call to
--   POST /api/ai/extract-report appends one row here so the server can enforce
--   the rolling-24h per-user quota (Requirement 11.1: at most 5 successful
--   extractions per authenticated user per rolling 24-hour window).
--
--   The table is append-only from the app's perspective; writes go through the
--   service role from `lib/aiRateLimiter.recordSuccessfulExtraction`. Users
--   read their own rows to hydrate the "X / 5 today" hint in the modal.
--
--   Rows older than 24h are simply ignored by the count query; no scheduled
--   cleanup is required.
-- =============================================================================

CREATE TABLE public.ai_extraction_events (
  id         UUID        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index tuned for the rolling-window count and "oldest event" lookup used by
-- `checkExtractionQuota` (see design.md — lib/aiRateLimiter).
CREATE INDEX ai_extraction_events_user_time_idx
  ON public.ai_extraction_events (user_id, created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
-- Users may SELECT only their own rows so the client can compute remaining
-- quota. There is no user-facing INSERT / UPDATE / DELETE policy; the service
-- role bypasses RLS and is the only writer.
-- =============================================================================
ALTER TABLE public.ai_extraction_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_extraction_events_select" ON public.ai_extraction_events
  FOR SELECT USING (auth.uid() = user_id);
