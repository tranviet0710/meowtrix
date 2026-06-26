// app/api/claims/[id]/verify/route.ts — POST submit verification answers for a claim

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabaseServer";
import { claimAnswersSchema } from "@/lib/validators";
import {
  verifyClaimAnswers,
  isClaimVerified,
  isLockedOut,
  calculateLockoutExpiry,
  MAX_FAILED_ATTEMPTS,
} from "@/lib/claimVerification";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/claims/[id]/verify
 *
 * Submit 3 verification answers for a claim.
 * Compares answers against stored verification fields on the Overlord.
 * If ≥ 2/3 correct → mark verified, notify Agent reporter.
 * If < 2/3 → reject, increment failed_attempts.
 * If 3 total failures → lock for 24 hours.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: claimId } = await params;
    const supabase = await createClient();

    // Verify the user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate the request body
    const body = await request.json();
    const parseResult = claimAnswersSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { answer_name, answer_marking, answer_trait } = parseResult.data;

    // Use service role to access verification fields (bypasses RLS column exclusion)
    const serviceClient = await createServiceRoleClient();

    // Fetch the claim
    const { data: claim, error: claimError } = await serviceClient
      .from("claims")
      .select("*")
      .eq("id", claimId)
      .single();

    if (claimError || !claim) {
      return NextResponse.json(
        { error: "Claim not found" },
        { status: 404 }
      );
    }

    // Verify the user is the claimant
    if (claim.claimant_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You are not the claimant" },
        { status: 403 }
      );
    }

    // Check claim status — only pending claims can be verified
    if (claim.status !== "pending") {
      return NextResponse.json(
        { error: `Cannot verify: Claim is already ${claim.status}` },
        { status: 409 }
      );
    }

    // Check lockout on this claim
    if (isLockedOut(claim.failed_attempts, claim.locked_until)) {
      return NextResponse.json(
        {
          error: "Locked out: Too many failed verification attempts",
          locked_until: claim.locked_until,
        },
        { status: 429 }
      );
    }

    // Also check total failed attempts across all claims for this overlord by this user
    const { data: allClaims } = await serviceClient
      .from("claims")
      .select("failed_attempts, locked_until")
      .eq("claimant_id", user.id)
      .eq("overlord_id", claim.overlord_id);

    const totalFailedAttempts = (allClaims || []).reduce(
      (sum, c) => sum + (c.failed_attempts || 0),
      0
    );

    const anyActiveLock = (allClaims || []).some(
      (c) => c.locked_until && new Date(c.locked_until) > new Date()
    );

    if (totalFailedAttempts >= MAX_FAILED_ATTEMPTS && anyActiveLock) {
      const lockExpiry = (allClaims || [])
        .filter((c) => c.locked_until)
        .map((c) => c.locked_until as string)
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

    // Fetch the Overlord verification fields (using service role to access hidden fields)
    const { data: overlord, error: overlordError } = await serviceClient
      .from("overlords")
      .select("verification_name, verification_marking, verification_trait, status")
      .eq("id", claim.overlord_id)
      .single();

    if (overlordError || !overlord) {
      return NextResponse.json(
        { error: "Overlord not found" },
        { status: 404 }
      );
    }

    // Check if overlord was resolved while claim was pending
    if (overlord.status === "resolved") {
      await serviceClient
        .from("claims")
        .update({ status: "rejected" })
        .eq("id", claimId);

      return NextResponse.json(
        { error: "Cannot verify: Overlord has already been resolved" },
        { status: 409 }
      );
    }

    // Verify the answers
    const correctCount = verifyClaimAnswers(
      {
        name: overlord.verification_name,
        marking: overlord.verification_marking,
        trait: overlord.verification_trait,
      },
      {
        name: answer_name,
        marking: answer_marking,
        trait: answer_trait,
      }
    );

    const verified = isClaimVerified(correctCount);

    // Update the claim with answers and result
    if (verified) {
      // Mark claim as verified
      await serviceClient
        .from("claims")
        .update({
          answer_name,
          answer_marking,
          answer_trait,
          correct_count: correctCount,
          status: "verified",
        })
        .eq("id", claimId);

      // Update match suggestion status to resolved
      await serviceClient
        .from("match_suggestions")
        .update({ status: "resolved" })
        .eq("id", claim.match_suggestion_id);

      // Notify the Agent reporter about the verified claim
      const { data: agent } = await serviceClient
        .from("agents")
        .select("reporter_id")
        .eq("id", claim.agent_id)
        .single();

      if (agent) {
        await serviceClient.from("notifications").insert({
          recipient_id: agent.reporter_id,
          type: "claim_verified",
          title: "Claim Verified — Agent Matched!",
          body: "An Overlord owner has verified their claim on your Agent sighting. The owner will contact you to arrange pickup.",
          metadata: {
            claim_id: claimId,
            overlord_id: claim.overlord_id,
            agent_id: claim.agent_id,
          },
          read: false,
        });
      }

      // Award 10 points to the Agent reporter
      if (agent) {
        // Try RPC first, fall back to manual update
        const { error: rpcError } = await serviceClient.rpc(
          "increment_informant_points",
          {
            informant_id: agent.reporter_id,
            points_to_add: 10,
          }
        );

        if (rpcError) {
          // Fallback: manual increment if RPC doesn't exist
          const { data: informant } = await serviceClient
            .from("informants")
            .select("total_points, successful_matches, first_match_at")
            .eq("id", agent.reporter_id)
            .single();

          if (informant) {
            const updateData: Record<string, unknown> = {
              total_points: (informant.total_points || 0) + 10,
              successful_matches: (informant.successful_matches || 0) + 1,
            };

            // Only set first_match_at on the very first successful match
            if (!informant.first_match_at) {
              updateData.first_match_at = new Date().toISOString();
            }

            await serviceClient
              .from("informants")
              .update(updateData)
              .eq("id", agent.reporter_id);
          }
        }
      }

      return NextResponse.json({
        status: "verified",
        correct_count: correctCount,
        message: "Verification successful! The Agent reporter has been notified.",
      });
    } else {
      // Increment failed attempts
      const newFailedAttempts = (claim.failed_attempts || 0) + 1;
      const shouldLock = newFailedAttempts >= MAX_FAILED_ATTEMPTS;

      const updateData: Record<string, unknown> = {
        answer_name,
        answer_marking,
        answer_trait,
        correct_count: correctCount,
        status: shouldLock ? "locked" : "rejected",
        failed_attempts: newFailedAttempts,
      };

      if (shouldLock) {
        updateData.locked_until = calculateLockoutExpiry();
      }

      await serviceClient
        .from("claims")
        .update(updateData)
        .eq("id", claimId);

      // Notify the claimant about failed verification
      await serviceClient.from("notifications").insert({
        recipient_id: user.id,
        type: "claim_rejected",
        title: "Claim Verification Failed",
        body: shouldLock
          ? "Verification failed. You have been locked out from further attempts on this Overlord for 24 hours."
          : "Verification failed. Please check your answers and try again.",
        metadata: {
          claim_id: claimId,
          overlord_id: claim.overlord_id,
          failed_attempts: newFailedAttempts,
          locked: shouldLock,
        },
        read: false,
      });

      if (shouldLock) {
        return NextResponse.json(
          {
            status: "locked",
            correct_count: correctCount,
            failed_attempts: newFailedAttempts,
            locked_until: updateData.locked_until,
            message:
              "Verification failed. Too many attempts — locked for 24 hours.",
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          status: "rejected",
          correct_count: correctCount,
          failed_attempts: newFailedAttempts,
          message:
            "Verification failed. Please check your answers and try again.",
        },
        { status: 200 }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to verify claim: ${message}` },
      { status: 500 }
    );
  }
}
