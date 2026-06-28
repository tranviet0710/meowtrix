-- =============================================================================
-- MEOWTRIX — Add human-readable address columns
-- =============================================================================
-- Adds text address columns to overlords and agents so users see a place name
-- alongside (or instead of) raw lat/lng coordinates.
-- Existing rows keep NULL — UI falls back to coordinates when address is null.
-- =============================================================================

ALTER TABLE overlords
  ADD COLUMN IF NOT EXISTS last_seen_address TEXT NULL;

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS sighting_address TEXT NULL;

-- Recreate the public view to include the new address column.
-- (PostgreSQL requires DROP + CREATE when adding columns to a view.)
DROP VIEW IF EXISTS overlords_public;
CREATE VIEW overlords_public AS
SELECT
  id,
  owner_id,
  pet_name,
  pet_type,
  description,
  last_seen_lat,
  last_seen_lng,
  last_seen_address,
  last_seen_at,
  status,
  photos,
  trait_tags,
  tagging_status,
  poster_url,
  temporal_workflow_id,
  is_seed,
  created_at,
  CASE WHEN auth.uid() = owner_id THEN verification_name ELSE NULL END AS verification_name,
  CASE WHEN auth.uid() = owner_id THEN verification_marking ELSE NULL END AS verification_marking,
  CASE WHEN auth.uid() = owner_id THEN verification_trait ELSE NULL END AS verification_trait
FROM overlords;
