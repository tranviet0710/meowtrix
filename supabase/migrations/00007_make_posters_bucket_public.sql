-- =============================================================================
-- Migration 00007: Make the `posters` bucket publicly readable
-- =============================================================================
-- Purpose:
--   Missing-pet posters are meant to be printed, shared, and shown to anyone
--   who might spot the pet. They contain no sensitive data (just the pet's
--   name, photo, description, and last-seen area — the same info the owner
--   voluntarily posts on the app). The bucket was previously created as
--   `public = false`, which caused `getPublicUrl()` to return URLs that
--   the Supabase Storage public endpoint rejects with "Bucket not found".
--
-- This migration:
--   1. Creates the `posters` bucket if it doesn't already exist (idempotent).
--   2. Flips the bucket to `public = true` so `getPublicUrl()` works.
--   3. Replaces the authenticated-only SELECT policy with a public one so
--      RLS lets anonymous viewers read poster files (matching the bucket
--      setting).
--   4. Leaves writes restricted (service role only, which bypasses RLS).
-- =============================================================================

-- Ensure the bucket exists AND is public.
INSERT INTO storage.buckets (id, name, public)
VALUES ('posters', 'posters', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop the old authenticated-only SELECT policy if it exists.
DROP POLICY IF EXISTS "posters_select_authenticated" ON storage.objects;

-- Public SELECT: anyone (including anonymous users) can view poster files.
-- Writes remain restricted — no INSERT/UPDATE/DELETE policies are defined
-- for regular users, so only the service role (which bypasses RLS) can
-- upload posters from the Temporal activity.
CREATE POLICY "posters_select_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'posters');
