-- Add last_active_at column to informants for tracking online status
ALTER TABLE informants ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT now();

-- Update existing rows to have a default value
UPDATE informants SET last_active_at = COALESCE(last_active_at, created_at, now());

-- Create index for efficient filtering by last_active_at
CREATE INDEX IF NOT EXISTS idx_informants_last_active_at ON informants (last_active_at);

-- Allow sighted_at to be user-provided (no schema change needed, it's already timestamptz)
-- The change is in the API layer to accept user input instead of auto-generating.
