// types/index.ts — Shared TypeScript interfaces for MEOWTRIX

// --- Status unions ---

export type PetType = 'cat' | 'dog';

export type OverlordStatus = 'active' | 'resolved';

export type AgentStatus = 'active' | 'resolved';

export type TaggingStatus = 'pending' | 'complete' | 'incomplete' | 'manual_review';

export type PatternType = 'solid' | 'tabby' | 'calico' | 'bicolor' | 'tortoiseshell' | 'pointed' | 'tuxedo' | 'merle' | 'brindle' | 'spotted' | 'sable' | 'harlequin';

export type FurLength = 'short' | 'medium' | 'long';

export type MatchSuggestionStatus = 'pending' | 'claimed' | 'resolved' | 'rejected';

export type ClaimStatus = 'pending' | 'verified' | 'rejected' | 'locked';

export type NotificationType =
  | 'match_alert'
  | 'escalation'
  | 'claim_initiated'
  | 'claim_verified'
  | 'claim_rejected'
  | 'claim_reminder'
  | 'claim_reverted'
  | 'overlord_resolved'
  | 'search_concluded';

// --- Core interfaces ---

export interface Informant {
  id: string;
  email: string;
  display_name: string;
  residential_area: string;
  residential_lat: number | null;
  residential_lng: number | null;
  location_consent: boolean;
  total_points: number;
  successful_matches: number;
  first_match_at: string | null;
  created_at: string;
}

export interface TraitTags {
  primary_color: string;
  secondary_color: string | null;
  pattern_type: PatternType;
  fur_length: FurLength;
  breed_estimate: string;
  distinguishing_features: string[]; // max 5
}

export interface Overlord {
  id: string;
  owner_id: string;
  pet_name: string;
  pet_type: PetType;
  description: string;
  last_seen_lat: number;
  last_seen_lng: number;
  /** Human-readable place label (e.g. "Silom, Bangkok"). Null for legacy rows. */
  last_seen_address: string | null;
  last_seen_at: string;
  status: OverlordStatus;
  photos: string[];
  trait_tags: TraitTags | null;
  tagging_status: TaggingStatus;
  verification_name: string;
  verification_marking: string;
  verification_trait: string;
  poster_url: string | null;
  is_seed: boolean;
  created_at: string;
}

export interface Agent {
  id: string;
  reporter_id: string;
  pet_type: PetType;
  description: string;
  sighting_lat: number;
  sighting_lng: number;
  /** Human-readable place label (e.g. "Chatuchak, Bangkok"). Null for legacy rows. */
  sighting_address: string | null;
  sighted_at: string;
  status: AgentStatus;
  photos: string[];
  trait_tags: TraitTags | null;
  tagging_status: TaggingStatus;
  is_seed: boolean;
  created_at: string;
}

export interface MatchSuggestion {
  id: string;
  overlord_id: string;
  agent_id: string;
  overall_score: number;
  visual_score: number;
  description_score: number;
  proximity_score: number;
  other_score: number;
  matched_traits: string[];
  status: MatchSuggestionStatus;
  created_at: string;
}

export interface Claim {
  id: string;
  match_suggestion_id: string;
  claimant_id: string;
  overlord_id: string;
  agent_id: string;
  answer_name: string;
  answer_marking: string;
  answer_trait: string;
  correct_count: number;
  status: ClaimStatus;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  informant_id: string;
  display_name: string;
  total_points: number;
  successful_matches: number;
  first_match_at: string | null;
  /** Email with the local-part masked (e.g. "j***@example.com"). */
  email_masked: string | null;
  /** Human-readable residential area, or null when the user opted out. */
  residential_area: string | null;
}
