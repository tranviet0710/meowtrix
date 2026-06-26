import { createClient } from "@/lib/supabaseServer";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      return NextResponse.json(
        { success: false, error: "Failed to sign out. Please try again." },
        { status: 500 }
      );
    }

    // Redirect to the login page after successful signout (Req 1.10)
    const url = new URL(request.url);
    return NextResponse.redirect(new URL("/login", url.origin), { status: 303 });
  } catch {
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
