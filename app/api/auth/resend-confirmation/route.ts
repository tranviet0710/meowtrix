// app/api/auth/resend-confirmation/route.ts — Resend the email-activation link

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabaseServer";
import { sendConfirmationEmail } from "@/lib/email";

const bodySchema = z.object({
  email: z.string().email("Invalid email format"),
});

/**
 * Ensures the response takes at least MIN_RESPONSE_TIME_MS to prevent
 * timing-based side-channel attacks that could reveal account existence.
 */
async function ensureMinimumResponseTime(
  startTime: number,
  response: NextResponse
): Promise<NextResponse> {
  const elapsed = Date.now() - startTime;
  const remaining = MIN_RESPONSE_TIME_MS - elapsed;
  
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  
  return response;
}

/** How many users to page through when searching by email. */
const USER_SEARCH_PER_PAGE = 200;
/** Max pages to scan before giving up (defensive cap). */
const USER_SEARCH_MAX_PAGES = 10;
/**
 * Minimum response time in milliseconds to prevent timing side-channel attacks.
 * This ensures all responses take at least this long, making it harder to
 * distinguish between existing unconfirmed accounts and other cases.
 */
const MIN_RESPONSE_TIME_MS = 1000;

/**
 * POST /api/auth/resend-confirmation
 *
 * Re-sends the activation link so an Informant can confirm their account.
 * Uses `auth.admin.generateLink({ type: 'magiclink' })` — a magic link acts
 * as an email-confirming login on Supabase, which is what an unconfirmed
 * signup effectively needs. The link is delivered via Resend using the
 * cat-themed template.
 *
 * Returns the same generic success response whether or not the email exists
 * to avoid leaking account existence. Enforces a minimum response time to
 * prevent timing-based enumeration attacks.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "A valid email is required." },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const serviceClient = await createServiceRoleClient();

    // Look up the user so we can personalize the email. If not found or
    // already confirmed, we still respond with the generic success message.
    let user: { id: string; email: string; email_confirmed_at?: string | null; user_metadata?: Record<string, unknown> } | null = null;
    for (let page = 1; page <= USER_SEARCH_MAX_PAGES; page++) {
      const { data, error } = await serviceClient.auth.admin.listUsers({
        page,
        perPage: USER_SEARCH_PER_PAGE,
      });
      if (error) {
        console.error("[ResendConfirmation] listUsers error:", error.message);
        break;
      }
      const match = data.users.find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );
      if (match) {
        user = {
          id: match.id,
          email: match.email!,
          email_confirmed_at: match.email_confirmed_at,
          user_metadata: match.user_metadata,
        };
        break;
      }
      if (data.users.length < USER_SEARCH_PER_PAGE) break;
    }

    const genericResponse = NextResponse.json({
      success: true,
      message:
        "If an unconfirmed account exists for this email, a new activation link is on its way.",
    });

    if (!user) return ensureMinimumResponseTime(startTime, genericResponse);
    if (user.email_confirmed_at) return ensureMinimumResponseTime(startTime, genericResponse); // already confirmed

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
      "http://localhost:3000";
    const redirectTo = `${appUrl}/api/auth/callback?next=/dashboard`;

    const { data: linkData, error: linkError } =
      await serviceClient.auth.admin.generateLink({
        type: "magiclink",
        email: normalizedEmail,
        options: { redirectTo },
      });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("[ResendConfirmation] generateLink error:", linkError);

      // Always return the generic response, even for rate limit errors,
      // to prevent leaking account existence/confirmation status through
      // observable response differences.
      return ensureMinimumResponseTime(startTime, genericResponse);
    }

    const displayName =
      (typeof user.user_metadata?.display_name === "string"
        ? (user.user_metadata.display_name as string)
        : null) ||
      user.email.split("@")[0] ||
      "Informant";

    try {
      await sendConfirmationEmail({
        to: user.email,
        displayName,
        actionLink: linkData.properties.action_link,
        variant: "resend",
      });
    } catch (mailErr) {
      console.error("[ResendConfirmation] sendConfirmationEmail failed:", mailErr);
    }

    return ensureMinimumResponseTime(startTime, genericResponse);
  } catch (error) {
    console.error("[ResendConfirmation] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
