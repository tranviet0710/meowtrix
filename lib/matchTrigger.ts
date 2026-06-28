// lib/matchTrigger.ts — Trigger match evaluation when records get trait tags

import { calculateMatchScore } from "@/lib/matchEngine";
import type { Overlord, Agent } from "@/types";
import { SupabaseClient } from "@supabase/supabase-js";

const MATCH_THRESHOLD = 60;
const MAX_SUGGESTIONS_PER_OVERLORD = 10;

/**
 * Creates a notification for an informant about a new match suggestion.
 */
async function createMatchNotification(
  supabase: SupabaseClient,
  recipientId: string,
  matchId: string,
  overallScore: number,
  overlordName: string,
  photoUrl: string | null
): Promise<void> {
  await supabase.from("notifications").insert({
    recipient_id: recipientId,
    type: "match_alert",
    title: "New Match Detected",
    body: `A potential match has been found for "${overlordName}" with a ${overallScore}% confidence score.`,
    metadata: {
      match_suggestion_id: matchId,
      overall_score: overallScore,
      photo_thumbnail: photoUrl,
    },
    read: false,
  });
}

/**
 * Enforces the maximum 10 suggestions per Overlord rule.
 * If an Overlord already has 10 suggestions, removes the lowest-scoring one
 * only if the new score is higher.
 *
 * @returns true if the new suggestion can be inserted, false otherwise.
 */
async function enforceMaxSuggestionsPerOverlord(
  supabase: SupabaseClient,
  overlordId: string,
  newScore: number
): Promise<boolean> {
  const { data: existing, error } = await supabase
    .from("match_suggestions")
    .select("id, overall_score")
    .eq("overlord_id", overlordId)
    .order("overall_score", { ascending: true });

  if (error || !existing) {
    if (error) {
      console.error(`[MatchTrigger] enforceMaxSuggestionsPerOverlord query failed for overlord ${overlordId}: ${error.message}`, error);
    }
    return true; // Allow insertion if we can't verify
  }

  if (existing.length < MAX_SUGGESTIONS_PER_OVERLORD) {
    return true;
  }

  // Already at max capacity — check if new score beats the lowest
  const lowest = existing[0];
  if (newScore > lowest.overall_score) {
    // Remove lowest to make room
    await supabase.from("match_suggestions").delete().eq("id", lowest.id);
    return true;
  }

  return false;
}

/**
 * Check if a match suggestion already exists for this overlord + agent pair.
 */
async function isDuplicate(
  supabase: SupabaseClient,
  overlordId: string,
  agentId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("match_suggestions")
    .select("id")
    .eq("overlord_id", overlordId)
    .eq("agent_id", agentId)
    .limit(1);

  if (error) {
    console.error(`[MatchTrigger] isDuplicate query failed for overlord ${overlordId}, agent ${agentId}: ${error.message}`, error);
    return false;
  }

  return data !== null && data.length > 0;
}

/**
 * Trigger match evaluation for a newly tagged Agent.
 * Compares the Agent against all unresolved Overlords with complete trait tags.
 * Only matches within the same pet_type (cat↔cat, dog↔dog).
 */
async function evaluateAgentAgainstOverlords(
  supabase: SupabaseClient,
  agent: Agent
): Promise<void> {
  // Fetch all unresolved overlords with complete trait tags, filtered by pet_type
  const { data: overlords, error } = await supabase
    .from("overlords")
    .select("*")
    .eq("status", "active")
    .eq("tagging_status", "complete")
    .eq("pet_type", agent.pet_type)
    .not("trait_tags", "is", null);

  if (error) {
    console.error(`[MatchTrigger] evaluateAgentAgainstOverlords query failed for agent ${agent.id}: ${error.message}`, error);
    return;
  }

  if (!overlords || overlords.length === 0) {
    console.log(`[MatchTrigger] No active overlords with complete trait tags found for agent ${agent.id} (pet_type=${agent.pet_type})`);
    return;
  }

  for (const overlord of overlords as Overlord[]) {
    await processMatchPair(supabase, overlord, agent);
  }
}

/**
 * Trigger match evaluation for a newly tagged Overlord.
 * Compares the Overlord against all unresolved Agents with complete trait tags.
 * Only matches within the same pet_type (cat↔cat, dog↔dog).
 */
async function evaluateOverlordAgainstAgents(
  supabase: SupabaseClient,
  overlord: Overlord
): Promise<void> {
  // Fetch all unresolved agents with complete trait tags, filtered by pet_type
  const { data: agents, error } = await supabase
    .from("agents")
    .select("*")
    .eq("status", "active")
    .eq("tagging_status", "complete")
    .eq("pet_type", overlord.pet_type)
    .not("trait_tags", "is", null);

  if (error) {
    console.error(`[MatchTrigger] evaluateOverlordAgainstAgents query failed for overlord ${overlord.id}: ${error.message}`, error);
    return;
  }

  if (!agents || agents.length === 0) {
    console.log(`[MatchTrigger] No active agents with complete trait tags found for overlord ${overlord.id} (pet_type=${overlord.pet_type})`);
    return;
  }

  for (const agent of agents as Agent[]) {
    await processMatchPair(supabase, overlord, agent);
  }
}

/**
 * Process a single Overlord-Agent pair: calculate score, check threshold,
 * prevent duplicates, enforce cap, persist, and notify.
 */
async function processMatchPair(
  supabase: SupabaseClient,
  overlord: Overlord,
  agent: Agent
): Promise<void> {
  // Skip records without trait tags
  if (!overlord.trait_tags || !agent.trait_tags) {
    return;
  }

  const result = calculateMatchScore(overlord, agent);

  // Only persist matches with score >= 60
  if (result.overall_score < MATCH_THRESHOLD) {
    return;
  }

  // Check for existing duplicate (same overlord_id + agent_id pair)
  const duplicate = await isDuplicate(supabase, overlord.id, agent.id);
  if (duplicate) {
    return;
  }

  // Enforce max 10 suggestions per Overlord
  const canInsert = await enforceMaxSuggestionsPerOverlord(
    supabase,
    overlord.id,
    result.overall_score
  );
  if (!canInsert) {
    return;
  }

  // Persist the match suggestion
  const { data: insertedMatch, error: insertError } = await supabase
    .from("match_suggestions")
    .insert({
      overlord_id: overlord.id,
      agent_id: agent.id,
      overall_score: result.overall_score,
      visual_score: result.visual_score,
      description_score: result.description_score,
      proximity_score: result.proximity_score,
      other_score: result.other_score,
      matched_traits: result.matched_traits,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !insertedMatch) {
    console.error(`[MatchTrigger] Failed to insert match_suggestion for overlord ${overlord.id} + agent ${agent.id}: ${insertError?.message ?? "No data returned"}`, insertError);
    return;
  }

  // Send notifications to both the Overlord owner and the Agent reporter
  const matchId = insertedMatch.id;
  const photoUrl = overlord.photos.length > 0 ? overlord.photos[0] : null;

  // Notify the Overlord owner
  await createMatchNotification(
    supabase,
    overlord.owner_id,
    matchId,
    result.overall_score,
    overlord.pet_name,
    photoUrl
  );

  // Notify the Agent reporter
  const agentPhotoUrl = agent.photos.length > 0 ? agent.photos[0] : null;
  await createMatchNotification(
    supabase,
    agent.reporter_id,
    matchId,
    result.overall_score,
    overlord.pet_name,
    agentPhotoUrl
  );
}

/**
 * Main entry point: trigger match evaluation when a record gets trait tags.
 * Call this from the vision processing route after tags are successfully extracted.
 *
 * @param supabase - Supabase client (service role recommended for bypassing RLS)
 * @param recordId - ID of the record that just received trait tags
 * @param recordType - Whether the record is an 'overlord' or 'agent'
 */
export async function triggerMatchEvaluation(
  supabase: SupabaseClient,
  recordId: string,
  recordType: "overlord" | "agent"
): Promise<void> {
  if (recordType === "agent") {
    // Fetch the agent record
    const { data: agent, error } = await supabase
      .from("agents")
      .select("*")
      .eq("id", recordId)
      .single();

    if (error || !agent) {
      console.error(`[MatchTrigger] triggerMatchEvaluation failed to fetch agent ${recordId}: ${error?.message ?? "No data returned"}`, error);
      return;
    }

    // Skip records without complete trait tags
    if (agent.tagging_status !== "complete" || !agent.trait_tags) {
      console.warn(`[MatchTrigger] Agent ${recordId} skipped: tagging_status=${agent.tagging_status}, trait_tags=${agent.trait_tags ? "present" : "null"}`);
      return;
    }

    await evaluateAgentAgainstOverlords(supabase, agent as Agent);
  } else {
    // Fetch the overlord record
    const { data: overlord, error } = await supabase
      .from("overlords")
      .select("*")
      .eq("id", recordId)
      .single();

    if (error || !overlord) {
      console.error(`[MatchTrigger] triggerMatchEvaluation failed to fetch overlord ${recordId}: ${error?.message ?? "No data returned"}`, error);
      return;
    }

    // Skip records without complete trait tags
    if (overlord.tagging_status !== "complete" || !overlord.trait_tags) {
      console.warn(`[MatchTrigger] Overlord ${recordId} skipped: tagging_status=${overlord.tagging_status}, trait_tags=${overlord.trait_tags ? "present" : "null"}`);
      return;
    }

    await evaluateOverlordAgainstAgents(supabase, overlord as Overlord);
  }
}
