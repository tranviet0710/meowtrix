import { createClient, createServiceRoleClient } from "@/lib/supabaseServer";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

/**
 * Minimum time (ms) for any authentication attempt to prevent timing-based
 * account enumeration. This ensures that responses for non-existent accounts,
 * unconfirmed accounts, and wrong passwords all take approximately the same time.
 */
const MIN_AUTH_DURATION_MS = 300;

/**
 * Sleep for the specified duration in milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  // Record start time for timing normalization
  const startTime = Date.now();

  try {
    const body = await request.json();

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      console.error('[Login] Validation failed:', JSON.stringify(parsed.error.issues, null, 2));
      
      // Ensure minimum duration before returning to prevent timing attacks
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_AUTH_DURATION_MS) {
        await sleep(MIN_AUTH_DURATION_MS - elapsed);
      }
      
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
      // Log error without sensitive details that could leak account state.
      // Do NOT log error.code as it may contain 'email_not_confirmed' which
      // could leak through log aggregation systems.
      console.error('[Login] Auth error:', { 
        message: error.message, 
        status: error.status 
      });

      // Distinguish server/lockout errors from credential failures,
      // but NEVER reveal whether the email or password was wrong (Req 1.6).
      if (error.status === 429) {
        // Ensure minimum duration before returning to prevent timing attacks
        const elapsed = Date.now() - startTime;
        if (elapsed < MIN_AUTH_DURATION_MS) {
          await sleep(MIN_AUTH_DURATION_MS - elapsed);
        }
        
        return NextResponse.json(
          { success: false, error: "Too many attempts. Please try again later." },
          { status: 429 }
        );
      }

      if (error.message?.toLowerCase().includes("disabled")) {
        // Ensure minimum duration before returning to prevent timing attacks
        const elapsed = Date.now() - startTime;
        if (elapsed < MIN_AUTH_DURATION_MS) {
          await sleep(MIN_AUTH_DURATION_MS - elapsed);
        }
        
        return NextResponse.json(
          { success: false, error: "This account has been disabled." },
          { status: 403 }
        );
      }

      // Generic error for invalid email/password — no hints about account state.
      // Unconfirmed accounts are treated the same as invalid credentials to prevent
      // enumeration. Users can resend confirmation via /api/auth/resend-confirmation.
      
      // Ensure minimum duration before returning to prevent timing attacks
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_AUTH_DURATION_MS) {
        await sleep(MIN_AUTH_DURATION_MS - elapsed);
      }
      
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

    // Ensure minimum duration before returning to prevent timing attacks
    // This normalizes response time between successful and failed attempts
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_AUTH_DURATION_MS) {
      await sleep(MIN_AUTH_DURATION_MS - elapsed);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Login] Unexpected error:', error);
    
    // Ensure minimum duration before returning to prevent timing attacks
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_AUTH_DURATION_MS) {
      await sleep(MIN_AUTH_DURATION_MS - elapsed);
    }
    
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
