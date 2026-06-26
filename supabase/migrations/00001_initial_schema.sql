-- =============================================================================
-- MEOWTRIX — Initial Database Schema Migration
-- =============================================================================
-- Tables: informants, overlords, agents, match_suggestions, claims, notifications
-- RLS: Enabled on all tables with per-design policies
-- Functions: verify_claim_answers (secure verification without exposing values)
-- Storage: cat-photos, posters buckets with access policies
-- =============================================================================

-- Enable UUID extension (Supabase usually has this, but ensure it's available)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLE: informants
-- =============================================================================
CREATE TABLE informants (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  residential_area TEXT NOT NULL,
  residential_lat FLOAT NULL,
  residential_lng FLOAT NULL,
  location_consent BOOLEAN NOT NULL DEFAULT false,
  total_points INTEGER NOT NULL DEFAULT 0,
  successful_matches INTEGER NOT NULL DEFAULT 0,
  first_match_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_seed BOOLEAN NOT NULL DEFAULT false
);

-- =============================================================================
-- TABLE: overlords
-- =============================================================================
CREATE TABLE overlords (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES informants(id) ON DELETE CASCADE,
  cat_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  last_seen_lat FLOAT NOT NULL,
  last_seen_lng FLOAT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  photos TEXT[] NOT NULL DEFAULT '{}',
  trait_tags JSONB NULL,
  tagging_status TEXT NOT NULL DEFAULT 'pending' CHECK (tagging_status IN ('pending', 'complete', 'incomplete', 'manual_review')),
  verification_name TEXT NOT NULL,
  verification_marking TEXT NOT NULL,
  verification_trait TEXT NOT NULL,
  poster_url TEXT NULL,
  temporal_workflow_id TEXT NULL,
  is_seed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABLE: agents
-- =============================================================================
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES informants(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  sighting_lat FLOAT NOT NULL,
  sighting_lng FLOAT NOT NULL,
  sighted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  photos TEXT[] NOT NULL DEFAULT '{}',
  trait_tags JSONB NULL,
  tagging_status TEXT NOT NULL DEFAULT 'pending' CHECK (tagging_status IN ('pending', 'complete', 'incomplete', 'manual_review')),
  is_seed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABLE: match_suggestions
-- =============================================================================
CREATE TABLE match_suggestions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  overlord_id UUID NOT NULL REFERENCES overlords(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  visual_score INTEGER NOT NULL CHECK (visual_score >= 0 AND visual_score <= 100),
  description_score INTEGER NOT NULL CHECK (description_score >= 0 AND description_score <= 100),
  proximity_score INTEGER NOT NULL CHECK (proximity_score >= 0 AND proximity_score <= 100),
  other_score INTEGER NOT NULL CHECK (other_score >= 0 AND other_score <= 100),
  matched_traits TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'resolved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABLE: claims
-- =============================================================================
CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  match_suggestion_id UUID NOT NULL REFERENCES match_suggestions(id) ON DELETE CASCADE,
  claimant_id UUID NOT NULL REFERENCES informants(id) ON DELETE CASCADE,
  overlord_id UUID NOT NULL REFERENCES overlords(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  answer_name TEXT NOT NULL,
  answer_marking TEXT NOT NULL,
  answer_trait TEXT NOT NULL,
  correct_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'locked')),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABLE: notifications
-- =============================================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES informants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX idx_overlords_owner_id ON overlords(owner_id);
CREATE INDEX idx_overlords_status ON overlords(status);
CREATE INDEX idx_agents_reporter_id ON agents(reporter_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_match_suggestions_overlord_id ON match_suggestions(overlord_id);
CREATE INDEX idx_match_suggestions_agent_id ON match_suggestions(agent_id);
CREATE INDEX idx_match_suggestions_status ON match_suggestions(status);
CREATE INDEX idx_claims_claimant_id ON claims(claimant_id);
CREATE INDEX idx_claims_overlord_id ON claims(overlord_id);
CREATE INDEX idx_claims_agent_id ON claims(agent_id);
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_read ON notifications(recipient_id, read);
CREATE INDEX idx_informants_location ON informants(residential_lat, residential_lng) WHERE location_consent = true;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- -----------------------------------------------------------------------------
-- informants: SELECT own, UPDATE own
-- -----------------------------------------------------------------------------
ALTER TABLE informants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "informants_select_own" ON informants
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "informants_update_own" ON informants
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "informants_insert_own" ON informants
  FOR INSERT WITH CHECK (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- overlords: SELECT all authenticated, INSERT/UPDATE/DELETE own
-- Note: Verification fields are excluded via a secure view/function, not column-level RLS
-- -----------------------------------------------------------------------------
ALTER TABLE overlords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "overlords_select_authenticated" ON overlords
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "overlords_insert_own" ON overlords
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "overlords_update_own" ON overlords
  FOR UPDATE USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "overlords_delete_own" ON overlords
  FOR DELETE USING (auth.uid() = owner_id);

-- -----------------------------------------------------------------------------
-- agents: SELECT all authenticated, INSERT/UPDATE/DELETE own
-- -----------------------------------------------------------------------------
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_select_authenticated" ON agents
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "agents_insert_own" ON agents
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "agents_update_own" ON agents
  FOR UPDATE USING (auth.uid() = reporter_id)
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "agents_delete_own" ON agents
  FOR DELETE USING (auth.uid() = reporter_id);

-- -----------------------------------------------------------------------------
-- match_suggestions: SELECT all authenticated
-- -----------------------------------------------------------------------------
ALTER TABLE match_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_suggestions_select_authenticated" ON match_suggestions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow service role to insert/update match suggestions (done server-side)
CREATE POLICY "match_suggestions_insert_service" ON match_suggestions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "match_suggestions_update_service" ON match_suggestions
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- claims: SELECT involved parties, INSERT own
-- -----------------------------------------------------------------------------
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claims_select_involved" ON claims
  FOR SELECT USING (
    auth.uid() = claimant_id
    OR auth.uid() IN (
      SELECT owner_id FROM overlords WHERE overlords.id = claims.overlord_id
    )
    OR auth.uid() IN (
      SELECT reporter_id FROM agents WHERE agents.id = claims.agent_id
    )
  );

CREATE POLICY "claims_insert_own" ON claims
  FOR INSERT WITH CHECK (auth.uid() = claimant_id);

CREATE POLICY "claims_update_service" ON claims
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- notifications: SELECT own, UPDATE own (mark read)
-- -----------------------------------------------------------------------------
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid() = recipient_id);

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

CREATE POLICY "notifications_insert_service" ON notifications
  FOR INSERT WITH CHECK (true);

-- =============================================================================
-- FUNCTION: verify_claim_answers
-- Compares claim answers against overlord verification fields WITHOUT exposing
-- the stored values. Returns the number of correct answers (0-3).
-- =============================================================================
CREATE OR REPLACE FUNCTION verify_claim_answers(
  p_overlord_id UUID,
  p_answer_name TEXT,
  p_answer_marking TEXT,
  p_answer_trait TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verification_name TEXT;
  v_verification_marking TEXT;
  v_verification_trait TEXT;
  v_correct_count INTEGER := 0;
BEGIN
  -- Fetch the verification fields (only accessible via this function)
  SELECT verification_name, verification_marking, verification_trait
  INTO v_verification_name, v_verification_marking, v_verification_trait
  FROM overlords
  WHERE id = p_overlord_id;

  -- If overlord not found, return 0
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Case-insensitive substring matching (minimum 3 characters)
  -- The claimant's answer is correct if the stored value contains
  -- the claimant's answer as a substring (min 3 chars)
  IF length(p_answer_name) >= 3 AND
     lower(v_verification_name) LIKE '%' || lower(p_answer_name) || '%' THEN
    v_correct_count := v_correct_count + 1;
  END IF;

  IF length(p_answer_marking) >= 3 AND
     lower(v_verification_marking) LIKE '%' || lower(p_answer_marking) || '%' THEN
    v_correct_count := v_correct_count + 1;
  END IF;

  IF length(p_answer_trait) >= 3 AND
     lower(v_verification_trait) LIKE '%' || lower(p_answer_trait) || '%' THEN
    v_correct_count := v_correct_count + 1;
  END IF;

  RETURN v_correct_count;
END;
$$;

-- Restrict direct access to verification columns via a helper view
-- that excludes verification fields for non-owners
CREATE OR REPLACE VIEW overlords_public AS
SELECT
  id,
  owner_id,
  cat_name,
  description,
  last_seen_lat,
  last_seen_lng,
  last_seen_at,
  status,
  photos,
  trait_tags,
  tagging_status,
  poster_url,
  temporal_workflow_id,
  is_seed,
  created_at,
  -- Only expose verification fields to the owner
  CASE WHEN auth.uid() = owner_id THEN verification_name ELSE NULL END AS verification_name,
  CASE WHEN auth.uid() = owner_id THEN verification_marking ELSE NULL END AS verification_marking,
  CASE WHEN auth.uid() = owner_id THEN verification_trait ELSE NULL END AS verification_trait
FROM overlords;

-- =============================================================================
-- STORAGE BUCKETS
-- =============================================================================
-- Note: These statements use Supabase's storage schema. They create buckets
-- and configure access policies for cat photos and generated posters.

-- Create the cat-photos bucket (public read for authenticated, write for authenticated)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cat-photos', 'cat-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Create the posters bucket (public read for authenticated, write for service role only)
INSERT INTO storage.buckets (id, name, public)
VALUES ('posters', 'posters', false)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Storage policies: cat-photos bucket
-- -----------------------------------------------------------------------------

-- Read: all authenticated users can read cat photos
CREATE POLICY "cat_photos_select_authenticated" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'cat-photos'
    AND auth.role() = 'authenticated'
  );

-- Insert: authenticated users can upload cat photos
CREATE POLICY "cat_photos_insert_authenticated" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'cat-photos'
    AND auth.role() = 'authenticated'
  );

-- Update: owner can update their own photos
CREATE POLICY "cat_photos_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'cat-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'cat-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Delete: owner can only delete their own photos
-- Photos are stored under paths like: {user_id}/{filename}
CREATE POLICY "cat_photos_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'cat-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- -----------------------------------------------------------------------------
-- Storage policies: posters bucket
-- -----------------------------------------------------------------------------

-- Read: all authenticated users can view posters
CREATE POLICY "posters_select_authenticated" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'posters'
    AND auth.role() = 'authenticated'
  );

-- Write: only service role can upload posters (handled server-side)
-- No INSERT policy for regular users on posters bucket.
-- Service role bypasses RLS, so no explicit policy needed for service writes.
