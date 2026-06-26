-- =============================================================================
-- MEOWTRIX — Add pet_type support (cats + dogs)
-- =============================================================================
-- Adds pet_type column to overlords and agents tables
-- Renames cat_name to pet_name in overlords table
-- Renames cat-photos storage bucket to pet-photos
-- =============================================================================

-- Add pet_type column to overlords
ALTER TABLE overlords
  ADD COLUMN pet_type TEXT NOT NULL DEFAULT 'cat' CHECK (pet_type IN ('cat', 'dog'));

-- Add pet_type column to agents
ALTER TABLE agents
  ADD COLUMN pet_type TEXT NOT NULL DEFAULT 'cat' CHECK (pet_type IN ('cat', 'dog'));

-- Rename cat_name to pet_name
ALTER TABLE overlords RENAME COLUMN cat_name TO pet_name;

-- Update the overlords_public view to reflect the column rename
-- Must DROP + CREATE because PostgreSQL doesn't allow renaming columns via CREATE OR REPLACE VIEW
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

-- Create pet-photos bucket (keep cat-photos for backward compatibility)
INSERT INTO storage.buckets (id, name, public)
VALUES ('pet-photos', 'pet-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for pet-photos bucket
CREATE POLICY "pet_photos_select_authenticated" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'pet-photos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "pet_photos_insert_authenticated" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pet-photos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "pet_photos_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'pet-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'pet-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "pet_photos_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'pet-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Add indexes for pet_type filtering
CREATE INDEX idx_overlords_pet_type ON overlords(pet_type);
CREATE INDEX idx_agents_pet_type ON agents(pet_type);
