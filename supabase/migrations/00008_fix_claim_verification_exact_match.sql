-- =============================================================================
-- Migration: Fix claim verification to use exact matching instead of substring
-- =============================================================================
-- This migration updates the verify_claim_answers function to require exact
-- matches instead of substring matches, closing a security vulnerability where
-- attackers could pass verification with partial answers.
--
-- Security Issue: Previously, any 3+ character substring would pass verification
-- Fix: Now requires exact match (case-insensitive, whitespace-trimmed)
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

  -- Case-insensitive exact matching with whitespace normalization (minimum 3 characters)
  -- The claimant's answer is correct only if it exactly matches the stored value
  -- after trimming whitespace and converting to lowercase
  IF length(trim(p_answer_name)) >= 3 AND
     lower(trim(v_verification_name)) = lower(trim(p_answer_name)) THEN
    v_correct_count := v_correct_count + 1;
  END IF;

  IF length(trim(p_answer_marking)) >= 3 AND
     lower(trim(v_verification_marking)) = lower(trim(p_answer_marking)) THEN
    v_correct_count := v_correct_count + 1;
  END IF;

  IF length(trim(p_answer_trait)) >= 3 AND
     lower(trim(v_verification_trait)) = lower(trim(p_answer_trait)) THEN
    v_correct_count := v_correct_count + 1;
  END IF;

  RETURN v_correct_count;
END;
$$;
