// app/api/matches/[id]/claim/route.ts — POST initiate claim on a match suggestion

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabaseServer";
import {
  isLockedOut,
  calculateLockoutExpiry,
  MAX_FAILED_ATTEMPTS,
} from "@/lib/claimVerification";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/matches/[id]/claim
 *
 * Initiates a claim on a match suggestion. Only the Overlord owner can claim.
 * Checks lockout status before allowing a new claim.
 * Returns a claim_id for the verification step.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: matchId } = await params;
    const supabase = await createClient();

    // Verify the user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the match suggestion with overlord data
    const serviceClient = await createServiceRoleClient();
    const { data: match, error: matchError } = await serviceClient
      .from("match_suggestions")
      .select(`
        id,
        overlord_id,
        agent_id,
        status,
        overlords:overlord_id (
          id,
          owner_id,
          status
        )
      `)
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      if (matchError?.code === "PGRST116") {
        return NextResponse.json(
          { error: "Match suggestion not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Match suggestion not found" },
        { status: 404 }
      );
    }

    // Verify claimant is the Overlord owner
    // Supabase returns single-row relations as an object (not array) when using FK joins
    const overlord = match.overlords as unknown as { id: string; owner_id: string; status: string } | null;
    if (!overlord || overlord.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: Only the Overlord owner can initiate a claim" },
        { status: 403 }
      );
    }

    // Check if overlord is already resolved
    if (overlord.status === "resolved") {
      return NextResponse.json(
        { error: "Cannot claim: Overlord has already been resolved" },
        { status: 409 }
      );
    }

    // Check if match is still pending
    if (match.status !== "pending" && match.status !== "claimed") {
      return NextResponse.json(
        { error: `Cannot claim: Match suggestion is ${match.status}` },
        { status: 409 }
      );
    }

    // Check lockout: count failed claims for this user on this overlord
    const { data: existingClaims, error: claimsError } = await serviceClient
      .from("claims")
      .select("id, failed_attempts, locked_until, status")
      .eq("claimant_id", user.id)
      .eq("overlord_id", match.overlord_id);

    if (claimsError) {
      return NextResponse.json(
        { error: "Failed to check claim history" },
        { status: 500 }
      );
    }

    // Calculate total failed attempts across all claims for this overlord
    const totalFailedAttempts = (existingClaims || []).reduce(
      (sum, claim) => sum + (claim.failed_attempts || 0),
      0
    );

    // Check if any existing claim has an active lockout
    const lockedClaim = (existingClaims || []).find(
      (claim) =>
        claim.failed_attempts >= MAX_FAILED_ATTEMPTS && claim.locked_until
    );

    if (lockedClaim && isLockedOut(lockedClaim.failed_attempts, lockedClaim.locked_until)) {
      return NextResponse.json(
        {
          error: "Locked out: Too many failed verification attempts",
          locked_until: lockedClaim.locked_until,
        },
        { status: 429 }
      );
    }

    // Check if total failed attempts across all claims exceeds threshold
    if (totalFailedAttempts >= MAX_FAILED_ATTEMPTS) {
      // Check if lockout period is still active on any claim
      const anyActiveLock = (existingClaims || []).some(
        (claim) => claim.locked_until && new Date(claim.locked_until) > new Date()
      );

      if (anyActiveLock) {
        const lockExpiry = (existingClaims || [])
          .filter((c) => c.locked_until)
          .map((c) => c.locked_until)
          .sort()
          .pop();
        return NextResponse.json(
          {
            error: "Locked out: Too many failed verification attempts",
            locked_until: lockExpiry,
          },
          { status: 429 }
        );
      }
      // Lockout expired — reset is handled implicitly (new claim starts fresh)
    }

    // Check for an existing pending claim on this match by this user
    const existingPending = (existingClaims || []).find(
      (claim) => claim.status === "pending"
    );

    if (existingPending) {
      // Return the existing pending claim
      return NextResponse.json({
        claim_id: existingPending.id,
        message: "Existing pending claim found",
      });
    }

    // Create the claim record
    const { data: newClaim, error: insertError } = await serviceClient
      .from("claims")
      .insert({
        match_suggestion_id: matchId,
        claimant_id: user.id,
        overlord_id: match.overlord_id,
        agent_id: match.agent_id,
        answer_name: "",
        answer_marking: "",
        answer_trait: "",
        correct_count: 0,
        status: "pending",
        failed_attempts: 0,
        locked_until: null,
      })
      .select("id")
      .single();

    if (insertError || !newClaim) {
      return NextResponse.json(
        { error: `Failed to create claim: ${insertError?.message || "Unknown error"}` },
        { status: 500 }
      );
    }

    // Update match status to claimed
    await serviceClient
      .from("match_suggestions")
      .update({ status: "claimed" })
      .eq("id", matchId);

    return NextResponse.json(
      {
        claim_id: newClaim.id,
        message: "Claim initiated. Submit verification answers to proceed.",
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to initiate claim: ${message}` },
      { status: 500 }
    );
  }
}
