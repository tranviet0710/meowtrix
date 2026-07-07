// lib/email.ts — Email delivery via Resend

import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("Missing RESEND_API_KEY environment variable");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/** The sender address — must be a verified domain in Resend */
const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? "noreply@meowtrix.io";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send a single email via Resend.
 * Throws on failure so callers can handle retries.
 */
export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<{ id: string | null }> {
  const resend = getResend();

  console.log(`[Email] Sending to "${to}" from "${FROM_ADDRESS}" — subject: "${subject}"`);

  const { data, error } = await resend.emails.send({
    from: `MEOWTRIX HQ <${FROM_ADDRESS}>`,
    to,
    subject,
    html,
  });

  if (error) {
    console.error(`[Email] Resend rejected send to "${to}":`, error);
    throw new Error(`Resend error sending to ${to}: ${error.message}`);
  }

  console.log(`[Email] Resend accepted send to "${to}" — id: ${data?.id ?? "unknown"}`);
  return { id: data?.id ?? null };
}

/** Result of a single claim-email send attempt. */
export interface ClaimEmailSendResult {
  recipient: string;
  role: "overlord_owner" | "agent_reporter";
  status: "sent" | "failed";
  messageId?: string;
  error?: string;
}

/**
 * Send the claim notification email to both parties (lost reporter & found reporter).
 * Shares each other's email for scheduling a meetup.
 *
 * Each recipient is attempted independently — a failure to one party never blocks the other.
 * Returns per-recipient status so callers can surface delivery issues.
 */
export async function sendClaimEmails(params: {
  overlordOwnerEmail: string;
  overlordOwnerName: string;
  agentReporterEmail: string;
  agentReporterName: string;
  petName: string;
  matchId: string;
  matchScore: number;
}): Promise<ClaimEmailSendResult[]> {
  const { overlordOwnerEmail, overlordOwnerName, agentReporterEmail, agentReporterName, petName, matchId, matchScore } = params;

  // Escape all user-controlled inputs to prevent HTML injection
  const safeOverlordOwnerName = escapeHtml(overlordOwnerName);
  const safeAgentReporterName = escapeHtml(agentReporterName);
  const safePetName = escapeHtml(petName);
  const safeOverlordOwnerEmail = escapeHtml(overlordOwnerEmail);
  const safeAgentReporterEmail = escapeHtml(agentReporterEmail);

  const matchUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://meowtrix.io"}/matches/${matchId}`;

  // Email to the lost reporter (overlord owner)
  const overlordEmailPromise = sendEmail({
    to: overlordOwnerEmail,
    subject: `🎯 Claim Initiated — ${safePetName} may have been found!`,
    html: `
      <div style="font-family: monospace; background: #0A0A0F; color: #E6E6E6; padding: 32px; max-width: 600px;">
        <h1 style="color: #FFCC00; font-size: 18px; text-transform: uppercase; letter-spacing: 2px;">
          ⚡ CLAIM INITIATED
        </h1>
        <p>Good news, <strong>${safeOverlordOwnerName}</strong>!</p>
        <p>You've initiated a claim on a match for <strong style="color: #FFCC00;">${safePetName}</strong> with a <strong>${matchScore}%</strong> confidence score.</p>
        
        <h2 style="color: #00FF88; font-size: 14px; margin-top: 24px;">NEXT STEPS</h2>
        <ol style="line-height: 1.8;">
          <li>Contact the finder to schedule a meetup</li>
          <li>Verify your pet in person</li>
          <li>If successful, mark the report as <strong>resolved</strong> on the website</li>
          <li>If not your pet, revert the claim on the match page</li>
        </ol>

        <h2 style="color: #00FF88; font-size: 14px; margin-top: 24px;">FINDER'S CONTACT</h2>
        <p>
          Name: <strong>${safeAgentReporterName}</strong><br/>
          Email: <a href="mailto:${safeAgentReporterEmail}" style="color: #FFCC00;">${safeAgentReporterEmail}</a>
        </p>

        <p style="margin-top: 24px;">
          <a href="${matchUrl}" style="display: inline-block; background: #FFCC00; color: #0A0A0F; padding: 12px 24px; text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
            View Match Details
          </a>
        </p>

        <p style="color: #8892B0; font-size: 12px; margin-top: 32px;">
          If no action is taken within 24 hours, both parties will receive a reminder.
        </p>
      </div>
    `,
  });

  // Email to the found reporter (agent reporter)
  const agentEmailPromise = sendEmail({
    to: agentReporterEmail,
    subject: `🎯 Someone is claiming the pet you found — ${safePetName}!`,
    html: `
      <div style="font-family: monospace; background: #0A0A0F; color: #E6E6E6; padding: 32px; max-width: 600px;">
        <h1 style="color: #FFCC00; font-size: 18px; text-transform: uppercase; letter-spacing: 2px;">
          ⚡ CLAIM ALERT
        </h1>
        <p>Hello, <strong>${safeAgentReporterName}</strong>!</p>
        <p>The owner of <strong style="color: #FFCC00;">${safePetName}</strong> has claimed the pet you spotted. The match has a <strong>${matchScore}%</strong> confidence score.</p>
        
        <h2 style="color: #00FF88; font-size: 14px; margin-top: 24px;">NEXT STEPS</h2>
        <ol style="line-height: 1.8;">
          <li>The owner will contact you to schedule a meetup</li>
          <li>Meet in a safe public location to hand over the pet</li>
          <li>If the meetup is successful, the owner will mark it as resolved and you'll earn points!</li>
        </ol>

        <h2 style="color: #00FF88; font-size: 14px; margin-top: 24px;">OWNER'S CONTACT</h2>
        <p>
          Name: <strong>${safeOverlordOwnerName}</strong><br/>
          Email: <a href="mailto:${safeOverlordOwnerEmail}" style="color: #FFCC00;">${safeOverlordOwnerEmail}</a>
        </p>

        <p style="margin-top: 24px;">
          <a href="${matchUrl}" style="display: inline-block; background: #FFCC00; color: #0A0A0F; padding: 12px 24px; text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
            View Match Details
          </a>
        </p>

        <p style="color: #8892B0; font-size: 12px; margin-top: 32px;">
          If no action is taken within 24 hours, both parties will receive a reminder.
        </p>
      </div>
    `,
  });

  // Run both sends independently so one failure can't block the other
  const [overlordResult, agentResult] = await Promise.allSettled([
    overlordEmailPromise,
    agentEmailPromise,
  ]);

  const results: ClaimEmailSendResult[] = [
    overlordResult.status === "fulfilled"
      ? {
          recipient: overlordOwnerEmail,
          role: "overlord_owner",
          status: "sent",
          messageId: overlordResult.value.id ?? undefined,
        }
      : {
          recipient: overlordOwnerEmail,
          role: "overlord_owner",
          status: "failed",
          error:
            overlordResult.reason instanceof Error
              ? overlordResult.reason.message
              : String(overlordResult.reason),
        },
    agentResult.status === "fulfilled"
      ? {
          recipient: agentReporterEmail,
          role: "agent_reporter",
          status: "sent",
          messageId: agentResult.value.id ?? undefined,
        }
      : {
          recipient: agentReporterEmail,
          role: "agent_reporter",
          status: "failed",
          error:
            agentResult.reason instanceof Error
              ? agentResult.reason.message
              : String(agentResult.reason),
        },
  ];

  const failed = results.filter((r) => r.status === "failed");
  if (failed.length > 0) {
    console.error(
      `[Email] sendClaimEmails: ${failed.length}/${results.length} send(s) failed`,
      failed
    );
  } else {
    console.log(`[Email] sendClaimEmails: all ${results.length} send(s) accepted by Resend`);
  }

  return results;
}

/**
 * Send a 24h reminder email to both parties if the claim hasn't been resolved/reverted.
 */
export async function sendClaimReminderEmail(params: {
  email: string;
  displayName: string;
  petName: string;
  matchId: string;
}): Promise<void> {
  const { email, displayName, petName, matchId } = params;
  
  // Escape all user-controlled inputs to prevent HTML injection
  const safeDisplayName = escapeHtml(displayName);
  const safePetName = escapeHtml(petName);
  
  const matchUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://meowtrix.io"}/matches/${matchId}`;

  await sendEmail({
    to: email,
    subject: `⏰ Reminder: Update claim status for ${safePetName}`,
    html: `
      <div style="font-family: monospace; background: #0A0A0F; color: #E6E6E6; padding: 32px; max-width: 600px;">
        <h1 style="color: #FFCC00; font-size: 18px; text-transform: uppercase; letter-spacing: 2px;">
          ⏰ CLAIM REMINDER
        </h1>
        <p>Hello, <strong>${safeDisplayName}</strong>!</p>
        <p>It's been 24 hours since a claim was made for <strong style="color: #FFCC00;">${safePetName}</strong>, but no status update has been recorded.</p>
        
        <p>Please update the match status:</p>
        <ul style="line-height: 1.8;">
          <li><strong style="color: #00FF88;">Resolved</strong> — if the pet has been successfully reunited</li>
          <li><strong style="color: #FF4444;">Revert</strong> — if the claim didn't work out</li>
        </ul>

        <p style="margin-top: 24px;">
          <a href="${matchUrl}" style="display: inline-block; background: #FFCC00; color: #0A0A0F; padding: 12px 24px; text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
            Update Status
          </a>
        </p>
      </div>
    `,
  });
}


/**
 * Send the "Confirm your email address" activation message via Resend using
 * the Meowtrix spy-cat brand template.
 *
 * The `actionLink` is generated by `supabase.auth.admin.generateLink(...)`
 * and points to `${NEXT_PUBLIC_APP_URL}/api/auth/callback?code=...` so the
 * existing auth callback handles the exchange.
 */
export async function sendConfirmationEmail(params: {
  to: string;
  displayName: string;
  actionLink: string;
  /**
   * "signup" for first-time registration, "resend" for re-sending the link.
   * Only affects copy — the delivery mechanism is identical.
   */
  variant?: "signup" | "resend";
}): Promise<{ id: string | null }> {
  const { to, displayName, actionLink, variant = "signup" } = params;

  const safeName = escapeHtml(displayName || "Informant");
  const safeLink = escapeHtml(actionLink);

  const headline =
    variant === "resend" ? "REACTIVATE ACCESS" : "WELCOME TO HQ";
  const subject =
    variant === "resend"
      ? "🐾 New activation link — MEOWTRIX HQ"
      : "🐾 Confirm your MEOWTRIX HQ credentials";
  const intro =
    variant === "resend"
      ? "Here's a fresh activation link, straight from the war room."
      : "You've been recruited into the MEOWTRIX network. One last step to activate your credentials.";

  const html = `
    <div style="background:#0A0A0F;padding:32px 16px;font-family:'JetBrains Mono','Fira Code',ui-monospace,monospace;">
      <div style="max-width:600px;margin:0 auto;background:#1A1A2E;border:3px solid #FFCC00;padding:32px;color:#E6E6E6;">
        <div style="text-align:center;font-size:40px;line-height:1;margin-bottom:8px;">🐾</div>
        <h1 style="color:#FFCC00;font-size:22px;text-transform:uppercase;letter-spacing:3px;text-align:center;margin:0 0 4px;">
          ${headline}
        </h1>
        <p style="color:#8892B0;font-size:11px;text-align:center;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;">
          Meowtrix // Feline Overlord Tracker
        </p>

        <div style="height:1px;background:#2A2A3E;margin:0 0 24px;"></div>

        <p style="font-family:'Inter',sans-serif;font-size:15px;line-height:1.6;margin:0 0 12px;">
          Agent <strong style="color:#FFCC00;">${safeName}</strong>,
        </p>
        <p style="font-family:'Inter',sans-serif;font-size:15px;line-height:1.6;margin:0 0 24px;">
          ${intro}
        </p>

        <p style="text-align:center;margin:32px 0;">
          <a href="${safeLink}"
             style="display:inline-block;background:#FFCC00;color:#0A0A0F;padding:14px 32px;text-decoration:none;font-weight:800;text-transform:uppercase;letter-spacing:2px;font-size:14px;border:2px solid #FFCC00;box-shadow:4px 4px 0 #000;">
            🐈 Activate Access
          </a>
        </p>

        <p style="color:#8892B0;font-family:'Inter',sans-serif;font-size:12px;line-height:1.5;margin:0 0 8px;">
          Or copy this transmission URL into your browser:
        </p>
        <p style="word-break:break-all;color:#00FF88;font-size:11px;background:#0A0A0F;padding:12px;border:1px solid #2A2A3E;margin:0 0 24px;">
          ${safeLink}
        </p>

        <div style="height:1px;background:#2A2A3E;margin:24px 0;"></div>

        <h2 style="color:#00FF88;font-size:12px;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">
          MISSION BRIEFING
        </h2>
        <ul style="color:#8892B0;font-family:'Inter',sans-serif;font-size:13px;line-height:1.8;margin:0 0 24px;padding-left:20px;">
          <li>Report lost <strong style="color:#FF4444;">Overlords</strong> when your cat goes AWOL.</li>
          <li>Log spotted <strong style="color:#00FF88;">Agents</strong> to help reunite pets with their humans.</li>
          <li>Rack up points on the leaderboard as a top informant.</li>
        </ul>

        <p style="color:#8892B0;font-family:'Inter',sans-serif;font-size:11px;line-height:1.5;margin:0;">
          If you didn't request this transmission, ignore this message. No further contact will be made.
        </p>
      </div>

      <p style="color:#3A3A4E;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;text-align:center;text-transform:uppercase;letter-spacing:2px;margin:16px 0 0;">
        &copy; MEOWTRIX HQ — Purr-secure since 2026
      </p>
    </div>
  `;

  return sendEmail({ to, subject, html });
}

/** Minimal HTML-escape for interpolated user content in email templates. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
