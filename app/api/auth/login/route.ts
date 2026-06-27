import { createClient } from "@/lib/supabaseServer";
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
      console.error('[Login] Validation failed:', JSON.stringify(parsed.error.errors, null, 2));
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

      // Generic error for invalid email/password — no hints
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
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
