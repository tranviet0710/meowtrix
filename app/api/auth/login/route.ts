import { createClient, createServiceRoleClient } from "@/lib/supabaseServer";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      console.error('[Login] Validation failed:', JSON.stringify(parsed.error.issues, null, 2));
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('[Login] Auth error:', { message: error.message, status: error.status, code: error.code });

      // Distinguish server/lockout errors from credential failures,
      // but NEVER reveal whether the email or password was wrong (Req 1.6).
      if (error.status === 429) {
        return NextResponse.json(
          { success: false, error: "Too many attempts. Please try again later." },
          { status: 429 }
        );
      }

      if (error.message?.toLowerCase().includes("disabled")) {
        return NextResponse.json(
          { success: false, error: "This account has been disabled." },
          { status: 403 }
        );
      }

      // Distinguish unconfirmed email from wrong credentials.
      // Supabase reports this in several ways depending on version; check all.
      const lowerMsg = error.message?.toLowerCase() ?? "";
      if (
        lowerMsg.includes("email not confirmed") ||
        lowerMsg.includes("not confirmed") ||
        lowerMsg.includes("not verified") ||
        error.code === "email_not_confirmed"
      ) {
        return NextResponse.json(
          {
            success: false,
            code: "email_not_confirmed",
            error:
              "Your account has not been activated yet. Check your inbox for the confirmation link, or request a new one below.",
          },
          { status: 403 }
        );
      }

      // Generic error for invalid email/password — no hints
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Update last_active_at on successful login so user appears online immediately
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const serviceClient = await createServiceRoleClient();
        await serviceClient
          .from("informants")
          .update({ last_active_at: new Date().toISOString() })
          .eq("id", user.id);
      }
    } catch {
      // Non-blocking — presence update failure doesn't affect login
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Login] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
