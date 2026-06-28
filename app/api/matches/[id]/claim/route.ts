// app/api/matches/[id]/claim/route.ts — POST initiate claim, PATCH update claim status

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabaseServer";
import { sendClaimEmails, sendEmail, type ClaimEmailSendResult } from "@/lib/email";
import { Connection, Client, WorkflowExecutionAlreadyStartedError } from "@temporalio/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/matches/[id]/claim
 *
 * Initiates a claim on a match suggestion. Only the Overlord owner can claim.
 * - Marks match status as "claimed"
 * - Sends notification + email to both parties with each other's contact info
 * - Starts a 24h Temporal reminder workflow
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

    // Fetch the match suggestion with overlord and agent data
    const serviceClient = await createServiceRoleClient();
    const { data: match, error: matchError } = await serviceClient
      .from("match_suggestions")
      .select(`
        id,
        overlord_id,
        agent_id,
        overall_score,
        status,
        overlords:overlord_id (
          id,
          owner_id,
          pet_name,
          status
        ),
        agents:agent_id (
          id,
          reporter_id
        )
      `)
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json(
        { error: "Match suggestion not found" },
        { status: 404 }
      );
    }

    // Verify claimant is the Overlord owner
    const overlord = match.overlords as unknown as {
      id: string;
      owner_id: string;
      pet_name: string;
      status: string;
    } | null;
    const agent = match.agents as unknown as {
      id: string;
      reporter_id: string;
    } | null;

    if (!overlord || overlord.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: Only the Overlord owner can initiate a claim" },
        { status: 403 }
      );
    }

    if (!agent) {
      return NextResponse.json(
        { error: "Agent data not found for this match" },
        { status: 500 }
      );
    }

    // Check if overlord is already resolved
    if (overlord.status === "resolved") {
      return NextResponse.json(
        { error: "Cannot claim: Overlord has already been resolved" },
        { status: 409 }
      );
    }

    // Check if match is claimable (must be pending)
    if (match.status !== "pending") {
      return NextResponse.json(
        { error: `Cannot claim: Match is already ${match.status}` },
        { status: 409 }
      );
    }

    // Update match status to claimed
    await serviceClient
      .from("match_suggestions")
      .update({ status: "claimed" })
      .eq("id", matchId);

    // Fetch informant details for both parties
    const { data: ownerInfo, error: ownerInfoError } = await serviceClient
      .from("informants")
      .select("id, email, display_name")
      .eq("id", overlord.owner_id)
      .single();

    const { data: reporterInfo, error: reporterInfoError } = await serviceClient
      .from("informants")
      .select("id, email, display_name")
      .eq("id", agent.reporter_id)
      .single();

    if (!ownerInfo) {
      console.error(
        `[Claim ${matchId}] Owner informant row missing for owner_id=${overlord.owner_id}`,
        ownerInfoError
      );
    }
    if (!reporterInfo) {
      console.error(
        `[Claim ${matchId}] Reporter informant row missing for reporter_id=${agent.reporter_id}`,
        reporterInfoError
      );
    }

    let emailResults: ClaimEmailSendResult[] = [];

    // Insert in-app notifications and send emails per-recipient independently.
    // If one informant row is missing (data integrity issue), we still notify
    // the side we *do* have info for instead of skipping both.
    const notificationsToInsert: Array<Record<string, unknown>> = [];

    if (ownerInfo) {
      const finderName = reporterInfo?.display_name ?? "an informant";
      notificationsToInsert.push({
        recipient_id: ownerInfo.id,
        type: "claim_initiated",
        title: `🎯 Claim Initiated — ${overlord.pet_name}`,
        body: `You've claimed a match for ${overlord.pet_name}. The finder (${finderName}) has been notified. Check your email for their contact details to schedule a meetup.`,
        metadata: { match_id: matchId, overlord_id: overlord.id },
        read: false,
      });
    }
    if (reporterInfo) {
      notificationsToInsert.push({
        recipient_id: reporterInfo.id,
        type: "claim_initiated",
        title: `🎯 Someone claimed the pet you found!`,
        body: `The owner of ${overlord.pet_name}${ownerInfo ? ` (${ownerInfo.display_name})` : ""} has initiated a claim. Check your email for their contact details to schedule a meetup.`,
        metadata: { match_id: matchId, agent_id: agent.id },
        read: false,
      });
    }

    if (notificationsToInsert.length > 0) {
      const { error: notifError } = await serviceClient
        .from("notifications")
        .insert(notificationsToInsert);
      if (notifError) {
        console.error(`[Claim ${matchId}] Failed to insert notifications:`, notifError);
      }
    }

    // Send claim emails. When both sides are available, use the joint helper
    // so each email contains the other party's contact info. When only one side
    // is available (data integrity issue), send a degraded single-recipient
    // notice so the claim is at least surfaced via email.
    if (ownerInfo?.email && reporterInfo?.email) {
      try {
        console.log(
          `[Claim ${matchId}] Dispatching claim emails to owner=${ownerInfo.email} and reporter=${reporterInfo.email}`
        );
        emailResults = await sendClaimEmails({
          overlordOwnerEmail: ownerInfo.email,
          overlordOwnerName: ownerInfo.display_name,
          agentReporterEmail: reporterInfo.email,
          agentReporterName: reporterInfo.display_name,
          petName: overlord.pet_name,
          matchId,
          matchScore: match.overall_score,
        });
        const failed = emailResults.filter((r) => r.status === "failed");
        if (failed.length > 0) {
          console.error(
            `[Claim ${matchId}] ${failed.length}/${emailResults.length} claim email(s) failed:`,
            failed
          );
        }
      } catch (emailError) {
        console.error(
          `[Claim ${matchId}] Unexpected error from sendClaimEmails:`,
          emailError
        );
      }
    } else {
      console.warn(
        `[Claim ${matchId}] Partial informant data — sending degraded single-recipient notice(s)`,
        {
          haveOwnerEmail: !!ownerInfo?.email,
          haveReporterEmail: !!reporterInfo?.email,
        }
      );

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://meowtrix.io";
      const matchUrl = `${appUrl}/matches/${matchId}`;

      // Tell whoever we can reach that the claim was initiated, even if the
      // other party's contact is unavailable.
      const recipients: Array<{
        email: string;
        name: string;
        role: ClaimEmailSendResult["role"];
      }> = [];
      if (ownerInfo?.email) {
        recipients.push({
          email: ownerInfo.email,
          name: ownerInfo.display_name,
          role: "overlord_owner",
        });
      }
      if (reporterInfo?.email) {
        recipients.push({
          email: reporterInfo.email,
          name: reporterInfo.display_name,
          role: "agent_reporter",
        });
      }

      for (const r of recipients) {
        try {
          const { id } = await sendEmail({
            to: r.email,
            subject: `🎯 Claim Initiated — ${overlord.pet_name}`,
            html: `
              <div style="font-family: monospace; background: #0A0A0F; color: #E6E6E6; padding: 32px; max-width: 600px;">
                <h1 style="color: #FFCC00; font-size: 18px; text-transform: uppercase; letter-spacing: 2px;">⚡ CLAIM INITIATED</h1>
                <p>Hello, <strong>${r.name}</strong>!</p>
                <p>A claim has been initiated on the match for <strong style="color: #FFCC00;">${overlord.pet_name}</strong>.</p>
                <p style="color: #FF4444;">The other party's contact information is currently unavailable. Please coordinate via the match page until this is resolved.</p>
                <p style="margin-top: 24px;">
                  <a href="${matchUrl}" style="display: inline-block; background: #FFCC00; color: #0A0A0F; padding: 12px 24px; text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">View Match Details</a>
                </p>
              </div>
            `,
          });
          emailResults.push({
            recipient: r.email,
            role: r.role,
            status: "sent",
            messageId: id ?? undefined,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[Claim ${matchId}] Degraded send to ${r.email} failed:`, message);
          emailResults.push({
            recipient: r.email,
            role: r.role,
            status: "failed",
            error: message,
          });
        }
      }
    }

    // Start the 24h claim reminder Temporal workflow (non-blocking)
    try {
      const temporalAddress = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
      const connection = await Connection.connect({ address: temporalAddress });
      const client = new Client({ connection });

      await client.workflow.start("claimReminderWorkflow", {
        args: [matchId],
        taskQueue: process.env.TEMPORAL_TASK_QUEUE ?? "meowtrix-search-protocol",
        workflowId: `claim-reminder-${matchId}`,
      });
    } catch (temporalError) {
      if (temporalError instanceof WorkflowExecutionAlreadyStartedError) {
        // Expected when the same match is claimed again — the reminder is already scheduled.
        console.log(
          `[Claim ${matchId}] Reminder workflow already running for this match; skipping start.`
        );
      } else {
        // Log but don't block the claim — reminder is non-critical
        console.error(`[Claim ${matchId}] Failed to start reminder workflow:`, temporalError);
      }
    }

    const sentCount = emailResults.filter((r) => r.status === "sent").length;
    const failedCount = emailResults.filter((r) => r.status === "failed").length;

    return NextResponse.json(
      {
        success: true,
        message:
          sentCount > 0 && failedCount === 0
            ? "Claim initiated. Both parties have been notified via email."
            : sentCount > 0
            ? `Claim initiated. ${sentCount} of ${sentCount + failedCount} email(s) were delivered.`
            : "Claim initiated, but no emails could be sent. Check the in-app inbox.",
        emails: emailResults,
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

/**
 * PATCH /api/matches/[id]/claim
 *
 * Update the claim status. Either party can revert (set back to pending)
 * or the overlord owner can resolve (mark overlord as resolved + award points).
 *
 * Body: { action: "revert" | "resolve" }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json();
    const action = body.action as string;

    if (action !== "revert" && action !== "resolve") {
      return NextResponse.json(
        { error: "Invalid action. Must be 'revert' or 'resolve'" },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceRoleClient();

    // Fetch match with overlord and agent data
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
          pet_name
        ),
        agents:agent_id (
          id,
          reporter_id
        )
      `)
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json(
        { error: "Match suggestion not found" },
        { status: 404 }
      );
    }

    // Must be in claimed state to revert or resolve
    if (match.status !== "claimed") {
      return NextResponse.json(
        { error: `Cannot update: Match is ${match.status}, not claimed` },
        { status: 409 }
      );
    }

    const overlord = match.overlords as unknown as {
      id: string;
      owner_id: string;
      pet_name: string;
    } | null;
    const agent = match.agents as unknown as {
      id: string;
      reporter_id: string;
    } | null;

    if (!overlord || !agent) {
      return NextResponse.json(
        { error: "Match data incomplete" },
        { status: 500 }
      );
    }

    // Either party can revert or resolve
    const isOwner = overlord.owner_id === user.id;
    const isReporter = agent.reporter_id === user.id;

    if (!isOwner && !isReporter) {
      return NextResponse.json(
        { error: "Forbidden: Only involved parties can update claim status" },
        { status: 403 }
      );
    }

    if (action === "revert") {
      // Revert match back to pending
      await serviceClient
        .from("match_suggestions")
        .update({ status: "pending" })
        .eq("id", matchId);

      // Notify the other party
      const otherPartyId = isOwner ? agent.reporter_id : overlord.owner_id;
      await serviceClient.from("notifications").insert({
        recipient_id: otherPartyId,
        type: "claim_reverted",
        title: `↩️ Claim Reverted — ${overlord.pet_name}`,
        body: "The claim has been reverted. The match is available again for claiming.",
        metadata: { match_id: matchId },
        read: false,
      });

      return NextResponse.json({
        success: true,
        status: "pending",
        message: "Claim reverted. Match is available again.",
      });
    }

    if (action === "resolve") {
      // Only the overlord owner can resolve
      if (!isOwner) {
        return NextResponse.json(
          { error: "Forbidden: Only the Overlord owner can resolve" },
          { status: 403 }
        );
      }

      // Mark match as resolved
      await serviceClient
        .from("match_suggestions")
        .update({ status: "resolved" })
        .eq("id", matchId);

      // Mark overlord as resolved
      await serviceClient
        .from("overlords")
        .update({ status: "resolved" })
        .eq("id", overlord.id);

      // Award 10 points to the agent reporter
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
        if (!informant.first_match_at) {
          updateData.first_match_at = new Date().toISOString();
        }
        await serviceClient
          .from("informants")
          .update(updateData)
          .eq("id", agent.reporter_id);
      }

      // Notify the agent reporter
      await serviceClient.from("notifications").insert({
        recipient_id: agent.reporter_id,
        type: "overlord_resolved",
        title: `🏠 Overlord Reunited — ${overlord.pet_name}!`,
        body: `Great news! ${overlord.pet_name} has been reunited with their owner. You've earned 10 points for your help!`,
        metadata: { match_id: matchId, overlord_id: overlord.id, points_awarded: 10 },
        read: false,
      });

      return NextResponse.json({
        success: true,
        status: "resolved",
        message: "Overlord reunited! Points awarded to the finder.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to update claim: ${message}` },
      { status: 500 }
    );
  }
}
