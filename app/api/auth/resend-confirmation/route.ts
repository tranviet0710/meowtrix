// app/api/auth/resend-confirmation/route.ts — Resend the email-activation link

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().email("Invalid email format"),
});

/**
 * POST /api/auth/resend-confirmation
 *
 * Re-sends the Supabase confirmation email so an Informant can activate
 * their account if the original message was lost. Returns the same generic
 * success response whether or not the email exists in the system, to avoid
 * leaking account existence (per Req 1.6 wording).
 */
export async function POST(request: NextRequest) {
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

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Read-only context — safe to ignore.
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      console.error("[ResendConfirmation] Supabase error:", {
        message: error.message,
        status: error.status,
        code: error.code,
      });

      // Rate limit feedback is useful to the user.
      if (
        error.status === 429 ||
        error.code === "over_email_send_rate_limit" ||
        error.message?.toLowerCase().includes("rate limit")
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Too many requests. Please wait a few minutes before trying again.",
          },
          { status: 429 }
        );
      }
      // Don't reveal whether the email is registered or already confirmed.
    }

    return NextResponse.json({
      success: true,
      message:
        "If an unconfirmed account exists for this email, a new activation link is on its way.",
    });
  } catch (error) {
    console.error("[ResendConfirmation] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
